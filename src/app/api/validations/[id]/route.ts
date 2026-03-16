/**
 * GET /api/validations/[id]
 *
 * Fetch a single validation with its results.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

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

  return NextResponse.json({ validation });
}
