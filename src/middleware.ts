import { auth } from "@/lib/auth";
import { useSso, ssoProviderId } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { UserRole } from "@/types";

// Route protection rules: path prefix → allowed roles
const ROUTE_ROLES: Record<string, UserRole[]> = {
  "/admin": ["admin"],
  "/projects/new": ["admin"],
  "/submissions/new": ["architect"],
  "/reviews": ["arb_reviewer", "admin"],
  "/validations": ["arb_reviewer", "admin"],
};

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — always pass through
  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/workflow-canvas") ||
    pathname.startsWith("/api/firewall-review") ||
    pathname.startsWith("/workflow-canvas") ||
    pathname.startsWith("/firewall-review") ||
    pathname === "/" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const session = await auth();

  // ── Unauthenticated → redirect to sign-in ──
  if (!session?.user) {
    if (useSso && ssoProviderId) {
      // SSO: redirect straight to the provider (Keycloak or direct ADFS).
      // On intranet domain-joined machines → WIA (Kerberos) → zero prompts.
      const ssoSignIn = new URL(
        `/api/auth/signin/${ssoProviderId}`,
        request.url
      );
      ssoSignIn.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(ssoSignIn);
    }

    // Dev mode: show the custom sign-in page
    const signInUrl = new URL("/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // ── Role-based access control ──
  for (const [prefix, allowedRoles] of Object.entries(ROUTE_ROLES)) {
    if (pathname.startsWith(prefix)) {
      if (!allowedRoles.includes(session.user.role)) {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
