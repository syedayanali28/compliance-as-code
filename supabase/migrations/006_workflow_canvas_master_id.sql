alter table if exists public.workflow_canvas_designs
  add column if not exists master_id uuid;

update public.workflow_canvas_designs
set master_id = id
where master_id is null;

alter table if exists public.workflow_canvas_designs
  alter column master_id set not null,
  alter column master_id set default gen_random_uuid();

create index if not exists idx_workflow_canvas_designs_user_master
  on public.workflow_canvas_designs(user_id, master_id);

create unique index if not exists workflow_canvas_designs_user_master_version_key
  on public.workflow_canvas_designs(user_id, master_id, version);
