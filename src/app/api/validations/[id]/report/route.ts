/**
 * GET /api/validations/[id]/report
 *
 * Download the Excel validation report for a completed validation.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generateReport } from "@/lib/engine/report-generator";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  // Fetch validation with results
  const { data: validation, error } = await supabase
    .from("firewall_validations")
    .select(`
      *,
      validation_results (
        id,
        firewall_rule_index,
        verdict,
        confidence,
        matched_design_row_id,
        reason,
        policy_violations
      ),
      design_submissions (
        id,
        version,
        project:projects (
          name,
          project_code
        )
      )
    `)
    .eq("id", id)
    .single();

  if (error || !validation) {
    return NextResponse.json(
      { error: "Validation not found" },
      { status: 404 }
    );
  }

  if (validation.status !== "completed") {
    return NextResponse.json(
      { error: "Report is only available for completed validations" },
      { status: 400 }
    );
  }

  try {
    // The report generator needs the full engine result shape.
    // Reconstruct from stored data.
    const buffer = await generateReport(
      validation.jira_ticket_key ?? "N/A",
      validation.design_submissions?.project?.name ?? "Unknown",
      [], // FW rules not stored — report uses engine results
      {
        results: validation.validation_results.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          validationId: id,
          fwRuleRef: r.firewall_rule_index as string,
          verdict: r.verdict as string,
          confidence: r.confidence as number,
          matchedDesignRowId: r.matched_design_row_id as string | undefined,
          policyViolations: (r.policy_violations as string[]) ?? [],
          reason: r.reason as string,
          createdAt: "",
        })),
        summary: validation.summary ?? {
          total: validation.validation_results.length,
          approved: 0,
          rejected: 0,
          clarificationNeeded: 0,
        },
        designMatches: [],
        policyResults: [],
      }
    );

    const filename = `validation-report-${validation.jira_ticket_key ?? id}.xlsx`;

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Report generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
