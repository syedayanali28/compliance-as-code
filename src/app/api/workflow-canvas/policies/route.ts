import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  createDefaultCatalog,
  type RuntimePolicyCatalog,
} from "@/modules/workflow-canvas/lib/policy-catalog";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fallback = createDefaultCatalog();

  try {
    const supabase = getSupabaseAdmin();

    const [componentsRes, rulesRes] = await Promise.all([
      supabase
        .from("workflow_canvas_components")
        .select(
          "component_key,node_type,label,category,description,zone,component_type,parent_component_key,is_zone,is_unique,default_width,default_height,enabled"
        )
        .eq("enabled", true)
        .order("category", { ascending: true })
        .order("label", { ascending: true }),
      supabase
        .from("workflow_canvas_validation_rules")
        .select(
          "policy_id,source_component_key,target_component_key,action,reason,enabled"
        )
        .eq("enabled", true)
        .order("policy_id", { ascending: true }),
    ]);

    if (componentsRes.error || rulesRes.error) {
      return NextResponse.json(fallback);
    }

    if (!componentsRes.data?.length) {
      return NextResponse.json(fallback);
    }

    const payload: RuntimePolicyCatalog = {
      components: componentsRes.data.map((component) => ({
        componentKey: String(component.component_key),
        nodeType: String(component.node_type),
        label: String(component.label),
        category: String(component.category) as RuntimePolicyCatalog["components"][number]["category"],
        description: String(component.description),
        zone: component.zone ? String(component.zone) : undefined,
        componentType: String(component.component_type),
        parentComponentKey: component.parent_component_key
          ? String(component.parent_component_key)
          : undefined,
        isZone: Boolean(component.is_zone),
        isUnique: Boolean(component.is_unique),
        defaultWidth:
          typeof component.default_width === "number"
            ? component.default_width
            : undefined,
        defaultHeight:
          typeof component.default_height === "number"
            ? component.default_height
            : undefined,
      })),
      rules: (rulesRes.data ?? []).map((rule) => ({
        policyId: String(rule.policy_id),
        sourceComponentKey: String(rule.source_component_key),
        targetComponentKey: String(rule.target_component_key),
        action: rule.action === "deny" ? "deny" : "allow",
        reason: String(rule.reason),
        enabled: Boolean(rule.enabled),
      })),
    };

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(fallback);
  }
}
