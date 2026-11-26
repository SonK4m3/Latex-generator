-- supabase/migrations/0008_mcp_realtime_source_updates.sql
-- Realtime revision signal for the web editor plus the guarded MCP source-update RPC.
--
-- Security invariants:
--   * public.document_revision_events is a projection only: document_id, owner_id and
--     updated_at. Source, PDF bytes, compiler log and error never enter this table, so a
--     Realtime subscriber cannot receive document content through the event stream.
--   * The event table is written only by the SECURITY DEFINER trigger below. authenticated gets
--     SELECT under owner-only RLS; INSERT/UPDATE/DELETE are neither granted nor policied.
--   * public.mcp_update_document_source is the only OAuth mutation path for an existing
--     document. It derives the owner from auth.uid(), requires an active OAuth grant containing
--     the `openid` scope, and never accepts an owner id from the caller.
--   * The update is a row-locked compare-and-set on documents.updated_at, so two MCP clients
--     cannot silently overwrite each other; the loser receives SQLSTATE PT409.
--   * A successful source update invalidates the previous compilation: pdf_base64, log and
--     error are cleared and the document must be compiled again in the web editor.
--
-- Assumptions / limitations:
--   * 0001 (public.documents) and 0007 (public.mcp_current_oauth_scopes) are already applied.
--     auth.uid()/auth.jwt(), the Supabase roles, and pgcrypto/gen_random_uuid() exist.
--   * The `supabase_realtime` publication is optional: plain Postgres may not have it, and a
--     publication already covering every table is left unchanged.
--   * Adding a table to `supabase_realtime` requires ownership of that publication. Apply this
--     migration with the role that owns the publication (Supabase migration tooling does).
--   * The source size gate is 100 KiB (102400 bytes). The MCP client keeps its own stricter
--     100000-byte request guard; the database stays slightly wider so a valid client request is
--     never rejected by a different unit convention.
--
-- This migration is intentionally idempotent on re-run.

-- ---------------------------------------------------------------------------------------------
-- Revision events: one tiny row per document, updated in place by the trigger below.
-- ---------------------------------------------------------------------------------------------

create table if not exists public.document_revision_events (
  document_id uuid primary key references public.documents(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null
);

comment on table public.document_revision_events is
  'Tiny realtime revision signal. Projection only: never store source, PDF, log, or error here.';

-- ---------------------------------------------------------------------------------------------
-- AFTER UPDATE fan-out. The trigger runs as the definer so clients never need INSERT/UPDATE on
-- the event table. It deliberately writes only the three projection columns.
-- ---------------------------------------------------------------------------------------------

create or replace function public.mcp_record_document_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.document_revision_events as revision (document_id, owner_id, updated_at)
  values (new.id, new.owner_id, new.updated_at)
  on conflict (document_id) do update
    set owner_id = excluded.owner_id,
        updated_at = excluded.updated_at;
  return null;
end;
$$;

comment on function public.mcp_record_document_revision() is
  'After UPDATE on documents, upsert the owner-visible revision signal only.';

drop trigger if exists documents_record_revision on public.documents;
create trigger documents_record_revision
  after update on public.documents
  for each row
  execute function public.mcp_record_document_revision();

-- ---------------------------------------------------------------------------------------------
-- Realtime publication. Postgres Changes only streams tables that belong to the publication.
-- pg_publication_tables already expands FOR ALL TABLES and schema publications, so this block
-- only adds the table when the publication exists and does not already cover it. It is a no-op
-- when the publication is absent (plain Postgres).
-- ---------------------------------------------------------------------------------------------

do $$
begin
  if exists (
       select 1
       from pg_catalog.pg_publication as p
       where p.pubname = 'supabase_realtime'
     )
     and not exists (
       select 1
       from pg_catalog.pg_publication_tables as pt
       where pt.pubname = 'supabase_realtime'
         and pt.schemaname = 'public'
         and pt.tablename = 'document_revision_events'
     ) then
    alter publication supabase_realtime add table public.document_revision_events;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- MCP source update. Owner-only, single-file LaTeX only, exact-revision compare-and-set.
-- NULL return means absent or foreign document; PT409 means stale expected revision; PT422
-- means invalid source or an unsupported (multi-file) document.
-- ---------------------------------------------------------------------------------------------

create or replace function public.mcp_update_document_source(
  p_document_id uuid,
  p_expected_updated_at timestamptz,
  p_latex text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_scopes text[];
  v_document public.documents%rowtype;
  v_max_latex_bytes constant integer := 100 * 1024;
begin
  if v_owner is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  -- Cookie sessions and unconsented/revoked OAuth clients return NULL scopes here.
  v_scopes := public.mcp_current_oauth_scopes();
  if v_scopes is null or not ('openid' = any(v_scopes)) then
    raise exception using errcode = '42501', message = 'insufficient_scope';
  end if;

  select * into v_document
  from public.documents as doc
  where doc.id = p_document_id
    and doc.owner_id = v_owner
  for update;

  -- Missing and foreign documents are deliberately indistinguishable.
  if not found then
    return null;
  end if;

  if p_latex is null
     or pg_catalog.char_length(pg_catalog.btrim(p_latex)) = 0
     or pg_catalog.octet_length(p_latex) > v_max_latex_bytes then
    raise exception using errcode = 'PT422', message = 'invalid_source';
  end if;

  -- Multi-file projects are edited in the web workspace, never through this single-file RPC.
  if coalesce(pg_catalog.jsonb_array_length(v_document.files), 0) > 0 then
    raise exception using errcode = 'PT422', message = 'unsupported_project_document';
  end if;

  if v_document.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'PT409', message = 'stale_revision';
  end if;

  update public.documents as doc
  set latex = p_latex,
      pdf_base64 = null,
      log = null,
      error = null,
      updated_at = pg_catalog.now()
  where doc.id = v_document.id
    and doc.owner_id = v_owner
  returning * into v_document;

  return pg_catalog.jsonb_build_object(
    'documentId', v_document.id,
    'updatedAt', v_document.updated_at
  );
end;
$$;

comment on function public.mcp_update_document_source(uuid, timestamptz, text) is
  'Compare-and-set LaTeX source for an owned single-file document. NULL = absent/foreign; PT409 = stale; PT422 = invalid/unsupported.';

-- ---------------------------------------------------------------------------------------------
-- Row Level Security: owner-read only for the authenticated role. There is intentionally no
-- INSERT/UPDATE/DELETE policy and no client write grant.
-- ---------------------------------------------------------------------------------------------

alter table public.document_revision_events enable row level security;

drop policy if exists document_revision_events_select_own on public.document_revision_events;
create policy document_revision_events_select_own
  on public.document_revision_events for select
  to authenticated
  using ((select auth.uid()) = owner_id);

-- ---------------------------------------------------------------------------------------------
-- Privileges. INSERT/UPDATE/DELETE never reach a client role; the SECURITY DEFINER trigger and
-- RPC own all writes. The RPC is exposed to authenticated only.
-- ---------------------------------------------------------------------------------------------

revoke all on table public.document_revision_events
  from public, anon, authenticated, service_role;
grant select on table public.document_revision_events to authenticated;

revoke all on function public.mcp_record_document_revision()
  from public, anon, authenticated, service_role;
grant execute on function public.mcp_record_document_revision() to authenticated, service_role;

revoke all on function public.mcp_update_document_source(uuid, timestamptz, text)
  from public, anon, authenticated, service_role;
grant execute on function public.mcp_update_document_source(uuid, timestamptz, text)
  to authenticated;
