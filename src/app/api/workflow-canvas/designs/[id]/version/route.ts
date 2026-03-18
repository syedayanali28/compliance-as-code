import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getLatestLocalVersionByMaster } from "@/lib/workflow-canvas-local-store";

const OWNER_ID_COOKIE = "workflow_canvas_owner_id";
const OWNER_ID_HEADER = "x-workflow-canvas-owner-id";

interface RouteParams {
  params: Promise<{ id: string }>;
}

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

const isMissingMasterColumnError = (message: string | undefined) => {
  const source = (message ?? "").toLowerCase();
  return source.includes("master_id") && source.includes("column");
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { ownerId, ownerCookieValue, shouldSetOwnerCookie } = await resolveOwnerId(request);
  const { id: masterId } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const latestByMaster = await supabase
      .from("workflow_canvas_designs")
      .select("version")
      .eq("user_id", ownerId)
      .eq("master_id", masterId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestByMaster.error) {
      return applyOwnerCookie(
        NextResponse.json({ masterId, latestVersion: latestByMaster.data?.version ?? 0 }),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    if (!isMissingMasterColumnError(latestByMaster.error.message)) {
      if (isConnectivityError(latestByMaster.error.message)) {
        throw latestByMaster.error;
      }
      return applyOwnerCookie(
        NextResponse.json(
          { error: "Failed to fetch version", details: latestByMaster.error.message },
          { status: 500 }
        ),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    const legacy = await supabase
      .from("workflow_canvas_designs")
      .select("id")
      .eq("user_id", ownerId)
      .eq("id", masterId)
      .maybeSingle();

    if (legacy.error) {
      if (isConnectivityError(legacy.error.message)) {
        throw legacy.error;
      }
      return applyOwnerCookie(
        NextResponse.json(
          { error: "Failed to fetch version", details: legacy.error.message },
          { status: 500 }
        ),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    return applyOwnerCookie(
      NextResponse.json({ masterId, latestVersion: legacy.data ? 1 : 0 }),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  } catch {
    const latestVersion = await getLatestLocalVersionByMaster(ownerId, masterId);
    return applyOwnerCookie(
      NextResponse.json({ masterId, latestVersion, storage: "local-fallback" }),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  }
}
