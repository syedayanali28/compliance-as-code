/**
 * GET /api/submissions/[id]
 * PATCH /api/submissions/[id] (update status, ARB review)
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

  const { data: submission, error } = await supabase
    .from("design_submissions")
    .select(`
      *,
      projects (*),
      design_rows (*),
      arb_reviews (
        *,
        arb_row_feedback (*)
      )
    `)
    .eq("id", id)
    .single();

  if (error || !submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  return NextResponse.json(submission);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status } = body;

  if (!status) {
    return NextResponse.json({ error: "Status required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("design_submissions")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("audit_log").insert({
    user_id: session.user.id,
    action: "submission_status_changed",
    entity_type: "design_submission",
    entity_id: id,
    details: { new_status: status },
  });

  return NextResponse.json(data);
}
