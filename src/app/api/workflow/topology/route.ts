import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  checkRuleAgainstPolicies,
  loadGuidelines,
} from "@/lib/engine/policy-checker";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { FirewallRule } from "@/types";

const workflowNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    label: z.string(),
    category: z.enum(["environment", "zone", "control", "resource"]),
    zone: z.enum(["internet", "dmz", "intranet"]).optional(),
    description: z.string().optional(),
    componentType: z.string().optional(),
  }),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
});

const workflowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
});

const topologySchema = z.object({
  version: z.literal("1.0"),
  nodes: z.array(workflowNodeSchema),
  edges: z.array(workflowEdgeSchema),
});

const requestSchema = z.object({
  projectId: z.string().uuid(),
  topology: topologySchema,
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    !["architect", "project_team", "admin"].includes(session.user.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          issues: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { projectId, topology } = parsed.data;
    const nodeMap = new Map(topology.nodes.map((node) => [node.id, node]));

    const candidateRules = topology.edges.reduce<FirewallRule[]>((rules, edge, index) => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);

      if (!(source && target)) {
        return rules;
      }

      rules.push({
        category: "workflow",
        userRef: `WF-${index + 1}`,
        source: {
          desc: source.data.label,
          zone: source.data.zone ?? null,
          isInternet: source.data.zone === "internet",
          objects: [source.data.componentType ?? source.type],
          ips: [],
          xlates: [],
        },
        destination: {
          desc: target.data.label,
          zone: target.data.zone ?? null,
          isInternet: target.data.zone === "internet",
          objects: [target.data.componentType ?? target.type],
          ips: [],
          xlates: [],
        },
        services: [{ proto: "TCP", port: 443 }],
        action: "allow",
        justification: "Workflow topology validation",
        rawFields: { edgeId: edge.id },
      });

      return rules;
    }, []);

    const guidelines = await loadGuidelines();
    const results = candidateRules.map((rule) =>
      checkRuleAgainstPolicies(rule, guidelines)
    );

    const policyViolations = results.reduce(
      (count, result) => count + result.violations.length,
      0
    );

    const submissionId = crypto.randomUUID();

    try {
      const supabase = getSupabaseAdmin();
      await supabase.from("audit_log").insert({
        user_id: session.user.id,
        action: "workflow_topology_submitted",
        entity_type: "workflow_topology",
        entity_id: submissionId,
        details: {
          project_id: projectId,
          node_count: topology.nodes.length,
          edge_count: topology.edges.length,
          policy_violations: policyViolations,
          results,
          topology,
        },
      });
    } catch (auditError) {
      console.warn("Workflow topology audit log failed:", auditError);
    }

    return NextResponse.json({
      submissionId,
      summary: {
        policyViolations,
        checkedRules: results.length,
      },
      results,
    });
  } catch (error) {
    console.error("Workflow topology submission error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
