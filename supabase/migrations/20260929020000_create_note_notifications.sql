create table public.note_notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  recipient_id uuid not null,
  note_id uuid not null references public.project_notes(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  project_label text not null,
  job_label text,
  preview text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (note_id, recipient_id)
);

create index note_notifications_recipient_created_idx
  on public.note_notifications (recipient_id, company_id, created_at desc);

create index note_notifications_unread_idx
  on public.note_notifications (recipient_id, company_id)
  where read_at is null;

create index note_notifications_project_idx
  on public.note_notifications (project_id);

create index note_notifications_job_idx
  on public.note_notifications (job_id)
  where job_id is not null;

alter table public.note_notifications enable row level security;

create policy "Members can read their note notifications"
  on public.note_notifications for select to authenticated
  using (
    recipient_id = (select auth.uid())
    and exists (
      select 1 from public.company_members member
      where member.company_id = note_notifications.company_id
        and member.user_id = (select auth.uid())
    )
  );

create policy "Members can mark their note notifications read"
  on public.note_notifications for update to authenticated
  using (
    recipient_id = (select auth.uid())
    and exists (
      select 1 from public.company_members member
      where member.company_id = note_notifications.company_id
        and member.user_id = (select auth.uid())
    )
  )
  with check (
    recipient_id = (select auth.uid())
    and exists (
      select 1 from public.company_members member
      where member.company_id = note_notifications.company_id
        and member.user_id = (select auth.uid())
    )
  );

revoke all on public.note_notifications from public, anon, authenticated;
grant select, update (read_at) on public.note_notifications to authenticated;

create function public.notify_company_of_project_note()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_name text;
  job_name text;
begin
  select project.project_address into project_name
  from public.projects project
  where project.id = new.project_id and project.company_id = new.company_id;

  if new.job_id is not null then
    select job.title into job_name
    from public.jobs job
    where job.id = new.job_id and job.project_id = new.project_id
      and job.company_id = new.company_id;
  end if;

  insert into public.note_notifications (
    company_id, recipient_id, note_id, project_id, job_id,
    project_label, job_label, preview, created_at
  )
  select new.company_id, member.user_id, new.id, new.project_id, new.job_id,
    coalesce(project_name, 'Project'), job_name, left(new.body, 140), new.created_at
  from public.company_members member
  where member.company_id = new.company_id
    and member.user_id <> new.author_id
  on conflict (note_id, recipient_id) do nothing;

  return new;
end;
$$;

revoke all on function public.notify_company_of_project_note() from public, anon, authenticated;

create trigger project_note_notification_added
  after insert on public.project_notes
  for each row execute function public.notify_company_of_project_note();
