import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  createLocalDesign,
  getLatestLocalVersionByMaster,
  getLocalDesignVersion,
  getLocalLatestDesignByMaster,
  listLocalVersions,
} from "@/lib/workflow-canvas-local-store";

const OWNER_ID_COOKIE = "workflow_canvas_owner_id";
const OWNER_ID_HEADER = "x-workflow-canvas-owner-id";

interface RouteParams {
  params: Promise<{ id: string }>;
}

type DesignRow = {
  id: string;
  master_id?: string;
  user_id: string;
  name: string;
  nodes: unknown[];
  edges: unknown[];
  team_slug: string;
  project_code: string;
  design_key: string;
  version: number;
  gitlab_path: string;
};

const normalizeGuestOwnerId = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
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
    return { ownerId: session.user.id, ownerCookieValue: null, shouldSetOwnerCookie: false };
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
  if (!ownerCookieValue || !shouldSetOwnerCookie) return response;

  response.cookies.set({
    name: OWNER_ID_COOKIE,
    value: ownerCookieValue,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });

  return response;
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

const isMissingMasterColumnError = (message: string | undefined) => {
  const source = (message ?? "").toLowerCase();
  return source.includes("master_id") && source.includes("column");
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { ownerId, ownerCookieValue, shouldSetOwnerCookie } = await resolveOwnerId(request);
  const { id: masterId } = await params;
  const versionId = request.nextUrl.searchParams.get("versionId");

  try {
    const supabase = getSupabaseAdmin();

    try {
      let query = supabase
        .from("workflow_canvas_designs")
        .select("*")
        .eq("user_id", ownerId)
        .eq("master_id", masterId);

      query = versionId
        ? query.eq("id", versionId)
        : query.order("version", { ascending: false }).limit(1);

      const { data, error } = await query.maybeSingle();

      if (error && !isMissingMasterColumnError(error.message)) {
        if (isConnectivityError(error.message)) throw error;
        return applyOwnerCookie(
          NextResponse.json({ error: "Failed to fetch design", details: error.message }, { status: 500 }),
          ownerCookieValue,
          shouldSetOwnerCookie
        );
      }

      if (!error && data) {
        const { data: versionsData } = await supabase
          .from("workflow_canvas_designs")
          .select("id, master_id, version, created_at, updated_at, name")
          .eq("user_id", ownerId)
          .eq("master_id", masterId)
          .order("version", { ascending: false });

        return applyOwnerCookie(
          NextResponse.json({ design: data, versions: versionsData ?? [], storage: "supabase" }),
          ownerCookieValue,
          shouldSetOwnerCookie
        );
      }
    } catch {
      // noop
    }

    const { data, error } = await supabase
      .from("workflow_canvas_designs")
      .select("*")
      .eq("id", masterId)
      .eq("user_id", ownerId)
      .maybeSingle();

    if (error) {
      if (isConnectivityError(error.message)) throw error;
      return applyOwnerCookie(
        NextResponse.json({ error: "Failed to fetch design", details: error.message }, { status: 500 }),
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

    return applyOwnerCookie(
      NextResponse.json({
        design: { ...data, master_id: data.id, version: 1 },
        versions: [{ id: data.id, master_id: data.id, version: 1, name: data.name }],
        storage: "supabase",
      }),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  } catch {
    const design = versionId
      ? await getLocalDesignVersion(ownerId, masterId, versionId)
      : await getLocalLatestDesignByMaster(ownerId, masterId);

    if (!design) {
      return applyOwnerCookie(
        NextResponse.json({ error: "Design not found" }, { status: 404 }),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    const versions = await listLocalVersions(ownerId, masterId);
    return applyOwnerCookie(
      NextResponse.json({ design, versions, storage: "local-fallback" }),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { ownerId, ownerCookieValue, shouldSetOwnerCookie } = await resolveOwnerId(request);
  const { id: masterId } = await params;
  const body = await request.json();
  const nodes = Array.isArray(body.nodes) ? body.nodes : [];
  const edges = Array.isArray(body.edges) ? body.edges : [];

  try {
    const supabase = getSupabaseAdmin();

    const latestByMaster = await supabase
      .from("workflow_canvas_designs")
      .select("*")
      .eq("user_id", ownerId)
      .eq("master_id", masterId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestByMaster.error) {
      if (isMissingMasterColumnError(latestByMaster.error.message)) {
        return applyOwnerCookie(
          NextResponse.json(
            { error: "Master version model not available. Apply latest migration before versioned saves." },
            { status: 400 }
          ),
          ownerCookieValue,
          shouldSetOwnerCookie
        );
      }

      if (isConnectivityError(latestByMaster.error.message)) throw latestByMaster.error;
      return applyOwnerCookie(
        NextResponse.json(
          { error: "Failed to save design", details: latestByMaster.error.message },
          { status: 500 }
        ),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    const latest = latestByMaster.data as DesignRow | null;
    if (!latest) {
      return applyOwnerCookie(
        NextResponse.json({ error: "Design not found" }, { status: 404 }),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    const version = (latest.version ?? 0) + 1;
    const gitlabPath = `${latest.team_slug}/${latest.project_code}/${latest.design_key}/v${version}.json`;

    const { data, error } = await supabase
      .from("workflow_canvas_designs")
      .insert({
        id: crypto.randomUUID(),
        master_id: masterId,
        user_id: ownerId,
        name: latest.name,
        nodes,
        edges,
        team_slug: latest.team_slug,
        project_code: latest.project_code,
        design_key: latest.design_key,
        version,
        gitlab_path: gitlabPath,
      })
      .select("*")
      .single();

    if (error) {
      if (isConnectivityError(error.message)) throw error;
      return applyOwnerCookie(
        NextResponse.json({ error: "Failed to save design", details: error.message }, { status: 500 }),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    const { data: versionsData } = await supabase
      .from("workflow_canvas_designs")
      .select("id, master_id, version, created_at, updated_at, name")
      .eq("user_id", ownerId)
      .eq("master_id", masterId)
      .order("version", { ascending: false });

    return applyOwnerCookie(
      NextResponse.json({ design: data, versions: versionsData ?? [], storage: "supabase" }),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  } catch {
    const latest = await getLocalLatestDesignByMaster(ownerId, masterId);
    if (!latest) {
      return applyOwnerCookie(
        NextResponse.json({ error: "Design not found" }, { status: 404 }),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    const version = (await getLatestLocalVersionByMaster(ownerId, masterId)) + 1;
    const design = await createLocalDesign({
      id: crypto.randomUUID(),
      master_id: masterId,
      user_id: ownerId,
      name: latest.name,
      nodes,
      edges,
      team_slug: latest.team_slug,
      project_code: latest.project_code,
      design_key: latest.design_key,
      version,
      gitlab_path: `${latest.team_slug}/${latest.project_code}/${latest.design_key}/v${version}.json`,
    });

    const versions = await listLocalVersions(ownerId, masterId);
    return applyOwnerCookie(
      NextResponse.json({ design, versions, storage: "local-fallback" }),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { ownerCookieValue, shouldSetOwnerCookie } = await resolveOwnerId(request);
  const response = NextResponse.json(
    {
      error:
        "Workflow canvas versions are immutable. Deletion is disabled to preserve full version history.",
    },
    { status: 405 }
  );

  return applyOwnerCookie(response, ownerCookieValue, shouldSetOwnerCookie);
}
