/**
 * GET /api/admin/guidelines — List all guidelines
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("guidelines")
    .select("id, caution_id, title, description, category, severity, source, is_active")
    .order("caution_id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ guidelines: data });
}
