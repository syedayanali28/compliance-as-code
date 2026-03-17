import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  createLocalDesign,
  getLatestLocalVersion,
  listLocalDesigns,
} from "@/lib/workflow-canvas-local-store";

const OWNER_ID_COOKIE = "workflow_canvas_owner_id";
const OWNER_ID_HEADER = "x-workflow-canvas-owner-id";

const normalizeHierarchySegment = (value: unknown, fallback: string) => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || fallback;
};

const normalizeGuestOwnerId = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || null;
};

const resolveOwnerId = async (request: NextRequest) => {
  const session = await auth();
  if (session?.user?.id) {
    return {
      ownerId: session.user.id,
      ownerCookieValue: null,
      shouldSetOwnerCookie: false,
    };
  }

  const ownerFromHeader = normalizeGuestOwnerId(request.headers.get(OWNER_ID_HEADER));
  const ownerFromCookie = normalizeGuestOwnerId(request.cookies.get(OWNER_ID_COOKIE)?.value);
  const ownerId = ownerFromHeader ?? ownerFromCookie ?? crypto.randomUUID();

  return {
    ownerId: `guest:${ownerId}`,
    ownerCookieValue: ownerId,
    shouldSetOwnerCookie: ownerFromCookie !== ownerId,
  };
};

const applyOwnerCookie = (
  response: NextResponse,
  ownerCookieValue: string | null,
  shouldSetOwnerCookie: boolean
) => {
  if (!ownerCookieValue || !shouldSetOwnerCookie) {
    return response;
  }

  response.cookies.set({
    name: OWNER_ID_COOKIE,
    value: ownerCookieValue,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });

  return response;
};

const HIERARCHY_COLUMNS = [
  "team_slug",
  "project_code",
  "design_key",
  "version",
  "gitlab_path",
] as const;

const supportsHierarchyVersioning = async (supabase: ReturnType<typeof getSupabaseAdmin>) => {
  const { data, error } = await supabase
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", "workflow_canvas_designs")
    .in("column_name", [...HIERARCHY_COLUMNS]);

  if (error || !data) {
    return false;
  }

  const present = new Set(data.map((row) => String(row.column_name)));
  return HIERARCHY_COLUMNS.every((column) => present.has(column));
};

const isConnectivityError = (message: string | undefined) => {
  const source = (message ?? "").toLowerCase();
  return (
    source.includes("fetch failed") ||
    source.includes("econnrefused") ||
    source.includes("enotfound") ||
    source.includes("network")
  );
};

export async function GET(request: NextRequest) {
  const { ownerId, ownerCookieValue, shouldSetOwnerCookie } = await resolveOwnerId(request);

  const supabase = getSupabaseAdmin();
  const hasHierarchyColumns = await supportsHierarchyVersioning(supabase);
  const selectColumns = hasHierarchyColumns
    ? "id, name, team_slug, project_code, design_key, version, gitlab_path, created_at, updated_at"
    : "id, name, created_at, updated_at";

  const { data, error } = await supabase
    .from("workflow_canvas_designs")
    .select(selectColumns)
    .eq("user_id", ownerId)
    .order("updated_at", { ascending: false });

  if (error) {
    if (isConnectivityError(error.message)) {
      const localDesigns = await listLocalDesigns(ownerId);
      return applyOwnerCookie(
        NextResponse.json({ designs: localDesigns, storage: "local-fallback" }),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    return applyOwnerCookie(
      NextResponse.json(
      { error: "Failed to list designs", details: error.message },
      { status: 500 }
      ),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  }

  return applyOwnerCookie(
    NextResponse.json({ designs: data ?? [] }),
    ownerCookieValue,
    shouldSetOwnerCookie
  );
}

export async function POST(request: NextRequest) {
  const { ownerId, ownerCookieValue, shouldSetOwnerCookie } = await resolveOwnerId(request);

  const body = await request.json();
  const requestedId = typeof body.id === "string" ? body.id.trim() : "";
  const designId = requestedId || crypto.randomUUID();
  const name = typeof body.name === "string" ? body.name.trim() : "Untitled design";
  const nodes = Array.isArray(body.nodes) ? body.nodes : [];
  const edges = Array.isArray(body.edges) ? body.edges : [];
  const teamSlug = normalizeHierarchySegment(body.teamSlug, "default-team");
  const projectCode = normalizeHierarchySegment(body.projectCode, "default-project");
  const designKey = normalizeHierarchySegment(body.designKey ?? name, "untitled-design");

  const supabase = getSupabaseAdmin();
  const hasHierarchyColumns = await supportsHierarchyVersioning(supabase);

  if (!hasHierarchyColumns) {
    const { data, error } = await supabase
      .from("workflow_canvas_designs")
      .insert({
        id: designId,
        user_id: ownerId,
        name: name || "Untitled design",
        nodes,
        edges,
      })
      .select("id, name, nodes, edges, created_at, updated_at")
      .single();

    if (error) {
      if (isConnectivityError(error.message)) {
        const fallbackVersion =
          (await getLatestLocalVersion(ownerId, teamSlug, projectCode, designKey)) + 1;
        const fallbackGitlabPath = `${teamSlug}/${projectCode}/${designKey}/v${fallbackVersion}.json`;
        const localDesign = await createLocalDesign({
          id: designId,
          user_id: ownerId,
          name: name || "Untitled design",
          nodes,
          edges,
          team_slug: teamSlug,
          project_code: projectCode,
          design_key: designKey,
          version: fallbackVersion,
          gitlab_path: fallbackGitlabPath,
        });

        return applyOwnerCookie(
          NextResponse.json(
            { design: localDesign, storage: "local-fallback" },
            { status: 201 }
          ),
          ownerCookieValue,
          shouldSetOwnerCookie
        );
      }

      return applyOwnerCookie(
        NextResponse.json(
          { error: "Failed to create design", details: error.message },
          { status: 500 }
        ),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    const fallbackVersion = 1;
    const fallbackGitlabPath = `${teamSlug}/${projectCode}/${designKey}/v${fallbackVersion}.json`;

    return applyOwnerCookie(
      NextResponse.json(
        {
          design: {
            ...data,
            team_slug: teamSlug,
            project_code: projectCode,
            design_key: designKey,
            version: fallbackVersion,
            gitlab_path: fallbackGitlabPath,
          },
        },
        { status: 201 }
      ),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  }

  const { data: latestVersionRow, error: latestVersionError } = await supabase
    .from("workflow_canvas_designs")
    .select("version")
    .eq("user_id", ownerId)
    .eq("team_slug", teamSlug)
    .eq("project_code", projectCode)
    .eq("design_key", designKey)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestVersionError) {
    if (isConnectivityError(latestVersionError.message)) {
      const fallbackVersion =
        (await getLatestLocalVersion(ownerId, teamSlug, projectCode, designKey)) + 1;
      const fallbackGitlabPath = `${teamSlug}/${projectCode}/${designKey}/v${fallbackVersion}.json`;
      const localDesign = await createLocalDesign({
        id: designId,
        user_id: ownerId,
        name: name || "Untitled design",
        nodes,
        edges,
        team_slug: teamSlug,
        project_code: projectCode,
        design_key: designKey,
        version: fallbackVersion,
        gitlab_path: fallbackGitlabPath,
      });

      return applyOwnerCookie(
        NextResponse.json(
          { design: localDesign, storage: "local-fallback" },
          { status: 201 }
        ),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    return applyOwnerCookie(
      NextResponse.json(
      { error: "Failed to determine version", details: latestVersionError.message },
      { status: 500 }
      ),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  }

  const version = (latestVersionRow?.version ?? 0) + 1;
  const gitlabPath = `${teamSlug}/${projectCode}/${designKey}/v${version}.json`;

  const { data, error } = await supabase
    .from("workflow_canvas_designs")
    .insert({
      id: designId,
      user_id: ownerId,
      name: name || "Untitled design",
      team_slug: teamSlug,
      project_code: projectCode,
      design_key: designKey,
      version,
      gitlab_path: gitlabPath,
      nodes,
      edges,
    })
    .select(
      "id, name, team_slug, project_code, design_key, version, gitlab_path, nodes, edges, created_at, updated_at"
    )
    .single();

  if (error) {
    if (isConnectivityError(error.message)) {
      const localDesign = await createLocalDesign({
        id: designId,
        user_id: ownerId,
        name: name || "Untitled design",
        nodes,
        edges,
        team_slug: teamSlug,
        project_code: projectCode,
        design_key: designKey,
        version,
        gitlab_path: gitlabPath,
      });

      return applyOwnerCookie(
        NextResponse.json(
          { design: localDesign, storage: "local-fallback" },
          { status: 201 }
        ),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    return applyOwnerCookie(
      NextResponse.json(
      { error: "Failed to create design", details: error.message },
      { status: 500 }
      ),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  }

  return applyOwnerCookie(
    NextResponse.json({ design: data }, { status: 201 }),
    ownerCookieValue,
    shouldSetOwnerCookie
  );
}
