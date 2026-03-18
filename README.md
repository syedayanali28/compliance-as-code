# Compliance Platform

IdaC (Infrastructure-design-as-Code) web platform for HKMA teams to design network topologies, run compliance-oriented firewall review workflows, and manage project review lifecycle artifacts.

## What This Project Does

This application combines three major capabilities in one system:

1. Design and topology authoring for infrastructure and security flows.
2. Review and validation workflows for firewall requests and architecture decisions.
3. Role-based operational access and data persistence for project teams, architects, reviewers, and admins.

In practical terms, users can:

- Sign in with enterprise SSO (Keycloak or ADFS) or dev credentials.
- Create and edit workflow-canvas diagrams with HKMA node types.
- Add custom fields to nodes to capture context-specific metadata.
- Save multiple canvas designs per user profile in Supabase.
- Export designs as `XLSX`, `PDF`, `PNG`, `JPEG`, or generic image.
- Use app sections for projects, reviews, submissions, and validations.
- Trigger firewall review APIs and guideline management endpoints.

## Recent Changes (March 2026)

- Workflow canvas policy catalog now has dual persistence:
  - primary source: Supabase tables (`workflow_canvas_components`, `workflow_canvas_validation_rules`)
  - local mirror: `data/workflow-canvas-policies.local.json`
- Policy fetch route (`/api/workflow-canvas/policies`) now performs diff-based sync:
  - when Supabase differs from local mirror, local file is updated
  - when identical, local file is not rewritten
  - when Supabase is unavailable, local mirror is used as fallback
- Workflow canvas design APIs now include stronger local synchronization:
  - design list and design-by-id Supabase reads sync to local store only when content differs
  - local fallback still serves data during Supabase/network failures
- Added workflow-canvas schema admin interface at `/admin/workflow-canvas` for admins to:
  - add components and rules
  - edit components
  - delete components

## Core Functional Areas

### 1) Authentication and Access Control

Authentication is handled with NextAuth (`src/lib/auth.ts`) and supports three modes:

- Keycloak brokered SSO (recommended).
- Direct ADFS OAuth mode (manual endpoints).
- Dev credentials mode (fallback when SSO is not configured).

Default dev users in development:

- `dev / dev` -> `project_team`
- `admin / admin` -> `admin`
- `architect / architect` -> `architect`
- `reviewer / reviewer` -> `arb_reviewer`

Role checks are enforced at route-level for restricted pages such as workflow canvas and admin/review areas.

### 2) Workflow Canvas (Text-Only AI Mode)

The workflow-canvas module (`src/modules/workflow-canvas`) is a React Flow based design surface focused on architecture and compliance topology modeling.

Key behavior:

- One-screen, non-scroll canvas interaction.
- Top-left command hub with larger controls.
- Node creation from templates and custom box creation dialog.
- Custom node fields stored as key/value metadata.
- Per-user design persistence through `/api/workflow-canvas/designs`.
- Policy-driven component catalog fetched from `/api/workflow-canvas/policies` and cached in browser local storage for reliability/offline reuse.
- AI chat endpoint (`/api/workflow-canvas/chat`) backed by provider-state abstraction.
- Current provider mode is MAAS text model selection only (image/video flows removed).

Export support:

- `XLSX` with nodes and edges sheets.
- Lightweight text-based `PDF` export.
- Diagram raster export as `PNG` and `JPEG`.

### 3) Firewall Review and Compliance Endpoints

The app includes route groups for firewall review and guideline operations.

Exposed API families include:

- `api/firewall-review/review/[ticketKey]`
- `api/firewall-review/review-stream/[ticketKey]`
- `api/firewall-review/guidelines/*`
- `api/admin/guidelines/*`
- `api/admin/audit`
- `api/templates/download`

UI routes include:

- `/firewall-review`
- `/projects`
- `/reviews`
- `/validations`
- `/workflow`
- `/workflow-canvas`

## Architecture Overview

- Frontend and API framework: Next.js App Router + React 19 + TypeScript.
- Auth/session: NextAuth v5 beta with credentials and OAuth/OIDC providers.
- Data layer: Supabase (service role for privileged server operations).
- Canvas engine: `@xyflow/react` (React Flow).
- AI integration: AI SDK with provider-state model routing; MAAS via OpenAI-compatible adapter.
- Export tooling: `xlsx` and in-browser blob/canvas export utilities.

## Database and Persistence

Workflow canvas designs are stored in Supabase table:

- `public.workflow_canvas_designs`

Workflow canvas component schema and rule catalog are stored in:

- `public.workflow_canvas_components`
- `public.workflow_canvas_validation_rules`

Local mirrors:

- `data/workflow-canvas-designs.local.json`
- `data/workflow-canvas-policies.local.json`

Synchronization model:

- Supabase is authoritative when reachable.
- On fetch, local mirrors are updated only if the fetched data differs.
- If Supabase is unavailable, APIs return local fallback data.
- This enables migration toward local-only operation if required later.

## API Catalog

### Workflow Canvas APIs

- `GET /api/workflow-canvas/policies`
  - Returns component/rule catalog for canvas builder.
  - Syncs Supabase -> local policy mirror only on differences.
  - Falls back to local mirror/default catalog when needed.

- `POST|PUT|DELETE /api/workflow-canvas/policies/components`
  - Admin-only CRUD for component schema table.

- `POST|PUT|DELETE /api/workflow-canvas/policies/rules`
  - Admin-only CRUD for validation rules table.

- `GET /api/workflow-canvas/designs`
  - Lists latest design per master for the current owner.
  - Mirrors Supabase rows into local design store (diff-based).

- `POST /api/workflow-canvas/designs`
  - Creates new versioned design record.
  - Supports local-fallback creation on connectivity failures.

- `GET|PUT /api/workflow-canvas/designs/[id]`
  - Fetch specific design/master and save new versions.
  - Syncs fetched design to local store when different.
  - Supports local-fallback reads/writes.

- `GET /api/workflow-canvas/designs/[id]/version`
  - Retrieves latest version number for a master design.

- `GET /api/workflow-canvas/designs/search`
  - Filtered search by name/team/project/version.
  - Falls back to local search when Supabase is unavailable.

- `POST /api/workflow-canvas/designs/[id]/gitlab`
  - Optional GitLab artifact push for versioned design payload.

- `POST /api/workflow-canvas/chat`
  - Canvas AI assistant endpoint (text-model mode).

### Firewall Review & Operations APIs

- `api/firewall-review/review/[ticketKey]`
- `api/firewall-review/review-stream/[ticketKey]`
- `api/firewall-review/guidelines/*`
- `api/admin/guidelines/*`
- `api/admin/audit`
- `api/templates/download`

## Integrations for Project Teams

Project teams can use the platform in this flow:

1. Author architecture in workflow canvas using centrally managed schema components.
2. Save versioned designs (Supabase primary, local fallback active).
3. Export topology artifacts (`XLSX`, `PNG/JPEG`, `PDF`, IDaC templates).
4. Submit/review through firewall-review and validation routes.
5. Reuse saved designs and policy catalog even during partial infrastructure outages via local mirrors.

External/enterprise integrations currently supported:

- Supabase (primary persistence)
- Keycloak/ADFS SSO (identity)
- GitLab optional design push endpoint
- MAAS/OpenAI-compatible model provider for canvas assistant

Schema highlights:

- `id` (UUID primary key)
- `user_id` (text, ownership boundary)
- `name`
- `nodes` (`jsonb`)
- `edges` (`jsonb`)
- `created_at`, `updated_at`

Migration file:

- `supabase/migrations/003_workflow_canvas_designs.sql`

## Local Development

### Prerequisites

- Node.js 20+
- `pnpm`
- Supabase instance (local or hosted)

### Setup

1. From this folder, install dependencies:

```bash
pnpm install
```

2. Copy env template and configure values:

```bash
# macOS/Linux
cp .env.example .env.local

# Windows PowerShell
Copy-Item .env.example .env.local
```

3. Ensure required env values are set at minimum:

- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- Auth mode variables for either Keycloak or ADFS (or none for dev mode)

4. Apply SQL migrations to your Supabase database.

5. Start the dev server:

```bash
pnpm dev
```

### Useful Scripts

- `pnpm dev` -> start development server
- `pnpm build` -> production build
- `pnpm start` -> run production server
- `pnpm lint` -> lint checks
- `pnpm generate-template` -> generate template artifacts
- `pnpm seed` -> seed sample data

## Git Push Mirroring (GitHub + GitLab)

This repo includes a local `pre-push` hook at `.githooks/pre-push` that mirrors your current local branch to both remotes.

One-time setup:

```powershell
./scripts/setup-git-mirror-hooks.ps1
```

After setup, a normal push such as `git push github main` or `git push gitlab feature/foo` will also push the same branch name to the other remote automatically (if both remotes exist).

## Environment Notes

SSO setup details are documented in:

- `docs/SSO_SETUP.md`

Workflow-canvas text model configuration:

- `WORKFLOW_CANVAS_TEXT_MODELS`
- `WORKFLOW_CANVAS_DEFAULT_MODEL`
- `WORKFLOW_CANVAS_LLM_PROVIDER`
- `MAAS_URL`
- `MAAS_API_KEY`

## Current Design Decisions

- Workflow-canvas currently operates in text-model mode only.
- Image and video generation/upload paths were intentionally removed.
- Design persistence is user-scoped through `user_id` checks in API handlers.
- Unauthorized users are redirected to `/unauthorized` for restricted pages.

## Folder Landmarks

- `src/app` -> UI routes and API route handlers.
- `src/modules/firewall-review` -> firewall review feature implementation.
- `src/modules/workflow-canvas` -> canvas, AI, export, and design logic.
- `src/lib` -> shared auth, supabase, and platform utilities.
- `supabase/migrations` -> SQL migrations.

## Project Scope Summary

This is an internal compliance operations platform that links architecture design, security review, and governance workflows in one role-aware application. It is built so teams can move from design intent to review artifacts quickly, while preserving auditability and repeatable policy checks through structured data, API endpoints, and exportable outputs.

