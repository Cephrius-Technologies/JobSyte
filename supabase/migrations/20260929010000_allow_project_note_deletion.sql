-- Notes are shared with company members, but only the author may remove one.
create policy "Authors can delete project notes"
  on public.project_notes for delete to authenticated
  using (
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
  );

grant delete on public.project_notes to authenticated;
