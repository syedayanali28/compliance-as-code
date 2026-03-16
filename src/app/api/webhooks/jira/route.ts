/**
 * POST /api/webhooks/jira
 *
 * JIRA webhook listener for new firewall request issues.
 * Phase 1: Read-only — logs events and optionally triggers validation.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// Simple HMAC validation for webhook authenticity
async function verifyWebhookSignature(
  request: NextRequest,
  body: string
): Promise<boolean> {
  const secret = process.env.JIRA_WEBHOOK_SECRET;
  if (!secret) return true; // Skip verification if no secret configured

  const signature = request.headers.get("x-hub-signature");
  if (!signature) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expectedSig = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `sha256=${expectedSig}` === signature;
}

export async function POST(request: NextRequest) {
  try {
    const bodyText = await request.text();

    // Verify webhook signature
    const isValid = await verifyWebhookSignature(request, bodyText);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    const payload = JSON.parse(bodyText);
    const webhookEvent = payload.webhookEvent;
    const issue = payload.issue;

    if (!issue) {
      return NextResponse.json({ status: "ignored", reason: "no issue" });
    }

    const supabase = getSupabaseAdmin();

    // Log all webhook events
    await supabase.from("audit_log").insert({
      action: "jira_webhook_received",
      entity_type: "jira_issue",
      entity_id: issue.key,
      details: {
        event: webhookEvent,
        issue_key: issue.key,
        issue_type: issue.fields?.issuetype?.name,
        status: issue.fields?.status?.name,
        summary: issue.fields?.summary,
      },
    });

    // Phase 1: Only log. Future phases can auto-trigger validation.
    // For now, respond with acknowledgement.
    return NextResponse.json({
      status: "received",
      issueKey: issue.key,
      event: webhookEvent,
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
