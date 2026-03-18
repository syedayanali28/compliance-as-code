import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchLocalDesigns } from "@/lib/workflow-canvas-local-store";
import { getSupabaseAdmin } from "@/lib/supabase";

const OWNER_ID_COOKIE = "workflow_canvas_owner_id";
const OWNER_ID_HEADER = "x-workflow-canvas-owner-id";

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

const isConnectivityFailureText = (text: string | null | undefined) => {
  const source = (text ?? "").toLowerCase();
  return (
    source.includes("fetch failed") ||
    source.includes("connect timeout") ||
    source.includes("und_err_connect_timeout") ||
    source.includes("self-signed certificate") ||
    source.includes("self_signed_cert_in_chain") ||
    source.includes("econnrefused") ||
    source.includes("enotfound")
  );
};

export async function GET(request: NextRequest) {
  const { ownerId, ownerCookieValue, shouldSetOwnerCookie } = await resolveOwnerId(request);

  const name = request.nextUrl.searchParams.get("name")?.trim() ?? "";
  const teamSlug = request.nextUrl.searchParams.get("teamSlug")?.trim() ?? "";
  const projectCode = request.nextUrl.searchParams.get("projectCode")?.trim() ?? "";
  const versionRaw = request.nextUrl.searchParams.get("version")?.trim() ?? "";
  const version = versionRaw ? Number.parseInt(versionRaw, 10) : undefined;

  try {
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("workflow_canvas_designs")
      .select("id, design_id, master_id, name, team_slug, project_code, design_key, version, gitlab_path, created_at, updated_at")
      .eq("user_id", ownerId)
      .order("updated_at", { ascending: false });

    if (name) {
      query = query.ilike("name", `%${name}%`);
    }

    if (teamSlug) {
      query = query.ilike("team_slug", `%${teamSlug}%`);
    }

    if (projectCode) {
      query = query.ilike("project_code", `%${projectCode}%`);
    }

    if (typeof version === "number" && Number.isFinite(version)) {
      query = query.eq("version", version);
    }

    const { data, error } = await query;

    if (error) {
      if (!isConnectivityFailureText(error.message)) {
        return applyOwnerCookie(
          NextResponse.json(
            { error: "Failed to search designs", details: error.message },
            { status: 500 }
          ),
          ownerCookieValue,
          shouldSetOwnerCookie
        );
      }

      const local = await searchLocalDesigns(ownerId, {
        name,
        teamSlug,
        projectCode,
        version,
      });

      return applyOwnerCookie(
        NextResponse.json({ results: local, storage: "local-fallback" }),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    return applyOwnerCookie(
      NextResponse.json({ results: data ?? [], storage: "supabase" }),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  } catch {
    const local = await searchLocalDesigns(ownerId, {
      name,
      teamSlug,
      projectCode,
      version,
    });

    return applyOwnerCookie(
      NextResponse.json({ results: local, storage: "local-fallback" }),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  }
}
