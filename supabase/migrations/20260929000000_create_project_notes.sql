  create table public.project_notes (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null,
    project_id uuid not null references public.projects(id) on delete cascade,
    job_id uuid references public.jobs(id) on delete cascade,
    author_id uuid not null,
    body text not null check (char_length(btrim(body)) between 1 and 5000),
    created_at timestamptz not null default now()
  );

  create index project_notes_project_created_idx
    on public.project_notes (company_id, project_id, created_at desc);

  alter table public.project_notes enable row level security;

  -- Notes remain readable only while their project (and optional job) is active.
  create policy "Members can read project notes"
    on public.project_notes for select to authenticated
    using (
      exists (
        select 1
        from public.company_members member
        join public.projects project on project.company_id = member.company_id
        where member.user_id = (select auth.uid())
          and member.company_id = project_notes.company_id
          and project.id = project_notes.project_id
          and project.deleted_at is null
      )
      and (
        job_id is null or exists (
          select 1
          from public.jobs job
          where job.id = project_notes.job_id
            and job.project_id = project_notes.project_id
            and job.company_id = project_notes.company_id
            and job.deleted_at is null
        )
      )
    );

  create policy "Members can add project notes"
    on public.project_notes for insert to authenticated
    with check (
      author_id = (select auth.uid())
      and exists (
        select 1
        from public.company_members member
        join public.projects project on project.company_id = member.company_id
        where member.user_id = (select auth.uid())
          and member.company_id = project_notes.company_id
          and project.id = project_notes.project_id
          and project.deleted_at is null
      )
      and (
        job_id is null or exists (
          select 1
          from public.jobs job
          where job.id = project_notes.job_id
            and job.project_id = project_notes.project_id
            and job.company_id = project_notes.company_id
            and job.deleted_at is null
        )
      )
    );

  revoke all on public.project_notes from public, anon;
  grant select, insert on public.project_notes to authenticated;
