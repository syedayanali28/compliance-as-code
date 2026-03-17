create table if not exists public.workflow_canvas_components (
  id uuid not null default gen_random_uuid(),
  component_key text not null,
  node_type text not null,
  label text not null,
  category text not null,
  description text not null,
  zone text null,
  component_type text not null,
  parent_component_key text null,
  is_zone boolean not null default false,
  is_unique boolean not null default false,
  default_width integer null,
  default_height integer null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflow_canvas_components_pkey primary key (id),
  constraint workflow_canvas_components_component_key_key unique (component_key),
  constraint workflow_canvas_components_node_type_key unique (node_type),
  constraint workflow_canvas_components_parent_fk
    foreign key (parent_component_key)
    references public.workflow_canvas_components(component_key)
    on delete restrict
);

create table if not exists public.workflow_canvas_validation_rules (
  id uuid not null default gen_random_uuid(),
  policy_id text not null,
  source_component_key text not null,
  target_component_key text not null,
  action text not null,
  reason text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflow_canvas_validation_rules_pkey primary key (id),
  constraint workflow_canvas_validation_rules_policy_id_key unique (policy_id),
  constraint workflow_canvas_validation_rules_policy_id_format
    check (policy_id ~ '^CVR-[0-9]{4}$'),
  constraint workflow_canvas_validation_rules_action_check
    check (action in ('allow', 'deny')),
  constraint workflow_canvas_validation_rules_source_fk
    foreign key (source_component_key)
    references public.workflow_canvas_components(component_key)
    on delete restrict,
  constraint workflow_canvas_validation_rules_target_fk
    foreign key (target_component_key)
    references public.workflow_canvas_components(component_key)
    on delete restrict
);

create index if not exists idx_workflow_canvas_components_enabled
  on public.workflow_canvas_components(enabled);

create index if not exists idx_workflow_canvas_validation_rules_enabled
  on public.workflow_canvas_validation_rules(enabled);

drop trigger if exists workflow_canvas_components_updated_at on public.workflow_canvas_components;
create trigger workflow_canvas_components_updated_at
  before update on public.workflow_canvas_components
  for each row execute function update_updated_at_column();

drop trigger if exists workflow_canvas_validation_rules_updated_at on public.workflow_canvas_validation_rules;
create trigger workflow_canvas_validation_rules_updated_at
  before update on public.workflow_canvas_validation_rules
  for each row execute function update_updated_at_column();

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
  ('environment-prod', 'environment-prod', 'Production Environment', 'environment', 'Production MA environment.', null, 'environment:prod', null, true, false, 980, 620),
  ('environment-pre', 'environment-pre', 'Pre-Production Environment', 'environment', 'Pre-production MA environment.', null, 'environment:pre', null, true, false, 980, 620),
  ('environment-uat', 'environment-uat', 'UAT Environment', 'environment', 'UAT MA environment.', null, 'environment:uat', null, true, false, 980, 620),
  ('environment-dev', 'environment-dev', 'Development Environment', 'environment', 'Development MA environment.', null, 'environment:dev', null, true, false, 980, 620),
  ('zone-public-network', 'zone-public-network', 'Public Network Zone', 'zone', 'Public network zone inside MA.', 'public-network', 'zone:public-network', null, true, false, 300, 240),
  ('zone-dmz', 'zone-dmz', 'DMZ Zone', 'zone', 'DMZ network zone inside MA.', 'dmz', 'zone:dmz', null, true, false, 300, 240),
  ('zone-private-network', 'zone-private-network', 'Private Network Zone', 'zone', 'Private/Internal/OA network zone inside MA.', 'private-network', 'zone:private-network', null, true, false, 300, 240),
  ('firewall-external-facing', 'control-firewall-external', 'External Facing Firewall', 'control', 'Firewall between Public Network and DMZ.', null, 'firewall:external-facing', null, false, true, null, null),
  ('firewall-internal-facing', 'control-firewall-internal', 'Internal Facing Firewall', 'control', 'Firewall between DMZ and Private Network.', null, 'firewall:internal-facing', null, false, true, null, null),
  ('database-postgres', 'database-postgres', 'PostgreSQL', 'database', 'PostgreSQL database instance.', null, 'database:postgres', null, false, false, null, null),
  ('database-mysql', 'database-mysql', 'MySQL', 'database', 'MySQL database instance.', null, 'database:mysql', null, false, false, null, null),
  ('backend-nodejs', 'backend-nodejs', 'Node.js Service', 'backend', 'Node.js backend runtime.', null, 'backend:nodejs', null, false, false, null, null),
  ('backend-fastapi', 'backend-fastapi', 'FastAPI Service', 'backend', 'Python FastAPI backend.', null, 'backend:fastapi', null, false, false, null, null),
  ('backend-flask', 'backend-flask', 'Flask Service', 'backend', 'Python Flask backend.', null, 'backend:flask', null, false, false, null, null),
  ('backend-dotnet', 'backend-dotnet', '.NET Service', 'backend', 'ASP.NET/.NET backend.', null, 'backend:dotnet', null, false, false, null, null),
  ('frontend-nextjs', 'frontend-nextjs', 'Next.js Frontend', 'frontend', 'Next.js web frontend.', null, 'frontend:nextjs', null, false, false, null, null),
  ('frontend-gradio', 'frontend-gradio', 'Gradio UI', 'frontend', 'Gradio-based interactive frontend.', null, 'frontend:gradio', null, false, false, null, null)
on conflict (component_key) do nothing;

insert into public.workflow_canvas_validation_rules (
  policy_id,
  source_component_key,
  target_component_key,
  action,
  reason,
  enabled
)
values
  ('CVR-0001', 'zone-public-network', 'firewall-external-facing', 'allow', 'Public network traffic must enter through the external-facing firewall.', true),
  ('CVR-0002', 'firewall-external-facing', 'zone-dmz', 'allow', 'External firewall routes traffic into DMZ.', true),
  ('CVR-0003', 'zone-dmz', 'firewall-internal-facing', 'allow', 'DMZ to private network traffic must pass through internal-facing firewall.', true),
  ('CVR-0004', 'firewall-internal-facing', 'zone-private-network', 'allow', 'Internal-facing firewall routes traffic into private network.', true),
  ('CVR-0005', 'zone-public-network', 'database-postgres', 'deny', 'Public network must never connect directly to PostgreSQL.', true),
  ('CVR-0006', 'zone-public-network', 'database-mysql', 'deny', 'Public network must never connect directly to MySQL.', true)
on conflict (policy_id) do nothing;
