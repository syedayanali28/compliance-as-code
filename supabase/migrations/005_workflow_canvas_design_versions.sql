alter table if exists public.workflow_canvas_designs
  add column if not exists team_slug text not null default 'default-team',
  add column if not exists project_code text not null default 'default-project',
  add column if not exists design_key text not null default 'untitled-design',
  add column if not exists version int not null default 1,
  add column if not exists gitlab_path text;

update public.workflow_canvas_designs
set
  team_slug = coalesce(nullif(trim(team_slug), ''), 'default-team'),
  project_code = coalesce(nullif(trim(project_code), ''), 'default-project'),
  design_key = coalesce(
    nullif(trim(design_key), ''),
    nullif(regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'), ''),
    'untitled-design'
  )
where true;

create index if not exists idx_workflow_canvas_designs_hierarchy
  on public.workflow_canvas_designs(user_id, team_slug, project_code, design_key, version desc);

create unique index if not exists workflow_canvas_designs_user_hierarchy_version_key
  on public.workflow_canvas_designs(user_id, team_slug, project_code, design_key, version);
