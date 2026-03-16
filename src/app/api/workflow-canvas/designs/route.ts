import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("workflow_canvas_designs")
    .select("id, name, created_at, updated_at")
    .eq("user_id", session.user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to list designs", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ designs: data ?? [] });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "Untitled design";
  const nodes = Array.isArray(body.nodes) ? body.nodes : [];
  const edges = Array.isArray(body.edges) ? body.edges : [];

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("workflow_canvas_designs")
    .insert({
      user_id: session.user.id,
      name: name || "Untitled design",
      nodes,
      edges,
    })
    .select("id, name, nodes, edges, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to create design", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ design: data }, { status: 201 });
}
