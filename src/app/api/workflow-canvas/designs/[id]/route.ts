import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("workflow_canvas_designs")
    .select("id, name, nodes, edges, created_at, updated_at")
    .eq("id", id)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch design", details: error.message },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  return NextResponse.json({ design: data });
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    updates.name = body.name.trim() || "Untitled design";
  }
  if (Array.isArray(body.nodes)) {
    updates.nodes = body.nodes;
  }
  if (Array.isArray(body.edges)) {
    updates.edges = body.edges;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("workflow_canvas_designs")
    .update(updates)
    .eq("id", id)
    .eq("user_id", session.user.id)
    .select("id, name, nodes, edges, created_at, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed to update design", details: error.message },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  return NextResponse.json({ design: data });
}

export async function DELETE(_: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("workflow_canvas_designs")
    .delete()
    .eq("id", id)
    .eq("user_id", session.user.id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to delete design", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
