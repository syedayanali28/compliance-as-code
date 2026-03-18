create or replace function public.prevent_workflow_canvas_design_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'workflow_canvas_designs is immutable: deletes are not allowed';
end;
$$;

drop trigger if exists workflow_canvas_designs_prevent_delete on public.workflow_canvas_designs;

create trigger workflow_canvas_designs_prevent_delete
before delete on public.workflow_canvas_designs
for each row
execute function public.prevent_workflow_canvas_design_delete();
