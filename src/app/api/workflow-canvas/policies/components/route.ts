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
    .from("workflow_canvas_components")
    .insert(body)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ component: data }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const guard = await ensureAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json();
  const componentKey = typeof body.component_key === "string" ? body.component_key : "";
  if (!componentKey) {
    return NextResponse.json({ error: "component_key is required" }, { status: 400 });
  }

  const updates = { ...body };
  delete updates.component_key;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("workflow_canvas_components")
    .update(updates)
    .eq("component_key", componentKey)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ component: data });
}

export async function DELETE(request: NextRequest) {
  const guard = await ensureAdmin();
  if (!guard.ok) return guard.response;

  const componentKey = request.nextUrl.searchParams.get("componentKey");
  if (!componentKey) {
    return NextResponse.json({ error: "componentKey query is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("workflow_canvas_components")
    .delete()
    .eq("component_key", componentKey);

  if (error) {
    return NextResponse.json(
      {
        error:
          "Delete blocked. Ensure no validation rules or child components reference this component.",
        details: error.message,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
