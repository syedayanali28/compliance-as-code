create table if not exists public.workflow_canvas_designs (
  id uuid not null default gen_random_uuid(),
  user_id text not null,
  name text not null default 'Untitled design',
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflow_canvas_designs_pkey primary key (id)
);

create index if not exists idx_workflow_canvas_designs_user_id
  on public.workflow_canvas_designs(user_id);

create trigger workflow_canvas_designs_updated_at
  before update on public.workflow_canvas_designs
  for each row execute function update_updated_at_column();
