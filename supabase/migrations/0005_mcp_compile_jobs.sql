-- supabase/migrations/0005_mcp_compile_jobs.sql
-- Durable MCP compile jobs, immutable artifacts, bearer grants and per-user policy.
--
-- Security invariants:
--   * Jobs/artifacts are written only through the SECURITY DEFINER RPCs below. anon,
--     authenticated and service_role get NO table privileges; owner-read RLS on jobs/artifacts
--     is defense in depth for a future read path, not the current access path.
--   * User RPCs derive the owner from auth.uid() and never accept an owner_id argument.
--     enqueue/get/cancel/create-grant are executable by authenticated only.
--   * Worker RPCs require auth.role() = 'service_role' and are executable by service_role only.
--     A user JWT can never claim, finish, redeem, or clean up jobs.
--   * Publication is fenced by status = 'running' AND lease_token match AND
--     lease_expires_at > now(). Stale/expired leases, cancelled/cancel_requested jobs, and
--     duplicate publication are rejected while the job row is locked.
--   * Artifact source/PDF bytes are immutable. The only permitted artifact UPDATE is a
--     foreign-key action nulling job_id/document_id when a retained row is removed.
--   * Grants store only SHA-256 token hashes (never the bearer token). Redemption is an atomic
--     one-time UPDATE gated by consumed_at IS NULL AND expires_at > now().
--   * Cleanup never deletes public.documents and never deletes an artifact while an unexpired
--     grant still references it. Each cleanup category is batch-bounded.
--
-- Assumptions / limitations:
--   * Supabase roles (anon, authenticated, service_role), auth.uid()/auth.role(), and
--     public.documents from 0001_documents.sql exist.
--   * pgcrypto is installed by 0001. `digest` is resolved through a pinned search_path that
--     includes both `extensions` (Supabase default) and `public` (plain Postgres default).
--   * The quota day uses current_date in the database timezone (Supabase default: UTC).
--   * Defaults in mcp_compile_policy are technical, configurable defaults. They are NOT product
--     SLAs or business guarantees. Cancellation does not refund admitted quota.
--   * A lease that expires at max_attempts is failed without creating a documents row (no worker
--     was present to hand back diagnostics); the immutable job input remains until retention.
--   * Apply only through Supabase migration tooling after a staging rehearsal.
--
-- This migration is self-contained after 0001 and intentionally idempotent on re-run.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------------------------
-- Input shape validation (pure/immutable so it can also back a table CHECK).
-- The accepted shape is:
--   { title:string, docType:'article'|'report', template?:TemplateId,
--     latex?:string, files?:ProjectFile[], rootFile?:string }
-- Unknown keys and explicit JSON null for optional keys are rejected.
-- ---------------------------------------------------------------------------------------------

create or replace function public.mcp_is_safe_relative_path(p_path text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_path is null then
    return false;
  end if;
  if char_length(p_path) = 0 or char_length(p_path) > 255 then
    return false;
  end if;
  if p_path <> btrim(p_path) then
    return false;
  end if;
  -- POSIX relative paths only: no absolute path, drive letter, backslash, "."/".." segment,
  -- empty segment, or trailing slash.
  if position('/' in p_path) = 1 then
    return false;
  end if;
  if position(chr(92) in p_path) > 0 then
    return false;
  end if;
  if p_path ~ '[[:cntrl:]]' then
    return false;
  end if;
  if p_path ~ '^[A-Za-z]:' then
    return false;
  end if;
  if p_path ~ '(^|/)\.\.?(/|$)' then
    return false;
  end if;
  if p_path ~ '//' then
    return false;
  end if;
  if right(p_path, 1) = '/' then
    return false;
  end if;
  return true;
end;
$$;

create or replace function public.mcp_compile_input_error(p_input jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_key text;
  v_file jsonb;
  v_files jsonb;
  v_path text;
  v_root text;
  v_seen text[] := '{}';
begin
  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    return 'input must be a JSON object';
  end if;

  for v_key in select jsonb_object_keys(p_input) loop
    if v_key not in ('title', 'docType', 'template', 'latex', 'files', 'rootFile') then
      return format('unknown input key: %s', v_key);
    end if;
  end loop;

  if jsonb_typeof(p_input->'title') is distinct from 'string' then
    return 'title must be a string';
  end if;
  if char_length(btrim(p_input->>'title')) = 0 then
    return 'title must not be empty';
  end if;
  if char_length(p_input->>'title') > 500 then
    return 'title must be at most 500 characters';
  end if;

  if jsonb_typeof(p_input->'docType') is distinct from 'string'
     or (p_input->>'docType') not in ('article', 'report') then
    return 'docType must be article or report';
  end if;

  if p_input ? 'template' then
    if jsonb_typeof(p_input->'template') <> 'string'
       or (p_input->>'template') not in (
         'academic', 'math', 'thesis', 'report', 'slides', 'chemistry',
         'physics', 'exam', 'engineering', 'letter', 'cv'
       ) then
      return 'template must be a valid TemplateId';
    end if;
  end if;

  if p_input ? 'latex' then
    if jsonb_typeof(p_input->'latex') <> 'string' then
      return 'latex must be a string';
    end if;
  end if;

  if p_input ? 'rootFile' then
    if jsonb_typeof(p_input->'rootFile') <> 'string' then
      return 'rootFile must be a string';
    end if;
    v_root := p_input->>'rootFile';
    if not public.mcp_is_safe_relative_path(v_root) then
      return 'rootFile must be a safe relative POSIX path';
    end if;
  end if;

  if p_input ? 'files' then
    v_files := p_input->'files';
    if jsonb_typeof(v_files) <> 'array' then
      return 'files must be an array';
    end if;

    for v_file in select value from jsonb_array_elements(v_files) loop
      if jsonb_typeof(v_file) <> 'object' then
        return 'each files[] entry must be an object';
      end if;

      for v_key in select jsonb_object_keys(v_file) loop
        if v_key not in ('path', 'content', 'contentBase64') then
          return format('unknown files[] key: %s', v_key);
        end if;
      end loop;

      if jsonb_typeof(v_file->'path') is distinct from 'string' then
        return 'files[].path must be a string';
      end if;
      v_path := v_file->>'path';
      if not public.mcp_is_safe_relative_path(v_path) then
        return 'files[].path must be a safe relative POSIX path';
      end if;
      if v_path = any(v_seen) then
        return format('duplicate files[].path: %s', v_path);
      end if;
      v_seen := v_seen || v_path;

      -- Exactly one of content (text) or contentBase64 (binary) per ProjectFile.
      if (v_file ? 'content') = (v_file ? 'contentBase64') then
        return 'each files[] entry needs exactly one of content or contentBase64';
      end if;
      if v_file ? 'content' then
        if jsonb_typeof(v_file->'content') <> 'string' then
          return 'files[].content must be a string';
        end if;
      else
        if jsonb_typeof(v_file->'contentBase64') <> 'string' then
          return 'files[].contentBase64 must be a string';
        end if;
      end if;
    end loop;

    if v_root is not null and not exists (
      select 1
      from jsonb_array_elements(v_files) as f
      where f.value->>'path' = v_root
    ) then
      return 'rootFile must reference one of files[].path';
    end if;
  end if;

  return null;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Per-user policy. Defaults are technical and configurable by trusted operators only; clients
-- get no table privileges and no RLS policy, so users cannot raise their own limits.
-- ---------------------------------------------------------------------------------------------

create table if not exists public.mcp_compile_policy (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_compile_limit integer not null default 10
    check (daily_compile_limit between 1 and 10000),
  grant_ttl_seconds integer not null default 300
    check (grant_ttl_seconds between 1 and 604800),
  worker_lease_seconds integer not null default 120
    check (worker_lease_seconds between 1 and 3600),
  max_attempts integer not null default 3
    check (max_attempts between 1 and 10),
  artifact_retention_days integer not null default 30
    check (artifact_retention_days between 1 and 3650),
  job_retention_days integer not null default 30
    check (job_retention_days between 1 and 3650),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.mcp_compile_policy is
  'Per-user MCP compile policy. Technical configurable defaults, not business guarantees.';

-- ---------------------------------------------------------------------------------------------
-- Jobs. input/input_hash/idempotency_key/owner are immutable after insert (trigger below).
-- artifact_id FK is added after mcp_artifacts exists (circular reference).
-- ---------------------------------------------------------------------------------------------

create table if not exists public.mcp_compile_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  input jsonb not null,
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  idempotency_key text not null
    check (char_length(idempotency_key) between 1 and 200),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'cancel_requested', 'succeeded', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts between 0 and 1000),
  worker_id text check (worker_id is null or char_length(worker_id) between 1 and 200),
  lease_token uuid,
  lease_expires_at timestamptz,
  document_id uuid references public.documents(id) on delete set null,
  artifact_id uuid,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  cancel_requested_at timestamptz,
  constraint mcp_compile_jobs_owner_key unique (owner_id, idempotency_key),
  constraint mcp_compile_jobs_input_shape
    check (public.mcp_compile_input_error(input) is null),
  constraint mcp_compile_jobs_lease_state check (
    (status in ('queued', 'succeeded', 'failed', 'cancelled')
      and lease_token is null and lease_expires_at is null)
    or
    (status in ('running', 'cancel_requested')
      and lease_token is not null and lease_expires_at is not null)
  )
);

comment on table public.mcp_compile_jobs is
  'Durable compile queue. Clients have no direct DML; quota/idempotency/lease transitions are RPC-only.';
comment on column public.mcp_compile_jobs.input is
  'Immutable validated source snapshot. Never returned by the owner-safe get job RPC.';
comment on column public.mcp_compile_jobs.lease_token is
  'Fencing token. Terminal transitions clear it so an old worker cannot publish.';

-- ---------------------------------------------------------------------------------------------
-- Artifacts: one immutable source/PDF snapshot per successful job. Payload columns are guarded
-- by a trigger; only FK-nulling of job_id/document_id is allowed during retention cleanup.
-- ---------------------------------------------------------------------------------------------

create table if not exists public.mcp_artifacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.mcp_compile_jobs(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  source jsonb not null,
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  pdf_base64 text not null check (char_length(pdf_base64) > 0),
  pdf_bytes bigint not null check (pdf_bytes > 0),
  log text,
  created_at timestamptz not null default now(),
  constraint mcp_artifacts_job_id_key unique (job_id),
  constraint mcp_artifacts_source_shape
    check (public.mcp_compile_input_error(source) is null)
);

comment on table public.mcp_artifacts is
  'Immutable published artifact snapshot. Downloads must read this table, never documents.pdf_base64.';
comment on column public.mcp_artifacts.source_hash is
  'SHA-256 (pgcrypto) of the canonical jsonb source snapshot.';

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint c
    where c.conname = 'mcp_compile_jobs_artifact_id_fkey'
      and c.conrelid = 'public.mcp_compile_jobs'::regclass
  ) then
    alter table public.mcp_compile_jobs
      add constraint mcp_compile_jobs_artifact_id_fkey
      foreign key (artifact_id) references public.mcp_artifacts(id) on delete set null;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Bearer download grants. Only the hash is stored; the raw token is never persisted.
-- ---------------------------------------------------------------------------------------------

create table if not exists public.mcp_artifact_grants (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.mcp_artifacts(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  format text not null check (format in ('pdf', 'source')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint mcp_artifact_grants_token_hash_key unique (token_hash),
  constraint mcp_artifact_grants_expiry check (expires_at > created_at),
  constraint mcp_artifact_grants_consumed check (consumed_at is null or consumed_at >= created_at)
);

comment on table public.mcp_artifact_grants is
  'Opaque bearer capability. token_hash = SHA-256 hex of the raw token; raw token is never stored.';

-- ---------------------------------------------------------------------------------------------
-- Atomic per-user/day quota. Quota is admitted at enqueue; cancellation does not refund.
-- ---------------------------------------------------------------------------------------------

create table if not exists public.mcp_compile_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  admitted_count integer not null default 0 check (admitted_count >= 0),
  primary key (user_id, usage_date)
);

-- Queue/claim and owner lookup paths.
create index if not exists mcp_compile_jobs_queued_idx
  on public.mcp_compile_jobs (created_at, id)
  where status = 'queued';
create index if not exists mcp_compile_jobs_lease_idx
  on public.mcp_compile_jobs (lease_expires_at)
  where status in ('running', 'cancel_requested');
create index if not exists mcp_compile_jobs_owner_created_idx
  on public.mcp_compile_jobs (owner_id, created_at desc);
create index if not exists mcp_compile_jobs_document_idx
  on public.mcp_compile_jobs (document_id);
create index if not exists mcp_compile_jobs_artifact_idx
  on public.mcp_compile_jobs (artifact_id);
create index if not exists mcp_compile_jobs_finished_idx
  on public.mcp_compile_jobs (finished_at)
  where status in ('succeeded', 'failed', 'cancelled');

create index if not exists mcp_artifacts_owner_created_idx
  on public.mcp_artifacts (owner_id, created_at desc);
create index if not exists mcp_artifacts_document_idx
  on public.mcp_artifacts (document_id);
create index if not exists mcp_artifacts_created_idx
  on public.mcp_artifacts (created_at);

create index if not exists mcp_artifact_grants_artifact_idx
  on public.mcp_artifact_grants (artifact_id);
create index if not exists mcp_artifact_grants_expiry_idx
  on public.mcp_artifact_grants (expires_at);
create index if not exists mcp_artifact_grants_owner_created_idx
  on public.mcp_artifact_grants (owner_id, created_at desc);

create index if not exists mcp_compile_daily_usage_date_idx
  on public.mcp_compile_daily_usage (usage_date);

-- ---------------------------------------------------------------------------------------------
-- Triggers: updated_at, immutable job identity, immutable artifact payload.
-- ---------------------------------------------------------------------------------------------

create or replace function public.mcp_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.mcp_compile_jobs_protect_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id
     or new.input is distinct from old.input
     or new.input_hash is distinct from old.input_hash
     or new.idempotency_key is distinct from old.idempotency_key
     or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = 'P0001',
      message = 'job_identity_immutable';
  end if;
  return new;
end;
$$;

create or replace function public.mcp_artifacts_protect_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id
     or new.source is distinct from old.source
     or new.source_hash is distinct from old.source_hash
     or new.pdf_base64 is distinct from old.pdf_base64
     or new.pdf_bytes is distinct from old.pdf_bytes
     or new.log is distinct from old.log
     or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = 'P0001',
      message = 'artifact_snapshot_immutable';
  end if;

  -- ON DELETE SET NULL from jobs/documents is the only allowed link change.
  if new.job_id is not null and new.job_id is distinct from old.job_id then
    raise exception using
      errcode = 'P0001',
      message = 'artifact_snapshot_immutable';
  end if;
  if new.document_id is not null and new.document_id is distinct from old.document_id then
    raise exception using
      errcode = 'P0001',
      message = 'artifact_snapshot_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists mcp_compile_policy_set_updated_at on public.mcp_compile_policy;
create trigger mcp_compile_policy_set_updated_at
  before update on public.mcp_compile_policy
  for each row execute function public.mcp_touch_updated_at();

drop trigger if exists mcp_compile_jobs_set_updated_at on public.mcp_compile_jobs;
create trigger mcp_compile_jobs_set_updated_at
  before update on public.mcp_compile_jobs
  for each row execute function public.mcp_touch_updated_at();

drop trigger if exists mcp_compile_jobs_protect_identity on public.mcp_compile_jobs;
create trigger mcp_compile_jobs_protect_identity
  before update on public.mcp_compile_jobs
  for each row execute function public.mcp_compile_jobs_protect_identity();

drop trigger if exists mcp_artifacts_protect_snapshot on public.mcp_artifacts;
create trigger mcp_artifacts_protect_snapshot
  before update on public.mcp_artifacts
  for each row execute function public.mcp_artifacts_protect_snapshot();

-- ---------------------------------------------------------------------------------------------
-- Shared helpers. EXECUTE is revoked from every client/worker role later; only the definer RPCs
-- (owned by the migration role) call these.
-- ---------------------------------------------------------------------------------------------

create or replace function public.mcp_public_job_json(p_job public.mcp_compile_jobs)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_job.id,
    'status', p_job.status,
    'title', p_job.input->>'title',
    'docType', p_job.input->>'docType',
    'template', p_job.input->>'template',
    'attempts', p_job.attempts,
    'documentId', p_job.document_id,
    'artifactId', p_job.artifact_id,
    'error', p_job.error,
    'createdAt', p_job.created_at,
    'updatedAt', p_job.updated_at,
    'startedAt', p_job.started_at,
    'finishedAt', p_job.finished_at,
    'cancelRequestedAt', p_job.cancel_requested_at
  );
$$;

comment on function public.mcp_public_job_json(public.mcp_compile_jobs) is
  'Owner-safe job projection. Deliberately omits input/source, hashes, idempotency key and lease.';

create or replace function public.mcp_assert_service_role()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'forbidden';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- User RPC: enqueue. Caller supplies the SHA-256 of its canonical input; the DB stores and
-- compares both hash and jsonb. Same owner/key/hash/input is a free idempotent replay.
-- Advisory lock serializes the first insert for an owner+key so retries cannot double-charge.
-- ---------------------------------------------------------------------------------------------

create or replace function public.mcp_enqueue_compile(
  p_input jsonb,
  p_input_hash text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_policy public.mcp_compile_policy%rowtype;
  v_job public.mcp_compile_jobs%rowtype;
  v_input_error text;
  v_used integer;
begin
  if v_owner is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;
  if p_idempotency_key is null
     or char_length(btrim(p_idempotency_key)) = 0
     or char_length(p_idempotency_key) > 200 then
    raise exception using errcode = '22023', message = 'invalid_idempotency_key';
  end if;
  if p_input_hash is null or p_input_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_input_hash';
  end if;

  v_input_error := public.mcp_compile_input_error(p_input);
  if v_input_error is not null then
    raise exception using
      errcode = '22023',
      message = 'invalid_input',
      detail = v_input_error;
  end if;

  insert into public.mcp_compile_policy (user_id)
  values (v_owner)
  on conflict (user_id) do nothing;

  select * into v_policy
  from public.mcp_compile_policy
  where user_id = v_owner;

  -- Transaction-scoped serialization for this idempotency key. A collision only serializes
  -- unrelated owners; it cannot bypass the unique(owner_id, idempotency_key) constraint.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':' || p_idempotency_key, 0)
  );

  select * into v_job
  from public.mcp_compile_jobs
  where owner_id = v_owner and idempotency_key = p_idempotency_key;

  if found then
    if v_job.input_hash = p_input_hash and v_job.input = p_input then
      select asserted.admitted_count into v_used
      from public.mcp_compile_daily_usage as asserted
      where asserted.user_id = v_owner and asserted.usage_date = current_date;

      return jsonb_build_object(
        'job', public.mcp_public_job_json(v_job),
        'reused', true,
        'quota', jsonb_build_object(
          'limit', v_policy.daily_compile_limit,
          'used', coalesce(v_used, 0),
          'remaining', greatest(v_policy.daily_compile_limit - coalesce(v_used, 0), 0)
        )
      );
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'idempotency_conflict',
      detail = jsonb_build_object('jobId', v_job.id, 'status', v_job.status)::text;
  end if;

  insert into public.mcp_compile_daily_usage as u (user_id, usage_date, admitted_count)
  values (v_owner, current_date, 1)
  on conflict (user_id, usage_date) do update
    set admitted_count = u.admitted_count + 1
    where u.admitted_count < v_policy.daily_compile_limit
  returning u.admitted_count into v_used;

  if v_used is null then
    select asserted.admitted_count into v_used
    from public.mcp_compile_daily_usage as asserted
    where asserted.user_id = v_owner and asserted.usage_date = current_date;

    raise exception using
      errcode = 'P0001',
      message = 'quota_exceeded',
      detail = jsonb_build_object(
        'limit', v_policy.daily_compile_limit,
        'used', coalesce(v_used, 0)
      )::text;
  end if;

  insert into public.mcp_compile_jobs (owner_id, input, input_hash, idempotency_key)
  values (v_owner, p_input, p_input_hash, p_idempotency_key)
  returning * into v_job;

  return jsonb_build_object(
    'job', public.mcp_public_job_json(v_job),
    'reused', false,
    'quota', jsonb_build_object(
      'limit', v_policy.daily_compile_limit,
      'used', v_used,
      'remaining', greatest(v_policy.daily_compile_limit - v_used, 0)
    )
  );
end;
$$;

comment on function public.mcp_enqueue_compile(jsonb, text, text) is
  'Admit one compile job for auth.uid(). Idempotent replay is free; changed hash is a conflict.';

-- ---------------------------------------------------------------------------------------------
-- User RPC: owner-safe read. Returns NULL for both missing and foreign jobs (no existence leak).
-- ---------------------------------------------------------------------------------------------

create or replace function public.mcp_get_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_job public.mcp_compile_jobs%rowtype;
begin
  if v_owner is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  select * into v_job
  from public.mcp_compile_jobs
  where id = p_job_id and owner_id = v_owner;

  if not found then
    return null;
  end if;
  return public.mcp_public_job_json(v_job);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- User RPC: cancel. queued -> cancelled (terminal, no quota refund); running -> cancel_requested
-- (publish is blocked by finish). Terminal states are returned unchanged.
-- ---------------------------------------------------------------------------------------------

create or replace function public.mcp_cancel_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_job public.mcp_compile_jobs%rowtype;
begin
  if v_owner is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  select * into v_job
  from public.mcp_compile_jobs
  where id = p_job_id and owner_id = v_owner
  for update;

  if not found then
    return null;
  end if;

  if v_job.status = 'queued' then
    update public.mcp_compile_jobs
    set status = 'cancelled',
        error = 'cancelled_by_owner',
        finished_at = now(),
        lease_token = null,
        lease_expires_at = null
    where id = v_job.id
    returning * into v_job;
  elsif v_job.status = 'running' then
    update public.mcp_compile_jobs
    set status = 'cancel_requested',
        cancel_requested_at = now()
    where id = v_job.id
    returning * into v_job;
  end if;

  return public.mcp_public_job_json(v_job);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Worker RPC: atomically finalize/requeue expired leases, then claim one queued job.
-- Attempts increment on claim. A lease expiring at policy.max_attempts becomes failed, never
-- requeued. Expired cancel_requested jobs become terminal cancelled.
-- ---------------------------------------------------------------------------------------------

create or replace function public.mcp_claim_job(
  p_worker_id text,
  p_lease_seconds integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, public, pg_temp
as $$
declare
  v_job public.mcp_compile_jobs%rowtype;
  v_max_attempts integer;
begin
  perform public.mcp_assert_service_role();

  if p_worker_id is null
     or char_length(btrim(p_worker_id)) = 0
     or char_length(p_worker_id) > 200 then
    raise exception using errcode = '22023', message = 'invalid_worker_id';
  end if;
  if p_lease_seconds is not null and (p_lease_seconds < 1 or p_lease_seconds > 3600) then
    raise exception using errcode = '22023', message = 'invalid_lease_seconds';
  end if;

  -- Expired running lease at the retry ceiling: terminal failure.
  update public.mcp_compile_jobs as j
  set status = 'failed',
      error = 'lease_expired_max_attempts',
      finished_at = now(),
      lease_token = null,
      lease_expires_at = null
  where j.status = 'running'
    and j.lease_expires_at <= now()
    and j.attempts >= coalesce(
      (select p.max_attempts from public.mcp_compile_policy as p where p.user_id = j.owner_id),
      3
    );

  -- Defensive: a lowered policy can leave an over-limit queued job behind.
  update public.mcp_compile_jobs as j
  set status = 'failed',
      error = 'max_attempts_reached',
      finished_at = now(),
      lease_token = null,
      lease_expires_at = null
  where j.status = 'queued'
    and j.attempts >= coalesce(
      (select p.max_attempts from public.mcp_compile_policy as p where p.user_id = j.owner_id),
      3
    );

  -- Expired running lease below the ceiling: requeue; attempts stay unchanged until re-claim.
  update public.mcp_compile_jobs as j
  set status = 'queued',
      worker_id = null,
      lease_token = null,
      lease_expires_at = null,
      error = null
  where j.status = 'running'
    and j.lease_expires_at <= now()
    and j.attempts < coalesce(
      (select p.max_attempts from public.mcp_compile_policy as p where p.user_id = j.owner_id),
      3
    );

  -- A running cancel whose execution lease is gone cannot publish; make it terminal.
  update public.mcp_compile_jobs as j
  set status = 'cancelled',
      error = coalesce(j.error, 'cancelled_after_lease_expiry'),
      finished_at = now(),
      lease_token = null,
      lease_expires_at = null
  where j.status = 'cancel_requested'
    and j.lease_expires_at <= now();

  with candidate as (
    select
      j.id,
      coalesce(p_lease_seconds, p.worker_lease_seconds, 120) as lease_seconds
    from public.mcp_compile_jobs as j
    left join public.mcp_compile_policy as p on p.user_id = j.owner_id
    where j.status = 'queued'
    order by j.created_at asc, j.id asc
    limit 1
    for update of j skip locked
  )
  update public.mcp_compile_jobs as j
  set status = 'running',
      attempts = j.attempts + 1,
      worker_id = p_worker_id,
      lease_token = gen_random_uuid(),
      lease_expires_at = now() + make_interval(secs => candidate.lease_seconds),
      started_at = coalesce(j.started_at, now()),
      finished_at = null,
      error = null
  from candidate
  where j.id = candidate.id
  returning j.* into v_job;

  if not found then
    return null;
  end if;

  select coalesce(
    (select p.max_attempts from public.mcp_compile_policy as p where p.user_id = v_job.owner_id),
    3
  ) into v_max_attempts;

  return jsonb_build_object(
    'status', 'running',
    'jobId', v_job.id,
    'ownerId', v_job.owner_id,
    'input', v_job.input,
    'inputHash', v_job.input_hash,
    'attempts', v_job.attempts,
    'maxAttempts', v_max_attempts,
    'workerId', v_job.worker_id,
    'leaseToken', v_job.lease_token,
    'leaseExpiresAt', v_job.lease_expires_at,
    'createdAt', v_job.created_at
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Worker RPC: fenced publication. Locking the job row + token/expiry/status checks makes a stale
-- worker, a cancelled job, or a duplicate publication lose cleanly. All writes are one
-- transaction: documents row, optional artifact, terminal job update.
-- ---------------------------------------------------------------------------------------------

create or replace function public.mcp_finish_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_success boolean,
  p_pdf_base64 text,
  p_log text
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, public, pg_temp
as $$
declare
  v_job public.mcp_compile_jobs%rowtype;
  v_document_id uuid;
  v_artifact_id uuid;
  v_source_latex text;
  v_template text;
  v_error text;
  v_pdf_bytes bigint;
  v_finished_at timestamptz := now();
begin
  perform public.mcp_assert_service_role();

  if p_job_id is null or p_lease_token is null or p_success is null then
    raise exception using errcode = '22023', message = 'invalid_finish_arguments';
  end if;
  if p_success and (p_pdf_base64 is null or char_length(p_pdf_base64) = 0) then
    raise exception using errcode = '22023', message = 'missing_pdf';
  end if;

  select * into v_job
  from public.mcp_compile_jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'job_not_found';
  end if;
  if v_job.status in ('succeeded', 'failed') then
    raise exception using errcode = '55000', message = 'already_finished';
  end if;
  if v_job.status = 'cancelled' then
    raise exception using errcode = '55000', message = 'job_cancelled';
  end if;
  if v_job.status = 'cancel_requested' then
    raise exception using errcode = '55000', message = 'job_cancel_requested';
  end if;
  if v_job.status <> 'running' then
    raise exception using errcode = '55000', message = 'job_not_running';
  end if;
  if v_job.lease_token is distinct from p_lease_token then
    raise exception using errcode = '40001', message = 'stale_lease';
  end if;
  if v_job.lease_expires_at is null or v_job.lease_expires_at <= now() then
    raise exception using errcode = '40001', message = 'lease_expired';
  end if;
  if v_job.document_id is not null
     or v_job.artifact_id is not null
     or exists (
       select 1 from public.mcp_artifacts as a where a.job_id = v_job.id
     ) then
    raise exception using errcode = '23505', message = 'duplicate_publication';
  end if;

  -- Documents.template is NOT NULL, while the compile input's template is optional.
  -- This deterministic mapping is the only fallback; it is not a business choice.
  v_template := coalesce(
    v_job.input->>'template',
    case when v_job.input->>'docType' = 'report' then 'report' else 'academic' end
  );

  -- Keep the root source readable for single-file and multi-file failures.
  v_source_latex := coalesce(v_job.input->>'latex', '');
  if char_length(btrim(v_source_latex)) = 0
     and jsonb_typeof(v_job.input->'files') = 'array' then
    select f.value->>'content' into v_source_latex
    from jsonb_array_elements(v_job.input->'files') as f
    where f.value->>'path' = coalesce(v_job.input->>'rootFile', 'main.tex')
      and f.value ? 'content'
    limit 1;
    v_source_latex := coalesce(v_source_latex, '');
  end if;

  if p_success then
    begin
      v_pdf_bytes := octet_length(decode(p_pdf_base64, 'base64'));
    exception
      when invalid_text_representation or invalid_parameter_value then
        raise exception using errcode = '22023', message = 'invalid_pdf_base64';
    end;
    if v_pdf_bytes is null or v_pdf_bytes = 0 then
      raise exception using errcode = '22023', message = 'missing_pdf';
    end if;
    v_error := null;
  else
    -- Normalize the job/document error; full compiler diagnostics stay in documents.log and the
    -- job input is not exposed by mcp_get_job.
    v_error := 'compile_failed';
  end if;

  insert into public.documents (
    owner_id,
    title,
    doc_type,
    template,
    description,
    latex,
    pdf_base64,
    log,
    error,
    attempts,
    messages,
    input_format,
    files,
    root_file
  ) values (
    v_job.owner_id,
    v_job.input->>'title',
    v_job.input->>'docType',
    v_template,
    '',
    v_source_latex,
    case when p_success then p_pdf_base64 else null end,
    p_log,
    v_error,
    greatest(v_job.attempts, 1),
    '[]'::jsonb,
    'latex',
    case
      when jsonb_typeof(v_job.input->'files') = 'array' then v_job.input->'files'
      else null
    end,
    v_job.input->>'rootFile'
  )
  returning id into v_document_id;

  if p_success then
    insert into public.mcp_artifacts (
      owner_id,
      job_id,
      document_id,
      source,
      source_hash,
      pdf_base64,
      pdf_bytes,
      log
    ) values (
      v_job.owner_id,
      v_job.id,
      v_document_id,
      v_job.input,
      encode(digest(convert_to(v_job.input::text, 'UTF8'), 'sha256'), 'hex'),
      p_pdf_base64,
      v_pdf_bytes,
      p_log
    )
    returning id into v_artifact_id;

    update public.mcp_compile_jobs
    set status = 'succeeded',
        document_id = v_document_id,
        artifact_id = v_artifact_id,
        error = null,
        finished_at = v_finished_at,
        lease_token = null,
        lease_expires_at = null
    where id = v_job.id;
  else
    update public.mcp_compile_jobs
    set status = 'failed',
        document_id = v_document_id,
        artifact_id = null,
        error = v_error,
        finished_at = v_finished_at,
        lease_token = null,
        lease_expires_at = null
    where id = v_job.id;
  end if;

  return jsonb_build_object(
    'jobId', v_job.id,
    'status', case when p_success then 'succeeded' else 'failed' end,
    'documentId', v_document_id,
    'artifactId', v_artifact_id,
    'attempts', v_job.attempts,
    'finishedAt', v_finished_at
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- User RPC: create a short-lived download grant for an owned artifact. Only the pre-computed
-- SHA-256 token hash is accepted/stored. The raw token never enters the database.
-- ---------------------------------------------------------------------------------------------

create or replace function public.mcp_create_artifact_grant(
  p_artifact_id uuid,
  p_token_hash text,
  p_format text
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_artifact public.mcp_artifacts%rowtype;
  v_policy public.mcp_compile_policy%rowtype;
  v_grant_id uuid;
  v_expires_at timestamptz;
begin
  if v_owner is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_token_hash';
  end if;
  if p_format is null or p_format not in ('pdf', 'source') then
    raise exception using errcode = '22023', message = 'invalid_format';
  end if;

  select * into v_artifact
  from public.mcp_artifacts
  where id = p_artifact_id and owner_id = v_owner;

  -- Owner-only without leaking whether a foreign artifact exists.
  if not found then
    return null;
  end if;

  if p_format = 'source' and (v_artifact.source ? 'files' or not (v_artifact.source ? 'latex')) then
    return null;
  end if;

  insert into public.mcp_compile_policy (user_id)
  values (v_owner)
  on conflict (user_id) do nothing;

  select * into v_policy
  from public.mcp_compile_policy
  where user_id = v_owner;

  v_expires_at := now() + make_interval(secs => v_policy.grant_ttl_seconds);

  begin
    insert into public.mcp_artifact_grants (
      artifact_id,
      owner_id,
      token_hash,
      format,
      expires_at
    ) values (
      v_artifact.id,
      v_owner,
      p_token_hash,
      p_format,
      v_expires_at
    )
    returning id into v_grant_id;
  exception
    when unique_violation then
      raise exception using errcode = '23505', message = 'token_hash_conflict';
  end;

  return jsonb_build_object(
    'grantId', v_grant_id,
    'artifactId', v_artifact.id,
    'documentId', v_artifact.document_id,
    'format', p_format,
    'expiresAt', v_expires_at
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Worker RPC: redeem a grant exactly once. Invalid/expired/consumed hashes return NULL without
-- consuming anything. The returned snapshot is the immutable artifact row, never documents.
-- ---------------------------------------------------------------------------------------------

create or replace function public.mcp_redeem_artifact_grant(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = extensions, public, pg_temp
as $$
declare
  v_grant public.mcp_artifact_grants%rowtype;
  v_artifact public.mcp_artifacts%rowtype;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  update public.mcp_artifact_grants as g
  set consumed_at = now()
  where g.token_hash = p_token_hash
    and g.consumed_at is null
    and g.expires_at > now()
  returning * into v_grant;

  if not found then
    return null;
  end if;

  select * into v_artifact
  from public.mcp_artifacts
  where id = v_grant.artifact_id;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'artifactId', v_artifact.id,
    'ownerId', v_artifact.owner_id,
    'jobId', v_artifact.job_id,
    'documentId', v_artifact.document_id,
    'format', v_grant.format,
    'sourceHash', v_artifact.source_hash,
    'source', case when v_grant.format = 'source' then v_artifact.source else null end,
    'pdfBase64', case when v_grant.format = 'pdf' then v_artifact.pdf_base64 else null end,
    'pdfBytes', v_artifact.pdf_bytes,
    'log', v_artifact.log,
    'createdAt', v_artifact.created_at,
    'expiresAt', v_grant.expires_at
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Worker RPC: bounded retention cleanup. Never touches documents. An artifact is eligible only
-- when it has no grant whose lifetime has not ended (unexpired grants include consumed ones).
-- ---------------------------------------------------------------------------------------------

create or replace function public.mcp_cleanup_expired(p_batch_size integer default 1000)
returns jsonb
language plpgsql
security definer
set search_path = extensions, public, pg_temp
as $$
declare
  v_grants_deleted integer := 0;
  v_artifacts_deleted integer := 0;
  v_jobs_deleted integer := 0;
begin
  perform public.mcp_assert_service_role();

  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 10000 then
    raise exception using errcode = '22023', message = 'invalid_batch_size';
  end if;

  with doomed as (
    select g.id
    from public.mcp_artifact_grants as g
    where g.expires_at <= now()
    order by g.expires_at asc
    limit p_batch_size
    for update skip locked
  )
  delete from public.mcp_artifact_grants as g
  using doomed
  where g.id = doomed.id;
  get diagnostics v_grants_deleted = row_count;

  with doomed as (
    select a.id
    from public.mcp_artifacts as a
    left join public.mcp_compile_policy as p on p.user_id = a.owner_id
    where a.created_at < now() - make_interval(days => coalesce(p.artifact_retention_days, 30))
      and not exists (
        select 1
        from public.mcp_artifact_grants as g
        where g.artifact_id = a.id
          and g.expires_at > now()
      )
    order by a.created_at asc
    limit p_batch_size
    for update of a skip locked
  )
  delete from public.mcp_artifacts as a
  using doomed
  where a.id = doomed.id;
  get diagnostics v_artifacts_deleted = row_count;

  with doomed as (
    select j.id
    from public.mcp_compile_jobs as j
    left join public.mcp_compile_policy as p on p.user_id = j.owner_id
    where j.status in ('succeeded', 'failed', 'cancelled')
      and coalesce(j.finished_at, j.updated_at)
        < now() - make_interval(days => coalesce(p.job_retention_days, 30))
    order by coalesce(j.finished_at, j.updated_at) asc
    limit p_batch_size
    for update of j skip locked
  )
  delete from public.mcp_compile_jobs as j
  using doomed
  where j.id = doomed.id;
  get diagnostics v_jobs_deleted = row_count;

  return jsonb_build_object(
    'expiredGrantsDeleted', v_grants_deleted,
    'artifactsDeleted', v_artifacts_deleted,
    'jobsDeleted', v_jobs_deleted
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- RLS: owner-read only on jobs/artifacts. No INSERT/UPDATE/DELETE policy is provided. Other
-- tables are default-deny. These policies are defense in depth; clients still get no table grant.
-- ---------------------------------------------------------------------------------------------

alter table public.mcp_compile_jobs enable row level security;
alter table public.mcp_artifacts enable row level security;
alter table public.mcp_artifact_grants enable row level security;
alter table public.mcp_compile_policy enable row level security;
alter table public.mcp_compile_daily_usage enable row level security;

drop policy if exists mcp_compile_jobs_select_own on public.mcp_compile_jobs;
create policy mcp_compile_jobs_select_own
  on public.mcp_compile_jobs for select
  to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists mcp_artifacts_select_own on public.mcp_artifacts;
create policy mcp_artifacts_select_own
  on public.mcp_artifacts for select
  to authenticated
  using ((select auth.uid()) = owner_id);

-- ---------------------------------------------------------------------------------------------
-- Privileges. No client/worker table grants: all access is through the explicit RPCs above.
-- ---------------------------------------------------------------------------------------------

revoke all on table public.mcp_compile_jobs from public, anon, authenticated, service_role;
revoke all on table public.mcp_artifacts from public, anon, authenticated, service_role;
revoke all on table public.mcp_artifact_grants from public, anon, authenticated, service_role;
revoke all on table public.mcp_compile_policy from public, anon, authenticated, service_role;
revoke all on table public.mcp_compile_daily_usage from public, anon, authenticated, service_role;

revoke all on function public.mcp_is_safe_relative_path(text)
  from public, anon, authenticated, service_role;
revoke all on function public.mcp_compile_input_error(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.mcp_touch_updated_at()
  from public, anon, authenticated, service_role;
revoke all on function public.mcp_compile_jobs_protect_identity()
  from public, anon, authenticated, service_role;
revoke all on function public.mcp_artifacts_protect_snapshot()
  from public, anon, authenticated, service_role;
revoke all on function public.mcp_public_job_json(public.mcp_compile_jobs)
  from public, anon, authenticated, service_role;
revoke all on function public.mcp_assert_service_role()
  from public, anon, authenticated, service_role;

revoke all on function public.mcp_enqueue_compile(jsonb, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.mcp_get_job(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.mcp_cancel_job(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.mcp_create_artifact_grant(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.mcp_claim_job(text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.mcp_finish_job(uuid, uuid, boolean, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.mcp_redeem_artifact_grant(text)
  from public, anon, authenticated, service_role;
revoke all on function public.mcp_cleanup_expired(integer)
  from public, anon, authenticated, service_role;

grant execute on function public.mcp_enqueue_compile(jsonb, text, text) to authenticated;
grant execute on function public.mcp_get_job(uuid) to authenticated;
grant execute on function public.mcp_cancel_job(uuid) to authenticated;
grant execute on function public.mcp_create_artifact_grant(uuid, text, text) to authenticated;

grant execute on function public.mcp_claim_job(text, integer) to service_role;
grant execute on function public.mcp_finish_job(uuid, uuid, boolean, text, text) to service_role;
grant execute on function public.mcp_redeem_artifact_grant(text) to anon, authenticated;
grant execute on function public.mcp_cleanup_expired(integer) to service_role;

-- These are pure CHECK helpers / trigger functions, not RPC entry points. They are granted only
-- to app roles that can cause FK-driven document deletes to re-evaluate constraints/triggers.
-- Direct invocation of a trigger function fails outside a trigger context.
grant execute on function public.mcp_is_safe_relative_path(text) to authenticated, service_role;
grant execute on function public.mcp_compile_input_error(jsonb) to authenticated, service_role;
grant execute on function public.mcp_touch_updated_at() to authenticated, service_role;
grant execute on function public.mcp_compile_jobs_protect_identity() to authenticated, service_role;
grant execute on function public.mcp_artifacts_protect_snapshot() to authenticated, service_role;
