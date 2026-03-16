/**
 * GET /api/reviews/[id]
 *
 * Fetch a single review with its row-level feedback.
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

  const { data: review, error } = await supabase
    .from("arb_reviews")
    .select(`
      *,
      arb_row_feedback (
        id,
        design_row_id,
        status,
        comment
      )
    `)
    .eq("id", id)
    .single();

  if (error || !review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  return NextResponse.json({ review });
}
