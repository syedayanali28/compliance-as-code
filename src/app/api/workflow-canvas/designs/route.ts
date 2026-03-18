import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  listLocalDesignMasters,
  mirrorLocalDesign,
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

const normalizeHierarchySegment = (value: unknown, fallback: string) => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]+/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^-|-$/g, "");

  return normalized || fallback;
};

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

const normalizeDesign = (row: DesignRow) => ({
  ...row,
  design_id: row.design_id ?? row.id,
  nodes: Array.isArray(row.nodes) ? row.nodes : [],
  edges: Array.isArray(row.edges) ? row.edges : [],
});

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

const toVersionSummary = (row: DesignRow) => ({
  id: row.id,
  design_id: row.design_id ?? row.id,
  master_id: row.master_id,
  version: row.version,
  created_at: row.created_at,
  updated_at: row.updated_at,
  name: row.name,
});

const formatUnknownError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : "Unknown error";
};

const inferRemediationHint = (details: string) => {
  const normalized = details.toLowerCase();

  if (normalized.includes("design_id") && normalized.includes("column")) {
    return "Missing DB column 'design_id'. Apply migration 008_workflow_canvas_design_id.sql.";
  }

  if (normalized.includes("master_id") && normalized.includes("column")) {
    return "Missing DB column 'master_id'. Apply migration 006_workflow_canvas_master_id.sql.";
  }

  return undefined;
};

type DebugErrorResponseArgs = {
  requestId: string;
  phase: string;
  status: number;
  message: string;
  error: unknown;
  ownerCookieValue: string | null;
  shouldSetOwnerCookie: boolean;
  extra?: Record<string, unknown>;
};

const buildDebugErrorResponse = (args: DebugErrorResponseArgs) => {
  const details = formatUnknownError(args.error);
  const payload: Record<string, unknown> = {
    error: args.message,
    details,
    remediation: inferRemediationHint(details),
    requestId: args.requestId,
    phase: args.phase,
  };

  if (args.extra) {
    Object.assign(payload, args.extra);
  }

  const response = NextResponse.json(payload, { status: args.status });

  return applyOwnerCookie(response, args.ownerCookieValue, args.shouldSetOwnerCookie);
};

const logCreateDesignFailure = (
  requestId: string,
  phase: string,
  context: Record<string, unknown>,
  error: unknown
) => {
  console.error("[workflow-canvas][create-design][error]", {
    requestId,
    phase,
    ...context,
    error,
  });
};

export async function GET(request: NextRequest) {
  const { ownerId, ownerCookieValue, shouldSetOwnerCookie } = await resolveOwnerId(request);

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("workflow_canvas_designs")
      .select("*")
      .eq("user_id", ownerId)
      .order("version", { ascending: false })
      .order("updated_at", { ascending: false });

    if (error) {
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
        byMaster.set(row.master_id, normalizeDesign(row));
      }
    }

    return applyOwnerCookie(
      NextResponse.json({ designs: [...byMaster.values()], storage: "supabase" }),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  } catch (error) {
    if (!isWorkflowCanvasLocalFallbackEnabled()) {
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

    const localDesigns = await listLocalDesignMasters(ownerId);
    return applyOwnerCookie(
      NextResponse.json({ designs: localDesigns, storage: "local-fallback" }),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  }
}

export async function POST(request: NextRequest) {
  const { ownerId, ownerCookieValue, shouldSetOwnerCookie } = await resolveOwnerId(request);
  const requestId = crypto.randomUUID();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch (error) {
    logCreateDesignFailure(
      requestId,
      "parse_request_body",
      {
        ownerId,
      },
      error
    );

    return buildDebugErrorResponse({
      requestId,
      phase: "parse_request_body",
      status: 400,
      message: "Invalid request payload",
      error,
      ownerCookieValue,
      shouldSetOwnerCookie,
    });
  }

  const providedMasterId =
    typeof body.masterId === "string" && body.masterId.trim() ? body.masterId.trim() : "";
  const requestedName =
    typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Untitled design";
  const requestedTeam = normalizeHierarchySegment(body.teamSlug, "default-team");
  const requestedProject = normalizeHierarchySegment(body.projectCode, "default-project");
  const requestedDesignKey = normalizeHierarchySegment(body.designKey ?? requestedName, "untitled-design");
  const nodes = Array.isArray(body.nodes) ? body.nodes : [];
  const edges = Array.isArray(body.edges) ? body.edges : [];

  if (!body.name || typeof body.name !== "string") {
    logCreateDesignFailure(
      requestId,
      "validate_payload",
      {
        ownerId,
        bodyKeys: Object.keys(body),
        hasName: typeof body.name === "string",
      },
      "Field 'name' must be a non-empty string"
    );

    return buildDebugErrorResponse({
      requestId,
      phase: "validate_payload",
      status: 400,
      message: "Invalid request payload",
      error: "Field 'name' must be a non-empty string",
      ownerCookieValue,
      shouldSetOwnerCookie,
    });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: latest, error: latestError } = providedMasterId
      ? await supabase
          .from("workflow_canvas_designs")
          .select("*")
          .eq("user_id", ownerId)
          .eq("master_id", providedMasterId)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null, error: null };

    if (latestError) {
      logCreateDesignFailure(
        requestId,
        "fetch_latest_version",
        {
          ownerId,
          providedMasterId,
        },
        latestError
      );

      return buildDebugErrorResponse({
        requestId,
        phase: "fetch_latest_version",
        status: 500,
        message: "Failed to create design",
        error: latestError.message,
        ownerCookieValue,
        shouldSetOwnerCookie,
        extra: {
          supabaseCode: latestError.code,
          supabaseHint: latestError.hint,
          supabaseDetails: latestError.details,
        },
      });
    }

    const masterId = providedMasterId || crypto.randomUUID();
    const lockedName = latest?.name ?? requestedName;
    const lockedTeam = latest?.team_slug ?? requestedTeam;
    const lockedProject = latest?.project_code ?? requestedProject;
    const lockedDesignKey = latest?.design_key ?? requestedDesignKey;
    const version = (latest?.version ?? 0) + 1;
    const gitlabPath = `${lockedTeam}/${lockedProject}/${lockedDesignKey}/v${version}.json`;

    const { data, error } = await supabase
      .from("workflow_canvas_designs")
      .insert({
        id: crypto.randomUUID(),
        design_id: crypto.randomUUID(),
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
      logCreateDesignFailure(
        requestId,
        "insert_design_row",
        {
          ownerId,
          masterId,
          attemptedVersion: version,
          requestedName,
          requestedTeam,
          requestedProject,
          requestedDesignKey,
          nodesCount: nodes.length,
          edgesCount: edges.length,
        },
        error
      );

      return buildDebugErrorResponse({
        requestId,
        phase: "insert_design_row",
        status: 500,
        message: "Failed to create design",
        error: error.message,
        ownerCookieValue,
        shouldSetOwnerCookie,
        extra: {
          supabaseCode: error.code,
          supabaseHint: error.hint,
          supabaseDetails: error.details,
          masterId,
          attemptedVersion: version,
        },
      });
    }

    const normalized = normalizeDesign(data as DesignRow);

    if (isWorkflowCanvasLocalMirrorEnabled()) {
      await mirrorLocalDesign({
        id: normalized.id,
        design_id: normalized.design_id,
        master_id: normalized.master_id,
        user_id: normalized.user_id,
        name: normalized.name,
        nodes: normalized.nodes,
        edges: normalized.edges,
        team_slug: normalized.team_slug,
        project_code: normalized.project_code,
        design_key: normalized.design_key,
        version: normalized.version,
        gitlab_path: normalized.gitlab_path ?? "",
      });
    }

    const { data: versionsData } = await supabase
      .from("workflow_canvas_designs")
      .select("id, design_id, master_id, version, created_at, updated_at, name")
      .eq("user_id", ownerId)
      .eq("master_id", masterId)
      .order("version", { ascending: false });

    return applyOwnerCookie(
      NextResponse.json(
        {
          design: normalized,
          versions: versionsData ?? [toVersionSummary(normalized as DesignRow)],
          storage: "supabase",
        },
        { status: 201 }
      ),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  } catch (error) {
    logCreateDesignFailure(
      requestId,
      "supabase_connection",
      {
        ownerId,
        providedMasterId,
        requestedName,
        requestedTeam,
        requestedProject,
        requestedDesignKey,
        nodesCount: nodes.length,
        edgesCount: edges.length,
      },
      error
    );

    if (!isWorkflowCanvasLocalFallbackEnabled()) {
      return buildDebugErrorResponse({
        requestId,
        phase: "supabase_connection",
        status: 503,
        message: "Supabase unavailable",
        error,
        ownerCookieValue,
        shouldSetOwnerCookie,
      });
    }

    return buildDebugErrorResponse({
      requestId,
      phase: "supabase_connection",
      status: 503,
      message: "Supabase unavailable",
      error,
      ownerCookieValue,
      shouldSetOwnerCookie,
      extra: {
        storage: "local-fallback",
      },
    });
  }
}
