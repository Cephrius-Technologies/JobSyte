-- Create a builder invoice, its immutable line-item snapshots, and the related
-- job status updates in one transaction. Any exception rolls back every write.
create or replace function public.create_invoice_for_builder_atomic(
  p_company_id uuid,
  p_builder_id uuid,
  p_invoice_number text,
  p_invoice_date date,
  p_due_date date,
  p_contractor_name text,
  p_contractor_address text,
  p_contractor_phone text,
  p_bill_to_name text,
  p_bill_to_address text,
  p_job_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_invoice_id uuid;
  v_builder_name text;
  v_job_count integer;
  v_updated_count integer;
  v_subtotal_cents integer;
  v_all_jobs_paid boolean;
  v_paid_at timestamptz := statement_timestamp();
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required.';
  end if;

  if p_company_id is null or not exists (
    select 1
    from public.company_members membership
    where membership.company_id = p_company_id
      and membership.user_id = v_user_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'You do not have access to the selected company.';
  end if;

  if nullif(btrim(p_invoice_number), '') is null
    or p_invoice_date is null
    or nullif(btrim(p_contractor_name), '') is null
    or nullif(btrim(p_bill_to_name), '') is null
    or nullif(btrim(p_bill_to_address), '') is null
  then
    raise exception using
      errcode = '22023',
      message = 'Required invoice fields cannot be empty.';
  end if;

  if p_due_date is not null and p_due_date < p_invoice_date then
    raise exception using
      errcode = '22023',
      message = 'Due date cannot be before the invoice date.';
  end if;

  if p_job_ids is null
    or cardinality(p_job_ids) = 0
    or array_position(p_job_ids, null) is not null
    or cardinality(p_job_ids) <> (
      select count(distinct job_id)
      from unnest(p_job_ids) as selected_jobs(job_id)
    )
  then
    raise exception using
      errcode = '22023',
      message = 'Select at least one unique completed job.';
  end if;

  select builder.name
  into v_builder_name
  from public.builders builder
  where builder.id = p_builder_id;

  if v_builder_name is null then
    raise exception using
      errcode = 'P0002',
      message = 'Builder not found.';
  end if;

  -- Serialize competing invoice attempts for the same jobs. Eligibility is
  -- checked only after these row locks have been acquired.
  perform job.id
  from public.jobs job
  where job.id = any(p_job_ids)
  order by job.id
  for update;

  select
    count(*),
    coalesce(sum(coalesce(job.price_cents, 0)), 0)::integer,
    coalesce(bool_and(coalesce(job.is_paid, false)), false)
  into v_job_count, v_subtotal_cents, v_all_jobs_paid
  from public.jobs job
  join public.projects project on project.id = job.project_id
  where job.id = any(p_job_ids)
    and job.company_id = p_company_id
    and project.company_id = p_company_id
    and project.builder_id = p_builder_id
    and job.deleted_at is null
    and project.deleted_at is null
    and job.is_completed is true
    and coalesce(job.is_invoiced, false) is false;

  if v_job_count <> cardinality(p_job_ids) then
    raise exception using
      errcode = 'P0001',
      message = 'One or more selected jobs are no longer eligible for this invoice.';
  end if;

  insert into public.invoices (
    project_id,
    user_id,
    company_id,
    invoice_number,
    invoice_date,
    due_date,
    contractor_name,
    contractor_address,
    contractor_phone,
    bill_to_name,
    bill_to_address,
    subtotal_cents,
    is_paid,
    paid_at
  )
  values (
    null,
    v_user_id,
    p_company_id,
    p_invoice_number,
    p_invoice_date,
    p_due_date,
    p_contractor_name,
    nullif(p_contractor_address, ''),
    nullif(p_contractor_phone, ''),
    p_bill_to_name,
    p_bill_to_address,
    v_subtotal_cents,
    v_all_jobs_paid,
    case when v_all_jobs_paid then v_paid_at else null end
  )
  returning id into v_invoice_id;

  insert into public.invoice_items (
    invoice_id,
    job_id,
    project_id_snapshot,
    project_address_snapshot,
    subdivision_name_raw_snapshot,
    builder_name_snapshot,
    job_title_snapshot,
    job_price_cents_snapshot,
    is_paid,
    paid_at
  )
  select
    v_invoice_id,
    job.id,
    project.id,
    btrim(regexp_replace(split_part(project.project_address, ',', 1), '\s+', ' ', 'g')),
    coalesce(nullif(btrim(project.subdivision), ''), 'Unassigned'),
    v_builder_name,
    job.title,
    job.price_cents,
    coalesce(job.is_paid, false),
    case
      when job.is_paid is true then coalesce(job.paid_at, v_paid_at)
      else null
    end
  from public.jobs job
  join public.projects project on project.id = job.project_id
  where job.id = any(p_job_ids);

  update public.jobs
  set is_invoiced = true
  where id = any(p_job_ids)
    and company_id = p_company_id;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> cardinality(p_job_ids) then
    raise exception using
      errcode = 'P0001',
      message = 'Failed to mark every selected job as invoiced.';
  end if;

  return v_invoice_id;
end;
$$;

revoke all on function public.create_invoice_for_builder_atomic(
  uuid, uuid, text, date, date, text, text, text, text, text, uuid[]
) from public;

grant execute on function public.create_invoice_for_builder_atomic(
  uuid, uuid, text, date, date, text, text, text, text, text, uuid[]
) to authenticated;

comment on function public.create_invoice_for_builder_atomic(
  uuid, uuid, text, date, date, text, text, text, text, text, uuid[]
) is 'Atomically creates a builder invoice and items, then marks its jobs invoiced.';
