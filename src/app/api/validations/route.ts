/**
 * POST /api/validations/trigger
 *
 * Trigger the validation engine for a firewall request.
 * Compares FW rules against an approved design and checks policy compliance.
 *
 * GET /api/validations
 *
 * List validations for a submission.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { runValidation } from "@/lib/engine/orchestrator";
import { parseFirewallExcel } from "@/lib/engine/firewall-parser";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { submissionId, jiraTicketKey, firewallFile } = body;

    if (!submissionId) {
      return NextResponse.json(
        { error: "submissionId is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch the approved design rows
    const { data: submission } = await supabase
      .from("design_submissions")
      .select("id, status, project_id")
      .eq("id", submissionId)
      .single();

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    if (submission.status !== "approved") {
      return NextResponse.json(
        { error: "Only approved submissions can be validated against" },
        { status: 400 }
      );
    }

    const { data: designRows } = await supabase
      .from("design_rows")
      .select("*")
      .eq("submission_id", submissionId);

    if (!designRows || designRows.length === 0) {
      return NextResponse.json(
        { error: "No design rows found for this submission" },
        { status: 400 }
      );
    }

    // Parse the firewall file if provided as base64
    let firewallBuffer: Buffer | undefined;
    if (firewallFile) {
      firewallBuffer = Buffer.from(firewallFile, "base64");
    }

    // Create a validation record
    const { data: validation, error: valError } = await supabase
      .from("firewall_validations")
      .insert({
        submission_id: submissionId,
        jira_ticket_key: jiraTicketKey ?? null,
        status: "running",
        triggered_by: session.user.id,
      })
      .select()
      .single();

    if (valError || !validation) {
      return NextResponse.json(
        { error: "Failed to create validation record" },
        { status: 500 }
      );
    }

    // Run the validation engine
    try {
      // Parse FW rules from the uploaded file
      if (!firewallBuffer) {
        return NextResponse.json(
          { error: "firewallFile (base64) is required" },
          { status: 400 }
        );
      }
      const { rules: fwRules, errors: parseErrors } =
        await parseFirewallExcel(firewallBuffer);

      if (fwRules.length === 0) {
        await supabase
          .from("firewall_validations")
          .update({ status: "failed" })
          .eq("id", validation.id);
        return NextResponse.json(
          { error: "No firewall rules found in file", parseErrors },
          { status: 400 }
        );
      }

      // Load guidelines
      const { data: guidelines } = await supabase
        .from("guidelines")
        .select("*")
        .eq("enabled", true);

      const engineResult = runValidation(
        fwRules,
        designRows,
        guidelines ?? [],
        validation.id
      );

      // Store individual results
      if (engineResult.results.length > 0) {
        const resultRows = engineResult.results.map((r) => ({
          validation_id: validation.id,
          firewall_rule_index: r.fwRuleRef,
          verdict: r.verdict,
          confidence: r.confidence,
          matched_design_row_id: r.matchedDesignRowId ?? null,
          reason: r.reason,
          policy_violations: r.policyViolations ?? [],
        }));

        await supabase.from("validation_results").insert(resultRows);
      }

      // Update validation status
      const overallVerdict =
        engineResult.summary.rejected > 0
          ? "rejected"
          : engineResult.summary.clarificationNeeded > 0
            ? "clarification_needed"
            : "approved";

      await supabase
        .from("firewall_validations")
        .update({
          status: "completed",
          summary: engineResult.summary,
          completed_at: new Date().toISOString(),
        })
        .eq("id", validation.id);

      // Audit log
      await supabase.from("audit_log").insert({
        user_id: session.user.id,
        action: "validation_completed",
        entity_type: "firewall_validation",
        entity_id: validation.id,
        details: {
          submission_id: submissionId,
          jira_ticket_key: jiraTicketKey,
          overall_verdict: overallVerdict,
          summary: engineResult.summary,
        },
      });

      return NextResponse.json({
        validationId: validation.id,
        verdict: overallVerdict,
        summary: engineResult.summary,
        resultCount: engineResult.results.length,
      });
    } catch (engineError) {
      // Mark validation as failed
      await supabase
        .from("firewall_validations")
        .update({ status: "failed" })
        .eq("id", validation.id);

      throw engineError;
    }
  } catch (error) {
    console.error("Validation trigger error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const submissionId = searchParams.get("submissionId");

  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("firewall_validations")
    .select("*")
    .order("created_at", { ascending: false });

  if (submissionId) {
    query = query.eq("submission_id", submissionId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch validations" },
      { status: 500 }
    );
  }

  return NextResponse.json({ validations: data });
}
