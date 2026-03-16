/**
 * NextAuth.js v5 — Authentication Configuration
 *
 * Three modes supported (auto-detected from environment variables):
 *
 * ═══════════════════════════════════════════════════════════════════════
 * Mode 1: Keycloak Identity Broker  [RECOMMENDED]
 * ═══════════════════════════════════════════════════════════════════════
 *   Env: KEYCLOAK_ISSUER, KEYCLOAK_CLIENT_ID, KEYCLOAK_CLIENT_SECRET
 *   Flow: App ──OIDC──→ Keycloak ──SAML 2.0──→ ADFS ──→ AD
 *
 *   Why recommended:
 *   - Keycloak is fully OIDC-compliant (wellKnown, single issuer, JWKS)
 *   - HKMA ADFS (maadfsd.hkma.gov.hk) is NOT fully OIDC-compliant:
 *       • /.well-known/openid-configuration returns 404
 *       • Access token issuer: http://maadfsd.hkma.gov.hk/adfs/services/trust
 *       • ID token issuer:     https://maadfsd.hkma.gov.hk/adfs
 *       • Two DIFFERENT issuers → breaks OIDC spec
 *   - Same Keycloak instance can serve Weaviate, this app, and others
 *   - No changes needed to existing ADFS users / certs / config
 *
 * ═══════════════════════════════════════════════════════════════════════
 * Mode 2: Direct ADFS  (manual endpoints — no OIDC discovery)
 * ═══════════════════════════════════════════════════════════════════════
 *   Env: ADFS_ISSUER, ADFS_CLIENT_ID, ADFS_CLIENT_SECRET
 *   Flow: App ──OAuth 2.0 + id_token──→ ADFS ──→ AD
 *
 *   Uses type "oauth" (not "oidc") with explicit endpoint URLs.
 *   Decodes the id_token on the server side after TLS-secured token
 *   exchange — avoids the broken OIDC discovery + dual-issuer problem.
 *
 *   On intranet domain-joined machines, ADFS performs WIA (Kerberos)
 *   → zero-prompt sign-in, identical to the JIRA experience.
 *
 *   Network path: User → WAP (DMZ :443) → Firewall → ADFS (:443) → AD
 *
 * ═══════════════════════════════════════════════════════════════════════
 * Mode 3: Dev Credentials  (no SSO needed)
 * ═══════════════════════════════════════════════════════════════════════
 *   Env: no KEYCLOAK or ADFS vars
 *   Simple username-based login with role inference.
 *
 * Reference:
 *   https://docs.weaviate.io/deploy/configuration/oidc
 *   https://access.redhat.com/articles/7064122
 *   https://django-auth-adfs.readthedocs.io/en/latest/oauth2_explained.html
 */

import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import type { UserRole, ReviewerTeam } from "@/types";

// ── Type augmentation ──

declare module "next-auth" {
  interface User {
    role: UserRole;
    team?: ReviewerTeam;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      team?: ReviewerTeam;
    };
  }
}

declare module "next-auth" {
  interface JWT {
    role: UserRole;
    team?: ReviewerTeam;
  }
}

// ── AD group → app role mapping ──
// Keys are partial-match substrings of the AD group DN / sAMAccountName.
// Customise these to match your actual AD group names.

const AD_ROLE_MAP: Record<string, UserRole> = {
  architects: "architect",
  "project-teams": "project_team",
  "arb-reviewers": "arb_reviewer",
  "platform-admins": "admin",
};

const AD_TEAM_MAP: Record<string, ReviewerTeam> = {
  "its-security": "ITS",
  "itis-infra": "ITIS",
  "psm-platform": "PSM",
  "bsa-enablement": "BSA",
};

function isSet(value: string | undefined): boolean {
  return !!value && value.trim().length > 0;
}

function assertNoPartialConfig(
  providerName: string,
  values: Record<string, string | undefined>
): void {
  const keys = Object.keys(values);
  const setKeys = keys.filter((key) => isSet(values[key]));
  if (setKeys.length === 0 || setKeys.length === keys.length) return;

  const missingKeys = keys.filter((key) => !isSet(values[key]));
  throw new Error(
    `${providerName} auth config is partial. Missing: ${missingKeys.join(", ")}. Set all required variables or remove all ${providerName} variables to use another auth mode.`
  );
}

// ── Detect authentication mode ──
// Priority: Keycloak > Direct ADFS > Dev credentials

const keycloakIssuer = process.env.KEYCLOAK_ISSUER;
const keycloakClientId = process.env.KEYCLOAK_CLIENT_ID;
const keycloakClientSecret = process.env.KEYCLOAK_CLIENT_SECRET;
assertNoPartialConfig("Keycloak", {
  KEYCLOAK_ISSUER: keycloakIssuer,
  KEYCLOAK_CLIENT_ID: keycloakClientId,
  KEYCLOAK_CLIENT_SECRET: keycloakClientSecret,
});
const useKeycloak = !!(keycloakIssuer && keycloakClientId && keycloakClientSecret);

const adfsIssuer = process.env.ADFS_ISSUER; // e.g. https://maadfsd.hkma.gov.hk/adfs
const adfsClientId = process.env.ADFS_CLIENT_ID;
const adfsClientSecret = process.env.ADFS_CLIENT_SECRET;
assertNoPartialConfig("ADFS", {
  ADFS_ISSUER: adfsIssuer,
  ADFS_CLIENT_ID: adfsClientId,
  ADFS_CLIENT_SECRET: adfsClientSecret,
});
const useAdfs = !!(adfsIssuer && adfsClientId && adfsClientSecret) && !useKeycloak;

/** True when any SSO provider is configured (Keycloak or direct ADFS) */
export const useSso = useKeycloak || useAdfs;

/** Provider ID used for SSO redirect in middleware */
export const ssoProviderId = useKeycloak ? "keycloak" : useAdfs ? "adfs" : null;

if (useKeycloak && isSet(adfsIssuer) && isSet(adfsClientId) && isSet(adfsClientSecret)) {
  console.warn(
    "Both Keycloak and ADFS configs are set. Keycloak takes precedence. Remove Keycloak vars to force direct ADFS mode."
  );
}

console.log("Auth mode:", ssoProviderId ?? "dev-credentials");

// ── Providers ──

function getProviders(): Provider[] {
  // ── Mode 1: Keycloak Identity Broker (recommended) ──
  if (useKeycloak) {
    return [
      {
        id: "keycloak",
        name: "HKMA SSO",
        type: "oidc",
        // Keycloak is fully OIDC-compliant — wellKnown works perfectly
        issuer: keycloakIssuer,
        clientId: keycloakClientId!,
        clientSecret: keycloakClientSecret!,
        authorization: {
          params: { scope: "openid profile email groups" },
        },
        profile(profile) {
          const groups: string[] =
            profile.groups ?? profile.realm_access?.roles ?? [];
          const role = mapGroupsToRole(
            Array.isArray(groups) ? groups : [groups]
          );
          const team =
            role === "arb_reviewer" ? mapGroupsToTeam(groups) : undefined;
          return {
            id: profile.sub,
            name: profile.name ?? profile.preferred_username ?? "Unknown",
            email: profile.email,
            role,
            team,
          };
        },
      } satisfies Provider,
    ];
  }

  // ── Mode 2: Direct ADFS (manual endpoints — OIDC discovery broken) ──
  //
  // ADFS at maadfsd.hkma.gov.hk does NOT serve /.well-known/openid-configuration
  // and has two different token issuers. We use type "oauth" with explicit
  // endpoint URLs and decode the id_token from the TLS-secured token exchange.
  if (useAdfs) {
    return [
      {
        id: "adfs",
        name: "HKMA SSO",
        type: "oauth", // NOT "oidc" — discovery returns 404

        clientId: adfsClientId!,
        clientSecret: adfsClientSecret!,

        // ADFS uses client_secret_post (not HTTP Basic)
        client: {
          token_endpoint_auth_method: "client_secret_post",
        },

        // Explicit endpoints (since /.well-known returns 404)
        authorization: {
          url:
            process.env.ADFS_AUTHORIZATION_URL ??
            `${adfsIssuer}/oauth2/authorize`,
          params: {
            resource: adfsClientId!,
            scope: "openid profile email",
            // Do NOT set prompt — let ADFS decide.
            // Intranet: WIA (Kerberos) → silent sign-in.
            // Extranet via WAP: forms-based fallback.
          },
        },

        token:
          process.env.ADFS_TOKEN_URL ?? `${adfsIssuer}/oauth2/token`,

        // Custom userinfo: decode id_token claims instead of calling
        // the userinfo endpoint (which may not return groups).
        userinfo: {
          url: `${adfsIssuer}/userinfo`,
          async request({ tokens }: { tokens: { id_token?: string; access_token?: string } }) {
            // Prefer id_token claims (includes groups, UPN, etc.)
            if (tokens.id_token) {
              const payload = tokens.id_token.split(".")[1];
              return JSON.parse(
                Buffer.from(payload, "base64url").toString("utf-8")
              );
            }
            // Fallback: userinfo endpoint
            const res = await fetch(`${adfsIssuer}/userinfo`, {
              headers: {
                Authorization: `Bearer ${tokens.access_token}`,
              },
            });
            return res.json();
          },
        },

        // Map decoded ADFS claims → NextAuth User
        profile(profile) {
          const groups: string[] =
            profile.groups ??
            profile.memberOf ??
            profile[
              "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
            ] ??
            [];

          const role = mapGroupsToRole(
            Array.isArray(groups) ? groups : [groups]
          );
          const team =
            role === "arb_reviewer" ? mapGroupsToTeam(groups) : undefined;

          return {
            id: profile.sub ?? profile.upn ?? profile.email,
            name:
              profile.name ??
              profile.given_name ??
              profile.upn?.split("@")[0] ??
              "Unknown",
            email: profile.email ?? profile.upn,
            role,
            team,
          };
        },
      } satisfies Provider,
    ];
  }

  // ── Mode 3: Dev Credentials (no SSO needed) ──
  return [
    Credentials({
      name: "Dev Login",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (
          !credentials ||
          typeof credentials.username !== "string" ||
          typeof credentials.password !== "string"
        ) {
          return null;
        }
        return devAuthenticate(
          credentials.username,
          credentials.password
        );
      },
    }),
  ];
}

// ── NextAuth instance ──

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: getProviders(),

  callbacks: {
    jwt({ token, user, account, profile }) {
      // First sign-in: persist role & team into the JWT
      if (user) {
        token.role = user.role;
        token.team = user.team;
      }

      // SSO: also read groups from raw profile in case
      // the profile() function couldn't map them
      if (
        (account?.provider === "adfs" || account?.provider === "keycloak") &&
        profile
      ) {
        const p = profile as Record<string, unknown>;
        const realmAccess = p.realm_access as
          | { roles?: string[] }
          | undefined;
        const groups: string[] = (
          (p.groups ??
            p.memberOf ??
            realmAccess?.roles ??
            p[
              "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
            ] ??
            []) as string[]
        );
        token.role = mapGroupsToRole(
          Array.isArray(groups) ? groups : [groups]
        );
        token.team =
          (token.role as UserRole) === "arb_reviewer"
            ? mapGroupsToTeam(groups)
            : undefined;
      }

      return token;
    },

    session({ session, token }) {
      session.user.role = token.role as UserRole;
      session.user.team = token.team as ReviewerTeam | undefined;
      return session;
    },
  },

  // SSO mode: no custom pages — NextAuth auto-redirects to the sole provider.
  // Dev mode: show custom sign-in page with username/password form.
  pages: useSso ? {} : { signIn: "/auth/signin", error: "/auth/error" },

  session: { strategy: "jwt" },
});

// ── Group mapping ──

function mapGroupsToRole(groups: string[]): UserRole {
  for (const group of groups) {
    const g = group.toLowerCase();
    for (const [key, role] of Object.entries(AD_ROLE_MAP)) {
      if (g.includes(key)) return role;
    }
  }
  return "project_team";
}

function mapGroupsToTeam(groups: string[]): ReviewerTeam {
  for (const group of groups) {
    const g = group.toLowerCase();
    for (const [key, team] of Object.entries(AD_TEAM_MAP)) {
      if (g.includes(key)) return team;
    }
  }
  return "ITS";
}

// ── Dev-mode helpers ──

type DevUserRecord = {
  id: string;
  username: string;
  password: string;
  name: string;
  email: string;
  role: UserRole;
  team?: ReviewerTeam;
};

const DEV_TEST_USERS: DevUserRecord[] = [
  {
    id: "u-dev",
    username: "dev",
    password: "dev",
    name: "Dev User",
    email: "dev.user@hkma.dev",
    role: "project_team",
  },
  {
    id: "u-admin",
    username: "admin",
    password: "admin",
    name: "Admin User",
    email: "admin.user@hkma.dev",
    role: "admin",
  },
  {
    id: "u-architect",
    username: "architect",
    password: "architect",
    name: "Architect User",
    email: "architect.user@hkma.dev",
    role: "architect",
  },
  {
    id: "u-reviewer",
    username: "reviewer",
    password: "reviewer",
    name: "Reviewer User",
    email: "reviewer.user@hkma.dev",
    role: "arb_reviewer",
    team: "ITS",
  },
];

function devAuthenticate(username: string, password: string) {
  const matchedUser = DEV_TEST_USERS.find(
    (user) =>
      user.username.toLowerCase() === username.toLowerCase() &&
      user.password === password
  );

  if (!matchedUser) return null;

  return {
    id: matchedUser.id,
    name: matchedUser.name,
    email: matchedUser.email,
    role: matchedUser.role,
    team: matchedUser.team,
  };
}
