import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  createLocalDesign,
  getLatestLocalVersionByMaster,
  getLocalLatestDesignByMaster,
  listLocalDesignMasters,
  listLocalVersions,
} from "@/lib/workflow-canvas-local-store";

const OWNER_ID_COOKIE = "workflow_canvas_owner_id";
const OWNER_ID_HEADER = "x-workflow-canvas-owner-id";

const MODEL_COLUMNS = [
  "master_id",
  "team_slug",
  "project_code",
  "design_key",
  "version",
  "gitlab_path",
] as const;

type DesignRow = {
  id: string;
  master_id: string;
  user_id: string;
  name: string;
  nodes: unknown[];
  edges: unknown[];
  team_slug: string;
  project_code: string;
  design_key: string;
  version: number;
  gitlab_path: string;
  created_at: string;
  updated_at: string;
};

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

const isConnectivityError = (message: string | undefined) => {
  const source = (message ?? "").toLowerCase();
  return (
    source.includes("fetch failed") ||
    source.includes("econnrefused") ||
    source.includes("enotfound") ||
    source.includes("network")
  );
};

const supportsMasterModel = async (supabase: ReturnType<typeof getSupabaseAdmin>) => {
  try {
    const { data, error } = await supabase
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", "workflow_canvas_designs")
      .in("column_name", [...MODEL_COLUMNS]);

    if (error || !data) {
      return false;
    }

    const present = new Set(data.map((row) => String(row.column_name)));
    return MODEL_COLUMNS.every((column) => present.has(column));
  } catch {
    return false;
  }
};

const toVersionSummary = (row: DesignRow) => ({
  id: row.id,
  master_id: row.master_id,
  version: row.version,
  created_at: row.created_at,
  updated_at: row.updated_at,
  name: row.name,
});

export async function GET(request: NextRequest) {
  const { ownerId, ownerCookieValue, shouldSetOwnerCookie } = await resolveOwnerId(request);

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch (error) {
    const localDesigns = await listLocalDesignMasters(ownerId);
    return applyOwnerCookie(
      NextResponse.json({
        designs: localDesigns,
        storage: "local-fallback",
        details: error instanceof Error ? error.message : "Supabase unavailable",
      }),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  }

  const hasMasterModel = await supportsMasterModel(supabase);

  if (!hasMasterModel) {
    const { data, error } = await supabase
      .from("workflow_canvas_designs")
      .select("id, name, created_at, updated_at")
      .eq("user_id", ownerId)
      .order("updated_at", { ascending: false });

    if (error) {
      if (isConnectivityError(error.message)) {
        const localDesigns = await listLocalDesignMasters(ownerId);
        return applyOwnerCookie(
          NextResponse.json({ designs: localDesigns, storage: "local-fallback" }),
          ownerCookieValue,
          shouldSetOwnerCookie
        );
      }

      return applyOwnerCookie(
        NextResponse.json({ error: "Failed to list designs", details: error.message }, { status: 500 }),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    return applyOwnerCookie(
      NextResponse.json({ designs: data ?? [], storage: "supabase" }),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  }

  const { data, error } = await supabase
    .from("workflow_canvas_designs")
    .select("*")
    .eq("user_id", ownerId)
    .order("updated_at", { ascending: false });

  if (error) {
    if (isConnectivityError(error.message)) {
      const localDesigns = await listLocalDesignMasters(ownerId);
      return applyOwnerCookie(
        NextResponse.json({ designs: localDesigns, storage: "local-fallback" }),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    return applyOwnerCookie(
      NextResponse.json({ error: "Failed to list designs", details: error.message }, { status: 500 }),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  }

  const byMaster = new Map<string, DesignRow>();
  for (const row of (data ?? []) as DesignRow[]) {
    const current = byMaster.get(row.master_id);
    if (!current || row.version > current.version) {
      byMaster.set(row.master_id, row);
    }
  }

  return applyOwnerCookie(
    NextResponse.json({ designs: [...byMaster.values()], storage: "supabase" }),
    ownerCookieValue,
    shouldSetOwnerCookie
  );
}

export async function POST(request: NextRequest) {
  const { ownerId, ownerCookieValue, shouldSetOwnerCookie } = await resolveOwnerId(request);

  const body = await request.json();
  const requestedId = typeof body.id === "string" ? body.id.trim() : "";
  const designId = requestedId || crypto.randomUUID();
  const providedMasterId =
    typeof body.masterId === "string" && body.masterId.trim()
      ? body.masterId.trim()
      : "";
  const masterId = providedMasterId || crypto.randomUUID();

  const requestedName =
    typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Untitled design";
  const requestedTeam = normalizeHierarchySegment(body.teamSlug, "default-team");
  const requestedProject = normalizeHierarchySegment(body.projectCode, "default-project");
  const requestedDesignKey = normalizeHierarchySegment(body.designKey ?? requestedName, "untitled-design");
  const nodes = Array.isArray(body.nodes) ? body.nodes : [];
  const edges = Array.isArray(body.edges) ? body.edges : [];

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    const localLatest = await getLocalLatestDesignByMaster(ownerId, masterId);
    const lockedName = localLatest?.name ?? requestedName;
    const lockedTeam = localLatest?.team_slug ?? requestedTeam;
    const lockedProject = localLatest?.project_code ?? requestedProject;
    const lockedDesignKey = localLatest?.design_key ?? requestedDesignKey;
    const version = (await getLatestLocalVersionByMaster(ownerId, masterId)) + 1;
    const gitlabPath = `${lockedTeam}/${lockedProject}/${lockedDesignKey}/v${version}.json`;

    const localDesign = await createLocalDesign({
      id: designId,
      master_id: masterId,
      user_id: ownerId,
      name: lockedName,
      nodes,
      edges,
      team_slug: lockedTeam,
      project_code: lockedProject,
      design_key: lockedDesignKey,
      version,
      gitlab_path: gitlabPath,
    });

    const versions = await listLocalVersions(ownerId, masterId);
    return applyOwnerCookie(
      NextResponse.json({ design: localDesign, versions, storage: "local-fallback" }, { status: 201 }),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  }

  const hasMasterModel = await supportsMasterModel(supabase);

  if (!hasMasterModel) {
    const { data, error } = await supabase
      .from("workflow_canvas_designs")
      .insert({
        id: designId,
        user_id: ownerId,
        name: requestedName,
        nodes,
        edges,
      })
      .select("id, name, nodes, edges, created_at, updated_at")
      .single();

    if (error) {
      if (isConnectivityError(error.message)) {
        const version = (await getLatestLocalVersionByMaster(ownerId, masterId)) + 1;
        const gitlabPath = `${requestedTeam}/${requestedProject}/${requestedDesignKey}/v${version}.json`;
        const localDesign = await createLocalDesign({
          id: designId,
          master_id: masterId,
          user_id: ownerId,
          name: requestedName,
          nodes,
          edges,
          team_slug: requestedTeam,
          project_code: requestedProject,
          design_key: requestedDesignKey,
          version,
          gitlab_path: gitlabPath,
        });
        const versions = await listLocalVersions(ownerId, masterId);
        return applyOwnerCookie(
          NextResponse.json({ design: localDesign, versions, storage: "local-fallback" }, { status: 201 }),
          ownerCookieValue,
          shouldSetOwnerCookie
        );
      }

      return applyOwnerCookie(
        NextResponse.json({ error: "Failed to create design", details: error.message }, { status: 500 }),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    return applyOwnerCookie(
      NextResponse.json(
        {
          design: {
            ...data,
            master_id: designId,
            team_slug: requestedTeam,
            project_code: requestedProject,
            design_key: requestedDesignKey,
            version: 1,
            gitlab_path: `${requestedTeam}/${requestedProject}/${requestedDesignKey}/v1.json`,
          },
          versions: [{ id: designId, master_id: designId, version: 1, name: requestedName }],
          storage: "supabase",
        },
        { status: 201 }
      ),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  }

  const { data: latest } = await supabase
    .from("workflow_canvas_designs")
    .select("*")
    .eq("user_id", ownerId)
    .eq("master_id", masterId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lockedName = latest?.name ?? requestedName;
  const lockedTeam = latest?.team_slug ?? requestedTeam;
  const lockedProject = latest?.project_code ?? requestedProject;
  const lockedDesignKey = latest?.design_key ?? requestedDesignKey;
  const version = (latest?.version ?? 0) + 1;
  const gitlabPath = `${lockedTeam}/${lockedProject}/${lockedDesignKey}/v${version}.json`;

  const { data, error } = await supabase
    .from("workflow_canvas_designs")
    .insert({
      id: designId,
      master_id: masterId,
      user_id: ownerId,
      name: lockedName,
      nodes,
      edges,
      team_slug: lockedTeam,
      project_code: lockedProject,
      design_key: lockedDesignKey,
      version,
      gitlab_path: gitlabPath,
    })
    .select("*")
    .single();

  if (error) {
    if (isConnectivityError(error.message)) {
      const localLatest = await getLocalLatestDesignByMaster(ownerId, masterId);
      const localName = localLatest?.name ?? requestedName;
      const localTeam = localLatest?.team_slug ?? requestedTeam;
      const localProject = localLatest?.project_code ?? requestedProject;
      const localKey = localLatest?.design_key ?? requestedDesignKey;
      const localVersion = (await getLatestLocalVersionByMaster(ownerId, masterId)) + 1;
      const localDesign = await createLocalDesign({
        id: designId,
        master_id: masterId,
        user_id: ownerId,
        name: localName,
        nodes,
        edges,
        team_slug: localTeam,
        project_code: localProject,
        design_key: localKey,
        version: localVersion,
        gitlab_path: `${localTeam}/${localProject}/${localKey}/v${localVersion}.json`,
      });
      const versions = await listLocalVersions(ownerId, masterId);
      return applyOwnerCookie(
        NextResponse.json({ design: localDesign, versions, storage: "local-fallback" }, { status: 201 }),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    return applyOwnerCookie(
      NextResponse.json({ error: "Failed to create design", details: error.message }, { status: 500 }),
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
    NextResponse.json({ design: data, versions: versionsData ?? [toVersionSummary(data as DesignRow)], storage: "supabase" }, { status: 201 }),
    ownerCookieValue,
    shouldSetOwnerCookie
  );
}
