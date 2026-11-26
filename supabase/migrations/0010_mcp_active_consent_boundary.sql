-- One explicit Supabase OAuth consent grants the current MCP tool bundle.
-- Custom documents:* OAuth scopes are not supported by Supabase OAuth; enforce live consent
-- using the existing owner/client/audience-bound consent lookup instead.

create or replace function public.mcp_has_active_oauth_consent()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce('openid' = any(public.mcp_current_oauth_scopes()), false);
$$;

revoke all on function public.mcp_has_active_oauth_consent()
  from public, anon, authenticated, service_role;
grant execute on function public.mcp_has_active_oauth_consent()
  to authenticated, service_role;

create or replace function public.mcp_guard_active_oauth_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The isolated worker uses its service-role RPCs and does not represent an OAuth user.
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if not coalesce(public.mcp_has_active_oauth_consent(), false) then
    raise exception using errcode = '42501', message = 'active_oauth_consent_required';
  end if;
  return new;
end;
$$;

revoke all on function public.mcp_guard_active_oauth_consent()
  from public, anon, authenticated, service_role;

drop trigger if exists mcp_compile_jobs_require_consent_insert on public.mcp_compile_jobs;
create trigger mcp_compile_jobs_require_consent_insert
  before insert on public.mcp_compile_jobs
  for each row execute function public.mcp_guard_active_oauth_consent();

drop trigger if exists mcp_compile_jobs_require_consent_status on public.mcp_compile_jobs;
create trigger mcp_compile_jobs_require_consent_status
  before update of status on public.mcp_compile_jobs
  for each row when (old.status is distinct from new.status)
  execute function public.mcp_guard_active_oauth_consent();

drop trigger if exists mcp_artifact_grants_require_consent on public.mcp_artifact_grants;
create trigger mcp_artifact_grants_require_consent
  before insert on public.mcp_artifact_grants
  for each row execute function public.mcp_guard_active_oauth_consent();

-- Owner-readable metadata is still hidden from a revoked OAuth bearer. Cookie sessions keep
-- their existing behavior because they have no OAuth client_id claim.
drop policy if exists documents_oauth_select_active_consent on public.documents;
create policy documents_oauth_select_active_consent on public.documents
  as restrictive for select to authenticated
  using ((select auth.jwt() ->> 'client_id') is null
    or (select public.mcp_has_active_oauth_consent()));

drop policy if exists revision_events_oauth_select_active_consent on public.document_revision_events;
create policy revision_events_oauth_select_active_consent on public.document_revision_events
  as restrictive for select to authenticated
  using ((select auth.jwt() ->> 'client_id') is null
    or (select public.mcp_has_active_oauth_consent()));

drop policy if exists mcp_compile_jobs_oauth_select_active_consent on public.mcp_compile_jobs;
create policy mcp_compile_jobs_oauth_select_active_consent on public.mcp_compile_jobs
  as restrictive for select to authenticated
  using ((select auth.jwt() ->> 'client_id') is null
    or (select public.mcp_has_active_oauth_consent()));

drop policy if exists mcp_artifacts_oauth_select_active_consent on public.mcp_artifacts;
create policy mcp_artifacts_oauth_select_active_consent on public.mcp_artifacts
  as restrictive for select to authenticated
  using ((select auth.jwt() ->> 'client_id') is null
    or (select public.mcp_has_active_oauth_consent()));

-- SECURITY DEFINER job RPCs use this projection for every returned job. A revoked bearer gets
-- no job data even if it calls the Postgres RPC directly instead of the MCP route.
create or replace function public.mcp_public_job_json(p_job public.mcp_compile_jobs)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select case when public.mcp_has_active_oauth_consent() then jsonb_build_object(
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
  ) else null end;
$$;

comment on function public.mcp_has_active_oauth_consent() is
  'True only for a caller with a live openid consent bound to its OAuth client and MCP audience.';
