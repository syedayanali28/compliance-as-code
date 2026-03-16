/**
 * POST /api/reviews
 *
 * Create an ARB review for a design submission.
 * Includes row-level feedback.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "arb_reviewer" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Only ARB reviewers can submit reviews" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { submissionId, overallComment, status, rowFeedback } = body;

    if (!submissionId || !status) {
      return NextResponse.json(
        { error: "submissionId and status are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Verify submission exists and is reviewable
    const { data: submission } = await supabase
      .from("design_submissions")
      .select("id, status")
      .eq("id", submissionId)
      .single();

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    if (!["submitted", "under_review"].includes(submission.status)) {
      return NextResponse.json(
        { error: `Cannot review a submission with status: ${submission.status}` },
        { status: 400 }
      );
    }

    // Create the review
    const { data: review, error: reviewError } = await supabase
      .from("arb_reviews")
      .insert({
        submission_id: submissionId,
        reviewer_id: session.user.id,
        reviewer_team: session.user.team ?? null,
        status,
        overall_comment: overallComment,
        reviewed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (reviewError) {
      return NextResponse.json(
        { error: "Failed to create review", details: reviewError.message },
        { status: 500 }
      );
    }

    // Insert row-level feedback
    if (rowFeedback && Array.isArray(rowFeedback) && rowFeedback.length > 0) {
      const feedbackRows = rowFeedback.map(
        (fb: { designRowId: string; status: string; comment: string }) => ({
          review_id: review.id,
          design_row_id: fb.designRowId,
          status: fb.status,
          comment: fb.comment,
        })
      );

      const { error: fbError } = await supabase
        .from("arb_row_feedback")
        .insert(feedbackRows);

      if (fbError) {
        console.error("Failed to insert row feedback:", fbError);
      }
    }

    // Update submission status
    const newSubStatus =
      status === "approved" ? "approved" : "changes_requested";
    await supabase
      .from("design_submissions")
      .update({ status: newSubStatus })
      .eq("id", submissionId);

    // Audit log
    await supabase.from("audit_log").insert({
      user_id: session.user.id,
      action: "review_submitted",
      entity_type: "arb_review",
      entity_id: review.id,
      details: {
        submission_id: submissionId,
        verdict: status,
        feedback_count: rowFeedback?.length ?? 0,
      },
    });

    return NextResponse.json({
      review: {
        id: review.id,
        status,
        feedbackCount: rowFeedback?.length ?? 0,
      },
    });
  } catch (error) {
    console.error("Review error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
