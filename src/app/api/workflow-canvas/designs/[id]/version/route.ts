import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listLocalVersions } from "@/lib/workflow-canvas-local-store";
import { isWorkflowCanvasLocalFallbackEnabled } from "@/lib/workflow-canvas-storage-mode";
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ownerId, ownerCookieValue, shouldSetOwnerCookie } = await resolveOwnerId(request);
  const { id: masterId } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const { data: latest, error } = await supabase
      .from("workflow_canvas_designs")
      .select("version")
      .eq("user_id", ownerId)
      .eq("master_id", masterId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return applyOwnerCookie(
        NextResponse.json(
          { error: "Failed to fetch latest version", details: error.message },
          { status: 500 }
        ),
        ownerCookieValue,
        shouldSetOwnerCookie
      );
    }

    const latestVersion = latest?.version ?? 0;

    return applyOwnerCookie(
      NextResponse.json({ latestVersion, storage: "supabase" }),
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

    const localVersions = await listLocalVersions(ownerId, masterId);
    const latestVersion = localVersions.length > 0 ? Math.max(...localVersions.map((v) => v.version)) : 0;

    return applyOwnerCookie(
      NextResponse.json({ latestVersion, storage: "local-fallback" }),
      ownerCookieValue,
      shouldSetOwnerCookie
    );
  }
}
