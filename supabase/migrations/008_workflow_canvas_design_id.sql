alter table if exists public.workflow_canvas_designs
  add column if not exists design_id uuid;

update public.workflow_canvas_designs
set design_id = id
where design_id is null;

alter table if exists public.workflow_canvas_designs
  alter column design_id set not null,
  alter column design_id set default gen_random_uuid();

create index if not exists idx_workflow_canvas_designs_user_master_design
  on public.workflow_canvas_designs(user_id, master_id, design_id);
