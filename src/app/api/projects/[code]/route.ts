/**
 * GET /api/projects/[code]
 *
 * Fetch a project by code with its submissions.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await params;
  const supabase = getSupabaseAdmin();

  const { data: project, error } = await supabase
    .from("projects")
    .select(`
      *,
      design_submissions (
        id,
        version,
        status,
        submitted_by,
        created_at,
        yaml_url,
        diagram_url
      )
    `)
    .eq("project_code", code)
    .single();

  if (error || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({ project });
}
