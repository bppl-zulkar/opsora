create or replace function public.sync_task_lifecycle_progress()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.progress_percentage := case
      when new.status in ('closed', 'completed') then 100
      when new.status = 'pending_verification' then 90
      when new.status in ('in_progress', 'rework_required', 'reopened') then greatest(old.progress_percentage, 30)
      when new.status in ('draft', 'assigned', 'acknowledged', 'accepted', 'scheduled') then greatest(old.progress_percentage, 0)
      else old.progress_percentage
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_sync_lifecycle_progress on public.tasks;
create trigger tasks_sync_lifecycle_progress
before update of status on public.tasks
for each row execute function public.sync_task_lifecycle_progress();

update public.tasks
set progress_percentage = case
  when status in ('closed', 'completed') then 100
  when status = 'pending_verification' then 90
  when status in ('in_progress', 'rework_required', 'reopened', 'on_hold') then greatest(progress_percentage, 30)
  else progress_percentage
end,
updated_at = now()
where
  (status in ('closed', 'completed') and progress_percentage <> 100)
  or (status = 'pending_verification' and progress_percentage <> 90)
  or (status in ('in_progress', 'rework_required', 'reopened', 'on_hold') and progress_percentage < 30);
