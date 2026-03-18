import { NextRequest, NextResponse } from "next/server";
import yaml from "js-yaml";
import { auth } from "@/lib/auth";
import { commitDesign } from "@/lib/idac/gitlab-client";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  getLocalDesignVersion,
  getLocalLatestDesignByMaster,
} from "@/lib/workflow-canvas-local-store";

const OWNER_ID_COOKIE = "workflow_canvas_owner_id";
const OWNER_ID_HEADER = "x-workflow-canvas-owner-id";
const MODEL_COLUMNS = ["master_id", "project_code", "version"] as const;

interface RouteParams {
  params: Promise<{ id: string }>;
}

type PersistedDesign = {
  id: string;
  master_id?: string;
  name: string;
  team_slug?: string;
  project_code?: string;
  design_key?: string;
  version?: number;
  nodes?: unknown[];
  edges?: unknown[];
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

const supportsMasterModel = async (supabase: ReturnType<typeof getSupabaseAdmin>) => {
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
};

const buildYamlFromDesign = (masterId: string, design: PersistedDesign) => {
  const doc = {
    project: design.project_code ?? "default-project",
    team: design.team_slug ?? "default-team",
    design: design.design_key ?? design.name,
    masterId,
    version: design.version ?? 1,
    exportedAt: new Date().toISOString(),
    graph: {
      nodes: Array.isArray(design.nodes) ? design.nodes : [],
      edges: Array.isArray(design.edges) ? design.edges : [],
    },
  };

  return yaml.dump(doc, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
  });
};

const fetchDesignFromSupabase = async (
  supabase: ReturnType<typeof getSupabaseAdmin>,
  ownerId: string,
  masterId: string,
  versionId?: string
): Promise<PersistedDesign | null> => {
  const hasMasterModel = await supportsMasterModel(supabase);

  if (!hasMasterModel) {
    const { data, error } = await supabase
      .from("workflow_canvas_designs")
      .select("*")
      .eq("user_id", ownerId)
      .eq("id", masterId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    return {
      ...data,
      master_id: data.id,
      version: 1,
      project_code: data.project_code ?? "default-project",
    } satisfies PersistedDesign;
  }

  let query = supabase
    .from("workflow_canvas_designs")
    .select("*")
    .eq("user_id", ownerId)
    .eq("master_id", masterId);

  query = versionId
    ? query.eq("id", versionId)
    : query.order("version", { ascending: false }).limit(1);

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as PersistedDesign | null) ?? null;
};

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { ownerId, ownerCookieValue, shouldSetOwnerCookie } = await resolveOwnerId(request);
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.GITLAB_URL || !process.env.GITLAB_API_TOKEN) {
    return applyOwnerCookie(
      NextResponse.json(
        { error: "GitLab integration is not configured on the server." },
        { status: 400 }
      ),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  }

  const { id: masterId } = await params;
  const body = (await request.json().catch(() => ({}))) as { versionId?: string };
  const versionId = typeof body.versionId === "string" && body.versionId.trim() ? body.versionId : undefined;

  let design: PersistedDesign | null = null;

  try {
    const supabase = getSupabaseAdmin();
    design = await fetchDesignFromSupabase(supabase, ownerId, masterId, versionId);
  } catch {
    design = versionId
      ? await getLocalDesignVersion(ownerId, masterId, versionId)
      : await getLocalLatestDesignByMaster(ownerId, masterId);
  }

  if (!design) {
    return applyOwnerCookie(
      NextResponse.json({ error: "Design not found" }, { status: 404 }),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  }

  const projectCode = design.project_code ?? "default-project";
  const version = Math.max(design.version ?? 1, 1);
  const yamlContent = buildYamlFromDesign(masterId, design);

  let commit: { commitSha: string; webUrl: string };
  try {
    commit = await commitDesign(
      projectCode,
      version,
      yamlContent,
      `Workflow canvas ${masterId} v${version}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload to GitLab";
    return applyOwnerCookie(
      NextResponse.json({ error: "GitLab upload failed", details: message }, { status: 500 }),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  }

  return applyOwnerCookie(
    NextResponse.json({
      ok: true,
      masterId,
      version,
      commitSha: commit.commitSha,
      webUrl: commit.webUrl,
    }),
    ownerCookieValue,
    shouldSetOwnerCookie
  );
}
