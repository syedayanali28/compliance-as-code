# Workflow Canvas Architecture

## Hierarchy

Zone (top) → Region → Environment → Compute → Tech Component

### Container Types

| Level | Category | Border | Color | Min Size | Inner Text |
|-------|----------|--------|-------|----------|------------|
| Zone | `zone` | 3px solid | Blue | 1200x800 | "Drag regions into this zone" |
| Region | `region` | 2.5px solid | Emerald | 1000x650 | "Drag environments into this region" |
| Environment | `environment` | 2px dashed | Purple | 800x500 | "Drag compute resources here" |
| Compute | `compute` | 2px dotted | Orange | 600x350 | "Drag tech components here" |

### Parent Resolution

- Zone → null (top-level)
- Region → zone
- Environment → region
- Compute → environment
- Tech components → compute

## Zones (5)

- OA Network - Baremetal (`oa-baremetal`, NSX firewall)
- OA Network - Private Cloud (`oa-private-cloud`, PSO firewall)
- OA Network - App DMZ (`oa-app-dmz`, NSX firewall)
- DMZ (`dmz`, NSX firewall)
- AWS Landing Zone (`aws-landing-zone`, AWS firewall)

## Regions (2)

- IFC (`ifc`)
- KCC (`kcc`)

## Environments (5)

Production, Pre-Production, UAT, Development, Disaster Recovery

## Compute (2)

Virtual Machine, Kubernetes Box

## Tech Components (27)

- **IAM:** Active Directory (HKMA ADFS)
- **Orchestration:** Kubernetes
- **AI/ML:** MaaS GenAI, RayServe, Dify
- **Security:** SIEM, EDR (Windows)
- **Monitoring:** Grafana
- **Storage:** Pure Storage, Filecloud
- **CI/CD:** Harbor, Jenkins, Ansible, SonarQube, GitLab
- **Database:** PostgreSQL, MySQL, Dremio
- **Backend:** Node.js, FastAPI, Flask, .NET, Express JS, Drizzle ORM, Docker
- **Frontend:** Next.js, Gradio, Axios
- **Integration:** Jira, Tableau, LSEG API Endpoint

## Firewall Auto-Detection

No visual firewall nodes. `determineFirewallRequirement()` auto-detects:

- Same compute → No firewall
- Different zones → Physical (NSX)
- OA Baremetal → Always physical (NSX)
- OA Private Cloud VM-to-VM → Virtual (PSO)
- AWS Landing Zone → Virtual (AWS)

## Fallback System (3-tier)

1. **Supabase** (primary) → `storage: "supabase"`
2. **Local files** (`data/workflow-canvas-*.local.json`) → `storage: "local-fallback"`
3. **In-memory defaults** (`DEFAULT_COMPONENTS` in policy-catalog.ts) → `storage: "default-fallback"`

Always uses `createDefaultCatalog()` as the baseline when DB/file fallbacks fail.

## Key Files

- `src/modules/workflow-canvas/lib/policy-catalog.ts` — Component definitions, validation rules, parent hierarchy
- `src/modules/workflow-canvas/lib/hkma-graph.ts` — Node type definitions, categories
- `src/modules/workflow-canvas/lib/firewall-requests.ts` — Auto firewall detection
- `src/modules/workflow-canvas/lib/node-buttons.ts` — Sidebar button generation with icons
- `src/modules/workflow-canvas/components/canvas.tsx` — Main canvas with node/edge management
- `src/modules/workflow-canvas/components/nodes/environment-box.tsx` — Container node rendering
- `src/modules/workflow-canvas/components/left-sidebar.tsx` — Left sidebar with 5 hierarchy sections
- `src/modules/workflow-canvas/components/toolbar.tsx` — Right toolbar with add/export/save
- `src/modules/workflow-canvas/components/nodes/index.tsx` — Node type registry
- `src/app/api/workflow-canvas/policies/route.ts` — Policy catalog API with fallback

## Database Tables

- `workflow_canvas_components` — Component definitions
- `workflow_canvas_validation_rules` — Connection rules
- `workflow_canvas_zones` — Zone definitions
- `workflow_canvas_regions` — Region definitions
- `workflow_canvas_designs` — Saved designs

## Migrations

- `009_hierarchy_restructure.sql` — New zones/regions tables, 24+ tech components
- `010_cleanup_obsolete_components.sql` — Remove 5 obsolete old-hierarchy components
