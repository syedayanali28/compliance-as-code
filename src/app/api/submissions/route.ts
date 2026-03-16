/**
 * POST /api/submissions
 *
 * Upload an IdaC Excel file, parse it, store design rows,
 * convert to YAML, commit to GitLab, generate diagram.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseIdacExcel } from "@/lib/excel/parser";
import { convertToYaml } from "@/lib/idac/yaml-converter";
import { generateMermaidDiagram } from "@/lib/idac/mermaid-generator";
import { commitDesign } from "@/lib/idac/gitlab-client";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;
    const notes = formData.get("notes") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Parse the Excel file
    const buffer = Buffer.from(await file.arrayBuffer());
    const parseResult = await parseIdacExcel(buffer);

    if (parseResult.errors.length > 0) {
      return NextResponse.json(
        {
          error: "Validation errors found in the Excel file",
          errors: parseResult.errors,
          warnings: parseResult.warnings,
        },
        { status: 422 }
      );
    }

    if (parseResult.rows.length === 0) {
      return NextResponse.json(
        { error: "No data rows found in the Excel file" },
        { status: 422 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Get project
    const { data: project, error: projError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (projError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Determine next version
    const { data: latestSub } = await supabase
      .from("design_submissions")
      .select("version")
      .eq("project_id", projectId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    const nextVersion = (latestSub?.version ?? 0) + 1;

    // Mark previous submission as superseded
    if (latestSub) {
      await supabase
        .from("design_submissions")
        .update({ status: "superseded" })
        .eq("project_id", projectId)
        .eq("status", "approved");
    }

    const metadata = parseResult.metadata ?? {
      projectName: project.name,
      architectName: session.user.name,
      submissionDate: new Date().toISOString().split("T")[0],
      version: nextVersion,
    };
    metadata.version = nextVersion;

    // Convert to YAML
    const yamlContent = convertToYaml(parseResult.rows, metadata);

    // Generate Mermaid diagram
    const mermaidDiagram = generateMermaidDiagram(parseResult.rows);

    // Commit to GitLab (skip if GitLab not configured)
    let gitlabCommitSha: string | undefined;
    if (process.env.GITLAB_URL && process.env.GITLAB_API_TOKEN) {
      try {
        const commitResult = await commitDesign(
          project.code,
          nextVersion,
          yamlContent,
          `Design v${nextVersion} submitted by ${session.user.name}`
        );
        gitlabCommitSha = commitResult.commitSha;
      } catch (gitError) {
        console.warn("GitLab commit failed (non-blocking):", gitError);
      }
    }

    // Insert submission
    const { data: submission, error: subError } = await supabase
      .from("design_submissions")
      .insert({
        project_id: projectId,
        version: nextVersion,
        status: "submitted",
        submitted_by: session.user.id,
        submitted_at: new Date().toISOString(),
        idac_yaml: yamlContent,
        gitlab_commit_sha: gitlabCommitSha,
        mermaid_diagram: mermaidDiagram,
        notes,
      })
      .select()
      .single();

    if (subError) {
      return NextResponse.json(
        { error: "Failed to create submission", details: subError.message },
        { status: 500 }
      );
    }

    // Insert design rows
    const rowsToInsert = parseResult.rows.map((row) => ({
      submission_id: submission.id,
      row_number: row.rowNumber,
      source_component: row.sourceComponent,
      source_technology: row.sourceTechnology,
      source_zone: row.sourceZone,
      source_ip_subnet: row.sourceIpSubnet,
      dest_component: row.destComponent,
      dest_technology: row.destTechnology,
      dest_zone: row.destZone,
      dest_ip_subnet: row.destIpSubnet,
      direction: row.direction,
      protocol: row.protocol,
      ports: row.ports,
      action: row.action,
      is_common_service: row.isCommonService,
      justification: row.justification,
      environment: row.environment,
      application_id: row.applicationId,
      data_classification: row.dataClassification,
      encryption_required: row.encryptionRequired,
      nat_translation: row.natTranslation,
      gateway: row.gateway,
      notes: row.notes,
    }));

    const { error: rowsError } = await supabase
      .from("design_rows")
      .insert(rowsToInsert);

    if (rowsError) {
      console.error("Failed to insert design rows:", rowsError);
    }

    // Audit log
    await supabase.from("audit_log").insert({
      user_id: session.user.id,
      action: "submission_created",
      entity_type: "design_submission",
      entity_id: submission.id,
      details: {
        project_code: project.code,
        version: nextVersion,
        row_count: parseResult.rows.length,
        warnings: parseResult.warnings,
      },
    });

    return NextResponse.json({
      submission: {
        id: submission.id,
        version: nextVersion,
        status: "submitted",
        rowCount: parseResult.rows.length,
        gitlabCommitSha,
        warnings: parseResult.warnings,
      },
      yaml: yamlContent,
      mermaid: mermaidDiagram,
    });
  } catch (error) {
    console.error("Submission error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const forReview = searchParams.get("forReview") === "true";
  const projectId = searchParams.get("projectId");

  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("design_submissions")
    .select(`
      id,
      version,
      status,
      submitted_by,
      created_at,
      yaml_url,
      diagram_url,
      project:projects (
        name,
        project_code
      )
    `)
    .order("created_at", { ascending: false });

  if (forReview) {
    query = query.in("status", ["submitted", "under_review", "approved", "changes_requested", "rejected"]);
  }

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch submissions" }, { status: 500 });
  }

  return NextResponse.json({ submissions: data });
}
