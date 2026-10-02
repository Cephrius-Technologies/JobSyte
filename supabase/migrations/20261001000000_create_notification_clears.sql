create table public.notification_clears (
  company_id uuid not null,
  user_id uuid not null,
  notes_cleared_at timestamptz not null,
  overdue_cleared_through date not null,
  primary key (company_id, user_id)
);

alter table public.notification_clears enable row level security;

create policy "Members can read their notification clear state"
  on public.notification_clears for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.company_members member
      where member.company_id = notification_clears.company_id
        and member.user_id = (select auth.uid())
    )
  );

create policy "Members can create their notification clear state"
  on public.notification_clears for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.company_members member
      where member.company_id = notification_clears.company_id
        and member.user_id = (select auth.uid())
    )
  );

create policy "Members can update their notification clear state"
  on public.notification_clears for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.company_members member
      where member.company_id = notification_clears.company_id
        and member.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.company_members member
      where member.company_id = notification_clears.company_id
        and member.user_id = (select auth.uid())
    )
  );

revoke all on public.notification_clears from public, anon, authenticated;
grant select, insert, update
  on public.notification_clears to authenticated;
