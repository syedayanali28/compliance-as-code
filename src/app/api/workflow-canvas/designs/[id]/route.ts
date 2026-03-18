import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getLocalDesignByDesignId,
  getLocalDesign,
  listLocalVersions,
  mirrorLocalDesign,
  saveLocalDesign,
  syncLocalDesignFromRemote,
} from "@/lib/workflow-canvas-local-store";
import {
  isWorkflowCanvasLocalFallbackEnabled,
  isWorkflowCanvasLocalMirrorEnabled,
} from "@/lib/workflow-canvas-storage-mode";
import { getSupabaseAdmin } from "@/lib/supabase";

const OWNER_ID_COOKIE = "workflow_canvas_owner_id";
const OWNER_ID_HEADER = "x-workflow-canvas-owner-id";

type DesignRow = {
  id: string;
  design_id?: string;
  master_id: string;
  user_id: string;
  name: string;
  nodes: unknown[];
  edges: unknown[];
  team_slug: string;
  project_code: string;
  design_key: string;
  version: number;
  gitlab_path: string | null;
  created_at: string;
  updated_at: string;
};

const normalizeDesign = (row: DesignRow) => ({
  ...row,
  design_id: row.design_id ?? row.id,
  nodes: Array.isArray(row.nodes) ? row.nodes : [],
  edges: Array.isArray(row.edges) ? row.edges : [],
});

const toVersionSummary = (row: DesignRow) => ({
  id: row.id,
  design_id: row.design_id ?? row.id,
  master_id: row.master_id,
  version: row.version,
  created_at: row.created_at,
  updated_at: row.updated_at,
  name: row.name,
});

const normalizeGuestOwnerId = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]+/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^-|-$/g, "");

  return normalized || null;
};

const isConnectivityFailureFromUnknown = (error: unknown) => {
  let source = "";
  if (typeof error === "string") {
    source = error.toLowerCase();
  } else if (error instanceof Error) {
    source = error.message.toLowerCase();
  }

  return (
    source.includes("fetch failed") ||
    source.includes("connect timeout") ||
    source.includes("und_err_connect_timeout") ||
    source.includes("econnrefused") ||
    source.includes("enotfound")
  );
};

const isConnectivityFailureText = (text: string | null | undefined) => {
  const source = (text ?? "").toLowerCase();
  return (
    source.includes("fetch failed") ||
    source.includes("connect timeout") ||
    source.includes("und_err_connect_timeout") ||
    source.includes("econnrefused") ||
    source.includes("enotfound")
  );
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
  const ownerId = ownerFromHeader ?? ownerFromCookie ?? "dev";

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ownerId, ownerCookieValue, shouldSetOwnerCookie } = await resolveOwnerId(request);
  const { id: masterId } = await params;

  const versionParam = request.nextUrl.searchParams.get("version");
  const versionIdParam = request.nextUrl.searchParams.get("versionId")?.trim() ?? "";
  const requestedVersion = versionParam ? Number.parseInt(versionParam, 10) : null;

  try {
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("workflow_canvas_designs")
      .select("*")
      .eq("user_id", ownerId)
      .eq("master_id", masterId);

    if (versionIdParam) {
      query = query.or(`design_id.eq.${versionIdParam},id.eq.${versionIdParam}`);
    } else if (requestedVersion !== null && Number.isFinite(requestedVersion)) {
      query = query.eq("version", requestedVersion);
    } else {
      query = query.order("version", { ascending: false }).limit(1);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      if (isConnectivityFailureText(error.message)) {
        const fallback = versionIdParam
          ? await getLocalDesignByDesignId(ownerId, masterId, versionIdParam)
          : await getLocalDesign(ownerId, masterId, requestedVersion ?? undefined);
        if (fallback.design) {
          return applyOwnerCookie(
            NextResponse.json({
              design: fallback.design,
              versions: fallback.versions,
              storage: "local-fallback",
              warning: "Loaded from local JSON because Supabase is unreachable",
            }),
            ownerCookieValue,
            shouldSetOwnerCookie
          );
        }
      }

      return applyOwnerCookie(
        NextResponse.json(
          { error: "Failed to load design", details: error.message },
          { status: 500 }
        ),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    if (!data) {
      return applyOwnerCookie(
        NextResponse.json({ error: "Design not found" }, { status: 404 }),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    const design = normalizeDesign(data as DesignRow);

    if (isWorkflowCanvasLocalMirrorEnabled()) {
      await syncLocalDesignFromRemote({
        id: design.id,
        design_id: design.design_id,
        master_id: design.master_id,
        user_id: design.user_id,
        name: design.name,
        nodes: design.nodes,
        edges: design.edges,
        team_slug: design.team_slug,
        project_code: design.project_code,
        design_key: design.design_key,
        version: design.version,
        gitlab_path: design.gitlab_path ?? "",
      });
    }

    const { data: versionsData, error: versionsError } = await supabase
      .from("workflow_canvas_designs")
      .select("id, design_id, master_id, version, created_at, updated_at, name")
      .eq("user_id", ownerId)
      .eq("master_id", masterId)
      .order("version", { ascending: false });

    if (versionsError) {
      return applyOwnerCookie(
        NextResponse.json(
          {
            design,
            versions: [toVersionSummary(design as DesignRow)],
            storage: "supabase",
            warning: versionsError.message,
          },
          { status: 200 }
        ),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    return applyOwnerCookie(
      NextResponse.json({ design, versions: versionsData ?? [], storage: "supabase" }),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  } catch (error) {
    const allowLocalFallback =
      isWorkflowCanvasLocalFallbackEnabled() || isConnectivityFailureFromUnknown(error);
    if (!allowLocalFallback) {
      return applyOwnerCookie(
        NextResponse.json(
          {
            error: "Supabase unavailable",
            details: error instanceof Error ? error.message : "Unknown error",
          },
          { status: 503 }
        ),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    const fallback = await getLocalDesign(ownerId, masterId, requestedVersion ?? undefined);
    const fallbackById = versionIdParam
      ? await getLocalDesignByDesignId(ownerId, masterId, versionIdParam)
      : null;
    const resolvedFallback = fallbackById ?? fallback;
    if (!resolvedFallback.design) {
      return applyOwnerCookie(
        NextResponse.json({ error: "Design not found" }, { status: 404 }),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    return applyOwnerCookie(
      NextResponse.json({
        design: resolvedFallback.design,
        versions: resolvedFallback.versions,
        storage: "local-fallback",
      }),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ownerId, ownerCookieValue, shouldSetOwnerCookie } = await resolveOwnerId(request);
  const { id: masterId } = await params;

  const body = await request.json();
  const nodes = Array.isArray(body.nodes) ? body.nodes : [];
  const edges = Array.isArray(body.edges) ? body.edges : [];

  try {
    const supabase = getSupabaseAdmin();

    const { data: latest, error: latestError } = await supabase
      .from("workflow_canvas_designs")
      .select("*")
      .eq("user_id", ownerId)
      .eq("master_id", masterId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      if (isConnectivityFailureText(latestError.message)) {
        const existing = await getLocalDesign(ownerId, masterId);
        if (!existing.design) {
          return applyOwnerCookie(
            NextResponse.json({ error: "Design not found" }, { status: 404 }),
            ownerCookieValue,
            shouldSetOwnerCookie
          );
        }

        const nextVersion =
          existing.versions.length > 0
            ? Math.max(...existing.versions.map((versionRow: { version: number }) => versionRow.version)) + 1
            : 1;
        const fallbackDesign = await saveLocalDesign({
          id: crypto.randomUUID(),
          design_id: crypto.randomUUID(),
          master_id: masterId,
          user_id: ownerId,
          name: existing.design.name,
          nodes,
          edges,
          team_slug: existing.design.team_slug,
          project_code: existing.design.project_code,
          design_key: existing.design.design_key,
          version: nextVersion,
          gitlab_path: `${existing.design.team_slug}/${existing.design.project_code}/${existing.design.design_key}/v${nextVersion}.json`,
        });

        const versions = await listLocalVersions(ownerId, masterId);
        return applyOwnerCookie(
          NextResponse.json(
            {
              design: fallbackDesign,
              versions,
              storage: "local-fallback",
              warning: "Saved to local JSON because Supabase is unreachable",
            },
            { status: 201 }
          ),
          ownerCookieValue,
          shouldSetOwnerCookie
        );
      }

      return applyOwnerCookie(
        NextResponse.json(
          { error: "Failed to save design", details: latestError.message },
          { status: 500 }
        ),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    if (!latest) {
      return applyOwnerCookie(
        NextResponse.json({ error: "Design not found" }, { status: 404 }),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    const nextVersion = (latest.version ?? 0) + 1;
    const gitlabPath = `${latest.team_slug}/${latest.project_code}/${latest.design_key}/v${nextVersion}.json`;

    const { data, error } = await supabase
      .from("workflow_canvas_designs")
      .insert({
        id: crypto.randomUUID(),
        design_id: crypto.randomUUID(),
        master_id: latest.master_id,
        user_id: latest.user_id,
        name: latest.name,
        nodes,
        edges,
        team_slug: latest.team_slug,
        project_code: latest.project_code,
        design_key: latest.design_key,
        version: nextVersion,
        gitlab_path: gitlabPath,
      })
      .select("*")
      .single();

    if (error) {
      if (isConnectivityFailureText(error.message)) {
        const existing = await getLocalDesign(ownerId, masterId);
        const nextVersion =
          existing.versions.length > 0
            ? Math.max(...existing.versions.map((versionRow: { version: number }) => versionRow.version)) + 1
            : (latest.version ?? 0) + 1;
        const fallbackDesign = await saveLocalDesign({
          id: crypto.randomUUID(),
          design_id: crypto.randomUUID(),
          master_id: masterId,
          user_id: ownerId,
          name: existing.design?.name ?? latest.name,
          nodes,
          edges,
          team_slug: existing.design?.team_slug ?? latest.team_slug,
          project_code: existing.design?.project_code ?? latest.project_code,
          design_key: existing.design?.design_key ?? latest.design_key,
          version: nextVersion,
          gitlab_path: `${existing.design?.team_slug ?? latest.team_slug}/${existing.design?.project_code ?? latest.project_code}/${existing.design?.design_key ?? latest.design_key}/v${nextVersion}.json`,
        });

        const versions = await listLocalVersions(ownerId, masterId);
        return applyOwnerCookie(
          NextResponse.json(
            {
              design: fallbackDesign,
              versions,
              storage: "local-fallback",
              warning: "Saved to local JSON because Supabase is unreachable",
            },
            { status: 201 }
          ),
          ownerCookieValue,
          shouldSetOwnerCookie
        );
      }

      return applyOwnerCookie(
        NextResponse.json({ error: "Failed to save design", details: error.message }, { status: 500 }),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    const design = normalizeDesign(data as DesignRow);

    if (isWorkflowCanvasLocalMirrorEnabled()) {
      await mirrorLocalDesign({
        id: design.id,
        design_id: design.design_id,
        master_id: design.master_id,
        user_id: design.user_id,
        name: design.name,
        nodes: design.nodes,
        edges: design.edges,
        team_slug: design.team_slug,
        project_code: design.project_code,
        design_key: design.design_key,
        version: design.version,
        gitlab_path: design.gitlab_path ?? "",
      });
    }

    const { data: versionsData } = await supabase
      .from("workflow_canvas_designs")
      .select("id, design_id, master_id, version, created_at, updated_at, name")
      .eq("user_id", ownerId)
      .eq("master_id", masterId)
      .order("version", { ascending: false });

    return applyOwnerCookie(
      NextResponse.json({
        design,
        versions: versionsData ?? [toVersionSummary(design as DesignRow)],
        storage: "supabase",
      }),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  } catch (error) {
    const allowLocalFallback =
      isWorkflowCanvasLocalFallbackEnabled() || isConnectivityFailureFromUnknown(error);
    if (!allowLocalFallback) {
      return applyOwnerCookie(
        NextResponse.json(
          {
            error: "Supabase unavailable",
            details: error instanceof Error ? error.message : "Unknown error",
          },
          { status: 503 }
        ),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    const existing = await getLocalDesign(ownerId, masterId);
    if (!existing.design) {
      return applyOwnerCookie(
        NextResponse.json({ error: "Design not found" }, { status: 404 }),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    const nextVersion =
      existing.versions.length > 0
        ? Math.max(...existing.versions.map((versionRow: { version: number }) => versionRow.version)) + 1
        : 1;
    const fallbackDesign = await saveLocalDesign({
      id: crypto.randomUUID(),
      design_id: crypto.randomUUID(),
      master_id: masterId,
      user_id: ownerId,
      name: existing.design.name,
      nodes,
      edges,
      team_slug: existing.design.team_slug,
      project_code: existing.design.project_code,
      design_key: existing.design.design_key,
      version: nextVersion,
      gitlab_path: `${existing.design.team_slug}/${existing.design.project_code}/${existing.design.design_key}/v${nextVersion}.json`,
    });

    const versions = await listLocalVersions(ownerId, masterId);

    return applyOwnerCookie(
      NextResponse.json(
        {
          design: fallbackDesign,
          versions,
          storage: "local-fallback",
          warning: "Saved to local fallback because Supabase is unavailable",
        },
        { status: 201 }
      ),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  }
}

export async function DELETE() {
  return NextResponse.json(
    {
      error:
        "Delete is disabled. Workflow canvas designs are append-only to preserve version history.",
    },
    { status: 405 }
  );
}
