-- Revision-bound preview compilation. Opt in after the worker can consume this queue.
create table public.document_preview_policy (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false
);
insert into public.document_preview_policy (singleton) values (true);

create table public.document_preview_jobs (
  document_id uuid primary key references public.documents(id) on delete cascade,
  source_revision uuid not null,
  available_at timestamptz not null,
  attempt integer not null default 0,
  lease_token uuid,
  lease_expires_at timestamptz,
  completed boolean not null default false
);
create index document_preview_jobs_ready_idx
  on public.document_preview_jobs (available_at) where not completed;
alter table public.document_preview_jobs enable row level security;
alter table public.document_preview_policy enable row level security;
revoke all on public.document_preview_jobs, public.document_preview_policy from public, anon, authenticated, service_role;

create function public.enqueue_document_preview() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.source_revision is not distinct from old.source_revision
     or new.pdf_source_revision = new.source_revision
     or new.owner_id is null
     or not (select enabled from public.document_preview_policy where singleton) then
    return new;
  end if;
  insert into public.document_preview_jobs (document_id, source_revision, available_at)
    values (new.id, new.source_revision, now() + interval '1 second')
  on conflict (document_id) do update set
    source_revision = excluded.source_revision, available_at = excluded.available_at,
    attempt = 0, lease_token = null, lease_expires_at = null, completed = false;
  return new;
end;
$$;

create trigger documents_enqueue_preview
after update on public.documents for each row execute function public.enqueue_document_preview();

create function public.claim_document_preview() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  job public.document_preview_jobs%rowtype;
  doc public.documents%rowtype;
  quota integer;
  admitted integer;
begin
  perform public.mcp_assert_service_role();
  if not (select enabled from public.document_preview_policy where singleton) then return null; end if;
  select j.* into job from public.document_preview_jobs j
  where not j.completed and j.available_at <= now()
    and (j.lease_expires_at is null or j.lease_expires_at <= now())
  order by j.available_at limit 1 for update skip locked;
  if not found then return null; end if;

  select * into doc from public.documents where id = job.document_id;
  if not found or doc.source_revision <> job.source_revision
      or doc.pdf_source_revision = doc.source_revision or doc.owner_id is null or job.attempt >= 3 then
    update public.document_preview_jobs set completed = true where document_id = job.document_id;
    return null;
  end if;

  if job.attempt = 0 then
    select coalesce((select daily_compile_limit from public.mcp_compile_policy where user_id = doc.owner_id), 10)
      into quota;
    insert into public.mcp_compile_daily_usage as usage (user_id, usage_date, admitted_count)
      values (doc.owner_id, current_date, 1)
    on conflict (user_id, usage_date) do update
      set admitted_count = usage.admitted_count + 1
      where usage.admitted_count < quota
    returning admitted_count into admitted;
    if admitted is null then
      update public.document_preview_jobs set completed = true where document_id = job.document_id;
      return null;
    end if;
  end if;

  update public.document_preview_jobs set attempt = attempt + 1, lease_token = gen_random_uuid(),
    lease_expires_at = now() + interval '5 minutes'
  where document_id = job.document_id returning * into job;
  return jsonb_build_object('documentId', doc.id, 'revision', job.source_revision, 'leaseToken', job.lease_token,
    'latex', doc.latex, 'files', doc.files, 'rootFile', doc.root_file, 'template', doc.template);
end;
$$;

create or replace function public.retry_document_preview(
  p_document_id uuid, p_revision uuid, p_lease_token uuid
) returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.mcp_assert_service_role();
  update public.document_preview_jobs set
    available_at = now() + (attempt * interval '5 seconds'),
    lease_token = null,
    lease_expires_at = null
  where document_id = p_document_id and source_revision = p_revision
    and lease_token = p_lease_token and lease_expires_at > now()
    and not completed and attempt < 3;
  return found;
end;
$$;

create function public.finish_document_preview(
  p_document_id uuid, p_revision uuid, p_lease_token uuid, p_pdf text, p_log text
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  doc public.documents%rowtype;
begin
  perform public.mcp_assert_service_role();
  select * into doc from public.documents where id = p_document_id for update;
  if not found or doc.source_revision <> p_revision then return false; end if;

  update public.document_preview_jobs set completed = true
    where document_id = p_document_id and source_revision = p_revision
      and lease_token = p_lease_token and lease_expires_at > now() and not completed;
  if not found then return false; end if;
  if doc.pdf_source_revision = p_revision then return true; end if;
  if p_pdf is not null and length(p_pdf) <= 26666668 then
    update public.documents set pdf_base64 = p_pdf, pdf_source_revision = p_revision,
      error = null, log = null where id = p_document_id;
  else
    update public.documents set error = 'Biên dịch preview thất bại.',
      log = left(coalesce(p_log, 'PDF vượt quá giới hạn.'), 16000) where id = p_document_id;
  end if;
  return true;
end;
$$;

revoke all on function public.enqueue_document_preview() from public, anon, authenticated, service_role;
revoke all on function public.claim_document_preview() from public, anon, authenticated;
revoke all on function public.retry_document_preview(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.finish_document_preview(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_document_preview() to service_role;
grant execute on function public.retry_document_preview(uuid, uuid, uuid) to service_role;
grant execute on function public.finish_document_preview(uuid, uuid, uuid, text, text) to service_role;
