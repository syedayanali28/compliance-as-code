# SSO Setup Guide (Compliance Platform)

This project already uses the right architecture for enterprise SSO:

- Authentication is handled server-side via NextAuth.
- Client secrets stay in server environment variables.
- Browser localStorage is not used for SSO secrets.

Use one of these modes:

- Keycloak brokered SSO (recommended)
- Direct ADFS OAuth (fallback when Keycloak is unavailable)

## 1. Credentials You Must Provide

### Common (required for all modes)

- `NEXTAUTH_URL`: Public base URL of this app (for callback URL generation), for example `https://compliance.hkma.gov.hk`.
- `NEXTAUTH_SECRET`: Random secret used by NextAuth to sign/encrypt session tokens.

Where to get:

- `NEXTAUTH_URL`: your app deployment URL from platform/devops team.
- `NEXTAUTH_SECRET`: generate with a secure random generator (32+ bytes), then store in secrets manager.

## 2. Option A: Keycloak (Recommended)

Required variables:

- `KEYCLOAK_ISSUER`: Realm issuer URL, for example `https://keycloak.hkma.gov.hk/realms/hkma`.
- `KEYCLOAK_CLIENT_ID`: OIDC client ID for this app.
- `KEYCLOAK_CLIENT_SECRET`: Secret for that OIDC client.

Where to get:

1. Keycloak Admin Console -> select realm.
2. Clients -> create/select client for this app.
3. Set client type to confidential.
4. Add redirect URI: `https://<app-host>/api/auth/callback/keycloak`.
5. Copy values from the client and realm:

- Issuer from Realm Settings or `.well-known` URL base.
- Client ID from client config.
- Client Secret from client credentials tab.

Notes:

- Keycloak should federate to ADFS (SAML or OIDC) so users keep existing enterprise identity.
- This is preferred because Keycloak is fully OIDC compliant.

## 3. Option B: Direct ADFS OAuth (No Discovery)

Required variables:

- `ADFS_ISSUER`: ADFS base URL, usually `https://<adfs-host>/adfs`.
- `ADFS_CLIENT_ID`: Application group client ID from ADFS.
- `ADFS_CLIENT_SECRET`: Application group secret from ADFS.

Optional but recommended:

- `ADFS_AUTHORIZATION_URL`: usually `https://<adfs-host>/adfs/oauth2/authorize`.
- `ADFS_TOKEN_URL`: usually `https://<adfs-host>/adfs/oauth2/token`.

Where to get:

1. ADFS Management -> Application Groups -> Add Application Group.
2. Choose Server Application template.
3. Register redirect URI: `https://<app-host>/api/auth/callback/adfs`.
4. Finish wizard and copy generated Client ID and Client Secret.
5. Confirm ADFS issuer/base URL from ADFS endpoint or federation metadata.

Claims needed from ADFS:

- User identifier (`sub` or `upn`)
- Email
- Display name
- Group/role claim (for app role mapping)

Work with AD/identity team to configure issuance transform rules for these claims.

## 4. Group-to-Role Mapping Needed

The app maps directory groups to roles in `src/lib/auth.ts`.
Current defaults:

- `architects` -> `architect`
- `project-teams` -> `project_team`
- `arb-reviewers` -> `arb_reviewer`
- `platform-admins` -> `admin`

Action required:

- Confirm exact AD/Keycloak group names with IAM team.
- Update mapping keys in `src/lib/auth.ts` to match real group strings.

## 5. Validation Rules Implemented

The auth config now fails fast if SSO variables are partially configured.
Examples:

- Setting only `ADFS_CLIENT_ID` without `ADFS_ISSUER` and `ADFS_CLIENT_SECRET` throws startup error.
- Setting both full Keycloak and full ADFS configs is allowed; Keycloak takes precedence.

## 6. Quick Verification Checklist

1. Set exactly one complete SSO mode (Keycloak or ADFS).
2. Ensure callback URL in IdP exactly matches app callback route.
3. Sign in once and verify role assignment for a test user.
4. Test unauthorized path (for example `/admin`) with non-admin account.
5. Review server logs for auth mode and claim mapping output.
