import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  createLocalDesign,
  deleteLocalDesign,
  getLatestLocalVersion,
  getLocalDesign,
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
  const ownerId = ownerFromHeader ?? ownerFromCookie;

  if (!ownerId) {
    return {
      ownerId: null,
      ownerCookieValue: null,
      shouldSetOwnerCookie: false,
    };
  }

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

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { ownerId, ownerCookieValue, shouldSetOwnerCookie } = await resolveOwnerId(request);
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const hasHierarchyColumns = await supportsHierarchyVersioning(supabase);

  const { data: designRow, error } = await supabase
    .from("workflow_canvas_designs")
    .select("*")
    .eq("id", id)
    .eq("user_id", ownerId)
    .maybeSingle();

  if (error) {
    if (isConnectivityError(error.message)) {
      const localDesign = await getLocalDesign(ownerId, id);
      if (!localDesign) {
        return applyOwnerCookie(
          NextResponse.json({ error: "Design not found" }, { status: 404 }),
          ownerCookieValue,
          shouldSetOwnerCookie
        );
      }

      return applyOwnerCookie(
        NextResponse.json({ design: localDesign, storage: "local-fallback" }),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    return applyOwnerCookie(
      NextResponse.json(
        { error: "Failed to fetch design", details: error.message },
        { status: 500 }
      ),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  }

  if (!designRow) {
    return applyOwnerCookie(
      NextResponse.json({ error: "Design not found" }, { status: 404 }),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  }

  const baseDesign = (designRow ?? {}) as Record<string, unknown>;
  const baseName =
    typeof baseDesign.name === "string" ? baseDesign.name : "Untitled design";
  const fallbackDesign = hasHierarchyColumns
    ? baseDesign
    : {
        ...baseDesign,
        team_slug: "default-team",
        project_code: "default-project",
        design_key: normalizeHierarchySegment(baseName, "untitled-design"),
        version: 1,
        gitlab_path: `default-team/default-project/${normalizeHierarchySegment(baseName, "untitled-design")}/v1.json`,
      };

  return applyOwnerCookie(
    NextResponse.json({ design: fallbackDesign }),
    ownerCookieValue,
    shouldSetOwnerCookie
  );
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { ownerId, ownerCookieValue, shouldSetOwnerCookie } = await resolveOwnerId(request);
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const supabase = getSupabaseAdmin();
  const hasHierarchyColumns = await supportsHierarchyVersioning(supabase);

  if (!hasHierarchyColumns) {
    const { data: existingLegacy, error: existingLegacyError } = await supabase
      .from("workflow_canvas_designs")
      .select("*")
      .eq("id", id)
      .eq("user_id", ownerId)
      .maybeSingle();

    if (existingLegacyError) {
      if (isConnectivityError(existingLegacyError.message)) {
        const localExisting = await getLocalDesign(ownerId, id);
        if (!localExisting) {
          return applyOwnerCookie(
            NextResponse.json({ error: "Design not found" }, { status: 404 }),
            ownerCookieValue,
            shouldSetOwnerCookie
          );
        }

        const name =
          typeof body.name === "string"
            ? body.name.trim() || "Untitled design"
            : localExisting.name;
        const nodes = Array.isArray(body.nodes) ? body.nodes : [];
        const edges = Array.isArray(body.edges) ? body.edges : [];
        const teamSlug = normalizeHierarchySegment(
          body.teamSlug ?? localExisting.team_slug,
          "default-team"
        );
        const projectCode = normalizeHierarchySegment(
          body.projectCode ?? localExisting.project_code,
          "default-project"
        );
        const designKey = normalizeHierarchySegment(
          body.designKey ?? localExisting.design_key ?? name,
          "untitled-design"
        );
        const version =
          (await getLatestLocalVersion(ownerId, teamSlug, projectCode, designKey)) + 1;
        const gitlabPath = `${teamSlug}/${projectCode}/${designKey}/v${version}.json`;

        const localDesign = await createLocalDesign({
          id: crypto.randomUUID(),
          user_id: ownerId,
          name,
          nodes,
          edges,
          team_slug: teamSlug,
          project_code: projectCode,
          design_key: designKey,
          version,
          gitlab_path: gitlabPath,
        });

        return applyOwnerCookie(
          NextResponse.json({ design: localDesign, storage: "local-fallback" }),
          ownerCookieValue,
          shouldSetOwnerCookie
        );
      }

      return applyOwnerCookie(
        NextResponse.json(
          { error: "Failed to load design", details: existingLegacyError.message },
          { status: 500 }
        ),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    if (!existingLegacy) {
      return applyOwnerCookie(
        NextResponse.json({ error: "Design not found" }, { status: 404 }),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    const name =
      typeof body.name === "string" ? body.name.trim() || "Untitled design" : existingLegacy.name;
    const nodes = Array.isArray(body.nodes) ? body.nodes : [];
    const edges = Array.isArray(body.edges) ? body.edges : [];

    const { data: createdLegacy, error: createdLegacyError } = await supabase
      .from("workflow_canvas_designs")
      .insert({
        id: crypto.randomUUID(),
        user_id: ownerId,
        name,
        nodes,
        edges,
      })
      .select("*")
      .single();

    if (createdLegacyError) {
      if (isConnectivityError(createdLegacyError.message)) {
        const designKey = normalizeHierarchySegment(name, "untitled-design");
        const version =
          (await getLatestLocalVersion(ownerId, "default-team", "default-project", designKey)) +
          1;
        const localDesign = await createLocalDesign({
          id: crypto.randomUUID(),
          user_id: ownerId,
          name,
          nodes,
          edges,
          team_slug: "default-team",
          project_code: "default-project",
          design_key: designKey,
          version,
          gitlab_path: `default-team/default-project/${designKey}/v${version}.json`,
        });

        return applyOwnerCookie(
          NextResponse.json({ design: localDesign, storage: "local-fallback" }),
          ownerCookieValue,
          shouldSetOwnerCookie
        );
      }

      return applyOwnerCookie(
        NextResponse.json(
          { error: "Failed to save design", details: createdLegacyError.message },
          { status: 500 }
        ),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    const designKey = normalizeHierarchySegment(name, "untitled-design");
    return applyOwnerCookie(
      NextResponse.json({
        design: {
          ...createdLegacy,
          team_slug: "default-team",
          project_code: "default-project",
          design_key: designKey,
          version: 1,
          gitlab_path: `default-team/default-project/${designKey}/v1.json`,
        },
      }),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  }

  const { data: existing, error: existingError } = await supabase
    .from("workflow_canvas_designs")
    .select("*")
    .eq("id", id)
    .eq("user_id", ownerId)
    .maybeSingle();

  if (existingError) {
    if (isConnectivityError(existingError.message)) {
      const localExisting = await getLocalDesign(ownerId, id);
      if (!localExisting) {
        return applyOwnerCookie(
          NextResponse.json({ error: "Design not found" }, { status: 404 }),
          ownerCookieValue,
          shouldSetOwnerCookie
        );
      }

      const name =
        typeof body.name === "string"
          ? body.name.trim() || "Untitled design"
          : localExisting.name;
      const nodes = Array.isArray(body.nodes) ? body.nodes : [];
      const edges = Array.isArray(body.edges) ? body.edges : [];
      const teamSlug = normalizeHierarchySegment(
        body.teamSlug ?? localExisting.team_slug,
        "default-team"
      );
      const projectCode = normalizeHierarchySegment(
        body.projectCode ?? localExisting.project_code,
        "default-project"
      );
      const designKey = normalizeHierarchySegment(
        body.designKey ?? localExisting.design_key ?? name,
        "untitled-design"
      );
      const version =
        (await getLatestLocalVersion(ownerId, teamSlug, projectCode, designKey)) + 1;
      const gitlabPath = `${teamSlug}/${projectCode}/${designKey}/v${version}.json`;

      const localDesign = await createLocalDesign({
        id: crypto.randomUUID(),
        user_id: ownerId,
        name,
        nodes,
        edges,
        team_slug: teamSlug,
        project_code: projectCode,
        design_key: designKey,
        version,
        gitlab_path: gitlabPath,
      });

      return applyOwnerCookie(
        NextResponse.json({ design: localDesign, storage: "local-fallback" }),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    return applyOwnerCookie(
      NextResponse.json(
      { error: "Failed to load design for versioning", details: existingError.message },
      { status: 500 }
      ),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  }

  if (!existing) {
    return applyOwnerCookie(
      NextResponse.json({ error: "Design not found" }, { status: 404 }),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  }

  const existingRecord = (existing ?? {}) as Record<string, unknown>;
  const existingName =
    typeof existingRecord.name === "string" ? existingRecord.name : "Untitled design";
  const name =
    typeof body.name === "string" ? body.name.trim() || "Untitled design" : existingName;
  const nodes = Array.isArray(body.nodes) ? body.nodes : [];
  const edges = Array.isArray(body.edges) ? body.edges : [];
  const teamSlug = normalizeHierarchySegment(
    body.teamSlug ?? existingRecord.team_slug,
    "default-team"
  );
  const projectCode = normalizeHierarchySegment(
    body.projectCode ?? existingRecord.project_code,
    "default-project"
  );
  const designKey = normalizeHierarchySegment(
    body.designKey ?? existingRecord.design_key ?? name,
    "untitled-design"
  );
  const currentVersion =
    typeof existingRecord.version === "number" ? existingRecord.version : Number(existingRecord.version ?? 0);
  const version = (Number.isFinite(currentVersion) ? currentVersion : 0) + 1;
  const gitlabPath = `${teamSlug}/${projectCode}/${designKey}/v${version}.json`;

  const { data, error } = await supabase
    .from("workflow_canvas_designs")
    .insert({
      id: crypto.randomUUID(),
      user_id: ownerId,
      name,
      nodes,
      edges,
      team_slug: teamSlug,
      project_code: projectCode,
      design_key: designKey,
      version,
      gitlab_path: gitlabPath,
    })
    .select("*")
    .single();

  if (error) {
    if (isConnectivityError(error.message)) {
      const localDesign = await createLocalDesign({
        id: crypto.randomUUID(),
        user_id: ownerId,
        name,
        nodes,
        edges,
        team_slug: teamSlug,
        project_code: projectCode,
        design_key: designKey,
        version,
        gitlab_path: gitlabPath,
      });

      return applyOwnerCookie(
        NextResponse.json({ design: localDesign, storage: "local-fallback" }),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    return applyOwnerCookie(
      NextResponse.json(
      { error: "Failed to create new design version", details: error.message },
      { status: 500 }
      ),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  }

  return applyOwnerCookie(
    NextResponse.json({ design: data }),
    ownerCookieValue,
    shouldSetOwnerCookie
  );
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { ownerId, ownerCookieValue, shouldSetOwnerCookie } = await resolveOwnerId(request);
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("workflow_canvas_designs")
    .delete()
    .eq("id", id)
    .eq("user_id", ownerId);

  if (error) {
    if (isConnectivityError(error.message)) {
      const deleted = await deleteLocalDesign(ownerId, id);
      if (!deleted) {
        return applyOwnerCookie(
          NextResponse.json({ error: "Design not found" }, { status: 404 }),
          ownerCookieValue,
          shouldSetOwnerCookie
        );
      }

      return applyOwnerCookie(
        NextResponse.json({ ok: true, storage: "local-fallback" }),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    return applyOwnerCookie(
      NextResponse.json(
      { error: "Failed to delete design", details: error.message },
      { status: 500 }
      ),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  }

  return applyOwnerCookie(
    NextResponse.json({ ok: true }),
    ownerCookieValue,
    shouldSetOwnerCookie
  );
}
