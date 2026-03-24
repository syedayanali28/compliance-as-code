-- =====================================================================
-- Migration 009: Hierarchy Restructure
-- =====================================================================
-- This migration restructures the workflow canvas hierarchy from:
--   Environment > Zone > Component
-- To the correct hierarchy:
--   Zone > Region > Environment > Compute > Tech Component
-- =====================================================================

-- =====================================================================
-- 1. Create new reference tables for zones and regions
-- =====================================================================

create table if not exists public.workflow_canvas_zones (
  id uuid not null default gen_random_uuid(),
  zone_key text not null,
  label text not null,
  parent_zone_key text null,
  intra_zone_firewall_type text not null default 'none',
  firewall_provider text not null default 'none',
  is_custom boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflow_canvas_zones_pkey primary key (id),
  constraint workflow_canvas_zones_zone_key_key unique (zone_key),
  constraint workflow_canvas_zones_intra_zone_firewall_type_check
    check (intra_zone_firewall_type in ('physical', 'virtual', 'none')),
  constraint workflow_canvas_zones_firewall_provider_check
    check (firewall_provider in ('NSX', 'PSO', 'AWS', 'none')),
  constraint workflow_canvas_zones_parent_fk
    foreign key (parent_zone_key)
    references public.workflow_canvas_zones(zone_key)
    on delete restrict
);

create index if not exists idx_workflow_canvas_zones_enabled
  on public.workflow_canvas_zones(enabled);

create index if not exists idx_workflow_canvas_zones_parent
  on public.workflow_canvas_zones(parent_zone_key);

drop trigger if exists workflow_canvas_zones_updated_at on public.workflow_canvas_zones;
create trigger workflow_canvas_zones_updated_at
  before update on public.workflow_canvas_zones
  for each row execute function update_updated_at_column();

create table if not exists public.workflow_canvas_regions (
  id uuid not null default gen_random_uuid(),
  region_key text not null,
  label text not null,
  is_custom boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflow_canvas_regions_pkey primary key (id),
  constraint workflow_canvas_regions_region_key_key unique (region_key)
);

create index if not exists idx_workflow_canvas_regions_enabled
  on public.workflow_canvas_regions(enabled);

drop trigger if exists workflow_canvas_regions_updated_at on public.workflow_canvas_regions;
create trigger workflow_canvas_regions_updated_at
  before update on public.workflow_canvas_regions
  for each row execute function update_updated_at_column();

-- =====================================================================
-- 2. Seed zones
-- =====================================================================

insert into public.workflow_canvas_zones (
  zone_key,
  label,
  parent_zone_key,
  intra_zone_firewall_type,
  firewall_provider,
  is_custom
)
values
  ('oa-baremetal', 'OA Network - Baremetal', null, 'physical', 'NSX', false),
  ('oa-private-cloud', 'OA Network - Private Cloud', null, 'virtual', 'PSO', false),
  ('oa-app-dmz', 'OA Network - App DMZ', null, 'physical', 'NSX', false),
  ('dmz', 'DMZ', null, 'physical', 'NSX', false),
  ('aws-landing-zone', 'AWS Landing Zone', null, 'virtual', 'AWS', false)
on conflict (zone_key) do nothing;

-- =====================================================================
-- 3. Seed regions
-- =====================================================================

insert into public.workflow_canvas_regions (
  region_key,
  label,
  is_custom
)
values
  ('ifc', 'IFC', false),
  ('kcc', 'KCC', false)
on conflict (region_key) do nothing;

-- =====================================================================
-- 4. Remove old firewall components from workflow_canvas_components
-- =====================================================================

delete from public.workflow_canvas_validation_rules
where source_component_key in ('firewall-external-facing', 'firewall-internal-facing')
   or target_component_key in ('firewall-external-facing', 'firewall-internal-facing');

delete from public.workflow_canvas_components
where component_key in ('firewall-external-facing', 'firewall-internal-facing');

-- =====================================================================
-- 5. Remove old zone components
-- =====================================================================

delete from public.workflow_canvas_validation_rules
where source_component_key in (
  'zone-public-network', 'zone-dmz', 'zone-private-network'
)
   or target_component_key in (
  'zone-public-network', 'zone-dmz', 'zone-private-network'
);

delete from public.workflow_canvas_components
where component_key in (
  'zone-public-network', 'zone-dmz', 'zone-private-network'
);

-- =====================================================================
-- 6. Add new zone components
-- =====================================================================

insert into public.workflow_canvas_components (
  component_key,
  node_type,
  label,
  category,
  description,
  zone,
  component_type,
  parent_component_key,
  is_zone,
  is_unique,
  default_width,
  default_height
)
values
  ('zone-oa-baremetal', 'zone-oa-baremetal', 'OA Network - Baremetal', 'zone', 'OA network zone for baremetal servers.', 'oa-baremetal', 'zone:oa-baremetal', null, true, false, 1200, 800),
  ('zone-oa-private-cloud', 'zone-oa-private-cloud', 'OA Network - Private Cloud', 'zone', 'OA network zone for private cloud VMs with virtual firewall.', 'oa-private-cloud', 'zone:oa-private-cloud', null, true, false, 1200, 800),
  ('zone-oa-app-dmz', 'zone-oa-app-dmz', 'OA Network - App DMZ', 'zone', 'OA network zone for application DMZ.', 'oa-app-dmz', 'zone:oa-app-dmz', null, true, false, 1200, 800),
  ('zone-dmz', 'zone-dmz', 'DMZ', 'zone', 'DMZ network zone.', 'dmz', 'zone:dmz', null, true, false, 1200, 800),
  ('zone-aws-landing-zone', 'zone-aws-landing-zone', 'AWS Landing Zone', 'zone', 'AWS landing zone with virtual firewall.', 'aws-landing-zone', 'zone:aws-landing-zone', null, true, false, 1200, 800)
on conflict (component_key) do nothing;

-- =====================================================================
-- 7. Add new region components
-- =====================================================================

insert into public.workflow_canvas_components (
  component_key,
  node_type,
  label,
  category,
  description,
  zone,
  component_type,
  parent_component_key,
  is_zone,
  is_unique,
  default_width,
  default_height
)
values
  ('region-ifc', 'region-ifc', 'IFC', 'region', 'IFC office location.', null, 'region:ifc', null, true, false, 1000, 650),
  ('region-kcc', 'region-kcc', 'KCC', 'region', 'KCC office location.', null, 'region:kcc', null, true, false, 1000, 650)
on conflict (component_key) do nothing;

-- =====================================================================
-- 8. Add DR environment
-- =====================================================================

insert into public.workflow_canvas_components (
  component_key,
  node_type,
  label,
  category,
  description,
  zone,
  component_type,
  parent_component_key,
  is_zone,
  is_unique,
  default_width,
  default_height
)
values
  ('environment-dr', 'environment-dr', 'Disaster Recovery Environment', 'environment', 'Disaster recovery MA environment.', null, 'environment:dr', null, true, false, 800, 500)
on conflict (component_key) do nothing;

-- =====================================================================
-- 9. Add compute components
-- =====================================================================

insert into public.workflow_canvas_components (
  component_key,
  node_type,
  label,
  category,
  description,
  zone,
  component_type,
  parent_component_key,
  is_zone,
  is_unique,
  default_width,
  default_height
)
values
  ('compute-vm', 'compute-vm', 'Virtual Machine', 'compute', 'Virtual machine compute resource.', null, 'compute:vm', null, true, false, 600, 350),
  ('compute-k8s', 'compute-k8s', 'Kubernetes Box', 'compute', 'Kubernetes cluster compute resource.', null, 'compute:k8s', null, true, false, 600, 350)
on conflict (component_key) do nothing;

-- =====================================================================
-- 10. Add new tech components (IAM)
-- =====================================================================

insert into public.workflow_canvas_components (
  component_key,
  node_type,
  label,
  category,
  description,
  zone,
  component_type,
  parent_component_key,
  is_zone,
  is_unique,
  default_width,
  default_height
)
values
  ('iam-active-directory', 'iam-active-directory', 'Active Directory (HKMA ADFS)', 'iam', 'HKMA Active Directory Federation Services.', null, 'iam:active-directory', null, false, false, null, null)
on conflict (component_key) do nothing;

-- =====================================================================
-- 11. Add new tech components (Container Orchestration)
-- =====================================================================

insert into public.workflow_canvas_components (
  component_key,
  node_type,
  label,
  category,
  description,
  zone,
  component_type,
  parent_component_key,
  is_zone,
  is_unique,
  default_width,
  default_height
)
values
  ('orchestration-kubernetes', 'orchestration-kubernetes', 'Kubernetes', 'orchestration', 'Kubernetes container orchestration platform.', null, 'orchestration:kubernetes', null, false, false, null, null)
on conflict (component_key) do nothing;

-- =====================================================================
-- 12. Add new tech components (Frontend)
-- =====================================================================

insert into public.workflow_canvas_components (
  component_key,
  node_type,
  label,
  category,
  description,
  zone,
  component_type,
  parent_component_key,
  is_zone,
  is_unique,
  default_width,
  default_height
)
values
  ('frontend-axios', 'frontend-axios', 'Axios', 'frontend', 'HTTP client library for frontend.', null, 'frontend:axios', null, false, false, null, null)
on conflict (component_key) do nothing;

-- =====================================================================
-- 13. Add new tech components (Backend / ORM)
-- =====================================================================

insert into public.workflow_canvas_components (
  component_key,
  node_type,
  label,
  category,
  description,
  zone,
  component_type,
  parent_component_key,
  is_zone,
  is_unique,
  default_width,
  default_height
)
values
  ('backend-express', 'backend-express', 'Express JS', 'backend', 'Express.js backend framework.', null, 'backend:express', null, false, false, null, null),
  ('backend-drizzle-orm', 'backend-drizzle-orm', 'Drizzle ORM', 'backend', 'TypeScript ORM for SQL databases.', null, 'backend:drizzle-orm', null, false, false, null, null)
on conflict (component_key) do nothing;

-- =====================================================================
-- 14. Add new tech components (AI / ML)
-- =====================================================================

insert into public.workflow_canvas_components (
  component_key,
  node_type,
  label,
  category,
  description,
  zone,
  component_type,
  parent_component_key,
  is_zone,
  is_unique,
  default_width,
  default_height
)
values
  ('ai-maas-genai', 'ai-maas-genai', 'MaaS GenAI', 'ai', 'Model-as-a-Service Generative AI platform.', null, 'ai:maas-genai', null, false, false, null, null),
  ('ai-rayserve', 'ai-rayserve', 'RayServe', 'ai', 'Ray Serve ML model serving.', null, 'ai:rayserve', null, false, false, null, null),
  ('ai-dify', 'ai-dify', 'Dify', 'ai', 'Dify LLM application platform.', null, 'ai:dify', null, false, false, null, null)
on conflict (component_key) do nothing;

-- =====================================================================
-- 15. Add new tech components (Issue Tracking)
-- =====================================================================

insert into public.workflow_canvas_components (
  component_key,
  node_type,
  label,
  category,
  description,
  zone,
  component_type,
  parent_component_key,
  is_zone,
  is_unique,
  default_width,
  default_height
)
values
  ('issue-tracking-jira', 'issue-tracking-jira', 'Jira', 'integration', 'Atlassian Jira issue tracking system.', null, 'integration:jira', null, false, false, null, null)
on conflict (component_key) do nothing;

-- =====================================================================
-- 16. Add new tech components (Security)
-- =====================================================================

insert into public.workflow_canvas_components (
  component_key,
  node_type,
  label,
  category,
  description,
  zone,
  component_type,
  parent_component_key,
  is_zone,
  is_unique,
  default_width,
  default_height
)
values
  ('security-siem', 'security-siem', 'SIEM', 'security', 'Security Information and Event Management system.', null, 'security:siem', null, false, false, null, null),
  ('security-edr', 'security-edr', 'EDR (Windows Environment)', 'security', 'Endpoint Detection and Response for Windows.', null, 'security:edr', null, false, false, null, null)
on conflict (component_key) do nothing;

-- =====================================================================
-- 17. Add new tech components (Monitoring)
-- =====================================================================

insert into public.workflow_canvas_components (
  component_key,
  node_type,
  label,
  category,
  description,
  zone,
  component_type,
  parent_component_key,
  is_zone,
  is_unique,
  default_width,
  default_height
)
values
  ('monitoring-grafana', 'monitoring-grafana', 'Grafana', 'monitoring', 'Grafana monitoring and observability platform.', null, 'monitoring:grafana', null, false, false, null, null)
on conflict (component_key) do nothing;

-- =====================================================================
-- 18. Add new tech components (Data Platforms)
-- =====================================================================

insert into public.workflow_canvas_components (
  component_key,
  node_type,
  label,
  category,
  description,
  zone,
  component_type,
  parent_component_key,
  is_zone,
  is_unique,
  default_width,
  default_height
)
values
  ('data-dremio', 'data-dremio', 'Dremio', 'database', 'Dremio data lakehouse platform.', null, 'database:dremio', null, false, false, null, null)
on conflict (component_key) do nothing;

-- =====================================================================
-- 19. Add new tech components (BI)
-- =====================================================================

insert into public.workflow_canvas_components (
  component_key,
  node_type,
  label,
  category,
  description,
  zone,
  component_type,
  parent_component_key,
  is_zone,
  is_unique,
  default_width,
  default_height
)
values
  ('bi-tableau', 'bi-tableau', 'Tableau', 'integration', 'Tableau business intelligence platform.', null, 'integration:tableau', null, false, false, null, null)
on conflict (component_key) do nothing;

-- =====================================================================
-- 20. Add new tech components (Storage)
-- =====================================================================

insert into public.workflow_canvas_components (
  component_key,
  node_type,
  label,
  category,
  description,
  zone,
  component_type,
  parent_component_key,
  is_zone,
  is_unique,
  default_width,
  default_height
)
values
  ('storage-pure-storage', 'storage-pure-storage', 'Pure Storage', 'storage', 'Pure Storage flash storage system.', null, 'storage:pure-storage', null, false, false, null, null),
  ('storage-filecloud', 'storage-filecloud', 'Filecloud', 'storage', 'Filecloud file storage and sharing.', null, 'storage:filecloud', null, false, false, null, null)
on conflict (component_key) do nothing;

-- =====================================================================
-- 21. Add new tech components (CI/CD)
-- =====================================================================

insert into public.workflow_canvas_components (
  component_key,
  node_type,
  label,
  category,
  description,
  zone,
  component_type,
  parent_component_key,
  is_zone,
  is_unique,
  default_width,
  default_height
)
values
  ('cicd-harbor', 'cicd-harbor', 'Harbor', 'cicd', 'Harbor container registry.', null, 'cicd:harbor', null, false, false, null, null),
  ('cicd-jenkins', 'cicd-jenkins', 'Jenkins', 'cicd', 'Jenkins automation server.', null, 'cicd:jenkins', null, false, false, null, null),
  ('cicd-ansible', 'cicd-ansible', 'Ansible', 'cicd', 'Ansible automation platform.', null, 'cicd:ansible', null, false, false, null, null),
  ('cicd-sonarqube', 'cicd-sonarqube', 'SonarQube', 'cicd', 'SonarQube code quality platform.', null, 'cicd:sonarqube', null, false, false, null, null),
  ('cicd-gitlab', 'cicd-gitlab', 'GitLab', 'cicd', 'GitLab DevOps platform.', null, 'cicd:gitlab', null, false, false, null, null)
on conflict (component_key) do nothing;

-- =====================================================================
-- 22. Add new tech components (Containerization)
-- =====================================================================

insert into public.workflow_canvas_components (
  component_key,
  node_type,
  label,
  category,
  description,
  zone,
  component_type,
  parent_component_key,
  is_zone,
  is_unique,
  default_width,
  default_height
)
values
  ('container-docker', 'container-docker', 'Docker', 'backend', 'Docker containerization platform.', null, 'backend:docker', null, false, false, null, null)
on conflict (component_key) do nothing;

-- =====================================================================
-- 23. Add new tech components (External)
-- =====================================================================

insert into public.workflow_canvas_components (
  component_key,
  node_type,
  label,
  category,
  description,
  zone,
  component_type,
  parent_component_key,
  is_zone,
  is_unique,
  default_width,
  default_height
)
values
  ('external-lseg-api', 'external-lseg-api', 'LSEG API Endpoint', 'integration', 'London Stock Exchange Group API endpoint.', null, 'integration:lseg-api', null, false, false, null, null)
on conflict (component_key) do nothing;
