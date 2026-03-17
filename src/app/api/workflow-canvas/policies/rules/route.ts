import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

const ensureAdmin = async () => {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if ((session.user.role ?? "").toLowerCase() !== "admin") {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true as const };
};

export async function POST(request: NextRequest) {
  const guard = await ensureAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json();
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("workflow_canvas_validation_rules")
    .insert(body)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ rule: data }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const guard = await ensureAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json();
  const policyId = typeof body.policy_id === "string" ? body.policy_id : "";
  if (!policyId) {
    return NextResponse.json({ error: "policy_id is required" }, { status: 400 });
  }

  const updates = { ...body };
  delete updates.policy_id;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("workflow_canvas_validation_rules")
    .update(updates)
    .eq("policy_id", policyId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ rule: data });
}

export async function DELETE(request: NextRequest) {
  const guard = await ensureAdmin();
  if (!guard.ok) return guard.response;

  const policyId = request.nextUrl.searchParams.get("policyId");
  if (!policyId) {
    return NextResponse.json({ error: "policyId query is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("workflow_canvas_validation_rules")
    .delete()
    .eq("policy_id", policyId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
