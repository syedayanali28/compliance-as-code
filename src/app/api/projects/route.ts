/**
 * GET /api/projects — List all projects (with optional search)
 * POST /api/projects — Create a new project
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("q");

  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,project_code.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }

  return NextResponse.json({ projects: data });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    session.user.role !== "architect" &&
    session.user.role !== "admin"
  ) {
    return NextResponse.json(
      { error: "Only architects and admins can create projects" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { name, projectCode, description, environment } = body;

    if (!name || !projectCode) {
      return NextResponse.json(
        { error: "name and projectCode are required" },
        { status: 400 }
      );
    }

    // Validate project code format: uppercase alphanumeric + hyphens
    if (!/^[A-Z0-9][A-Z0-9-]{1,48}[A-Z0-9]$/.test(projectCode)) {
      return NextResponse.json(
        {
          error:
            "projectCode must be 3-50 uppercase alphanumeric characters or hyphens, starting and ending with alphanumeric",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Check uniqueness
    const { data: existing } = await supabase
      .from("projects")
      .select("id")
      .eq("project_code", projectCode)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "A project with this code already exists" },
        { status: 409 }
      );
    }

    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        name,
        project_code: projectCode,
        description: description ?? null,
        environment: environment ?? "production",
        created_by: session.user.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to create project", details: error.message },
        { status: 500 }
      );
    }

    // Audit log
    await supabase.from("audit_log").insert({
      user_id: session.user.id,
      action: "project_created",
      entity_type: "project",
      entity_id: project.id,
      details: { name, projectCode },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("Project creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
