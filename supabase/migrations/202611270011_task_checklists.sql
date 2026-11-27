create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  task_id uuid not null references public.tasks on delete cascade,
  label text not null check (char_length(label) between 2 and 240),
  position integer not null default 0 check (position >= 0),
  completed boolean not null default false,
  completed_by uuid references public.profiles,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (task_id, position)
);

create index task_checklist_items_task_position_idx
  on public.task_checklist_items(task_id, position);

alter table public.task_checklist_items enable row level security;

create policy task_checklist_read on public.task_checklist_items
  for select using (
    organization_id = public.current_org_id()
    and exists (select 1 from public.tasks task where task.id = task_id)
  );

create policy task_checklist_owner_update on public.task_checklist_items
  for update using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.tasks task
      where task.id = task_id and task.primary_owner_id = auth.uid()
    )
  ) with check (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.tasks task
      where task.id = task_id and task.primary_owner_id = auth.uid()
    )
  );
