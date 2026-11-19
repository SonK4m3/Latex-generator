-- supabase/migrations/0011_document_preview_revisions.sql
-- Packet A — persistence only: bind a document preview (PDF) to the exact source revision it was
-- compiled from, so a stale preview can stay visible without ever being mistaken for the current
-- source.
--
-- Design:
--   * documents.source_revision is a server-owned, immutable-for-a-given-source UUID.
--     A BEFORE trigger regenerates it only when latex / files / root_file change, and in every
--     other case copies OLD.source_revision. A client can therefore send any value it likes in an
--     INSERT/UPDATE and cannot forge or freeze a revision.
--   * documents.pdf_source_revision is the source revision the stored PDF was compiled from.
--     It is nullable on purpose: PDFs that existed before this migration have an unknown revision
--     and keep NULL. NULL is "unknown", never "current".
--   * The same trigger binds a PDF to a revision:
--       - INSERT with a PDF            -> bind to the freshly generated source revision.
--       - UPDATE where PDF bytes change -> bind to NEW.source_revision (newly stored PDF).
--       - UPDATE where only pdf_source_revision is assigned (the explicit app compile-publish
--         path, needed when a recompile produces byte-identical output) -> accepted only when it
--         equals NEW.source_revision and a PDF exists. Any other value raises PT422, so a stale
--         compile cannot claim to be current.
--       - UPDATE where neither changed -> keep OLD.pdf_source_revision (legacy NULL stays NULL).
--   * documents.pdf_available / documents.pdf_revision_status are stored generated columns, so a
--     list/metadata query can read preview state without pulling pdf_base64:
--       pdf_available       = a PDF exists (same meaning as the existing has_pdf column).
--       pdf_revision_status = 'missing' | 'unknown' (legacy PDF, revision not recorded)
--                             | 'current' | 'stale'.
--     They are evaluated after the BEFORE trigger, so they observe the trigger-assigned UUIDs.
--   * 0008/0009 MCP RPCs used to null pdf_base64 on every source update. They are replaced below
--     so MCP source-only edits keep the old PDF, its old pdf_source_revision (now "stale"), the
--     same owner scope, the same OpenID-consent check and the same updated_at CAS. log/error are
--     still cleared because they describe the previous compile attempt, not the new source.
--
-- Not in this packet: no compile queue, no application code, no new RPC, no database execution.
-- The app must set pdf_source_revision = source_revision when it publishes a compile whose PDF
-- bytes are unchanged; when bytes differ the trigger binds automatically.
--
-- Assumptions / limitations:
--   * 0001, 0008, 0009 and the existing documents ACL/RLS are already applied.
--   * Adding generated columns rewrites public.documents once; it holds PDF payloads, so run it
--     in a maintenance window / with enough disk for a second copy. This migration never updates
--     rows by hand, so documents.updated_at and the MCP compare-and-set are untouched.
--   * Legacy PDFs are deliberately NOT backfilled with a guessed revision: an unknown preview is
--     reported as 'unknown' and becomes 'current' or 'stale' only after the next compile publish.
--   * This migration is intentionally idempotent on re-run.

-- ---------------------------------------------------------------------------------------------
-- Columns. One ALTER so the table is rewritten only once.
-- source_revision is NOT NULL with a volatile default: existing rows receive a distinct UUID
-- each, without an UPDATE (which would bump updated_at and break MCP CAS).
-- ---------------------------------------------------------------------------------------------

alter table public.documents
  add column if not exists source_revision uuid
    not null default pg_catalog.gen_random_uuid(),
  add column if not exists pdf_source_revision uuid,
  add column if not exists pdf_available boolean
    generated always as (pdf_base64 is not null) stored,
  add column if not exists pdf_revision_status text
    generated always as (
      case
        when pdf_base64 is null then 'missing'
        when pdf_source_revision is null then 'unknown'
        when pdf_source_revision = source_revision then 'current'
        else 'stale'
      end
    ) stored;

comment on column public.documents.source_revision is
  'Server-owned source revision UUID. Regenerated only when latex/files/root_file change; clients cannot set it.';
comment on column public.documents.pdf_source_revision is
  'Source revision the stored PDF was compiled from. NULL = legacy/unknown preview; never means current.';
comment on column public.documents.pdf_available is
  'Generated: a PDF payload exists. Freshness is described by pdf_revision_status, not by this flag.';
comment on column public.documents.pdf_revision_status is
  'Generated preview state: missing | unknown (legacy PDF) | current | stale.';

-- ---------------------------------------------------------------------------------------------
-- Source revision + PDF binding. BEFORE INSERT OR UPDATE so generated columns and every writer
-- (web routes, PostgREST, SECURITY DEFINER RPCs) observe the same row.
--
-- Ordering inside UPDATE matters:
--   1. A null PDF always clears the binding (compile failure / explicit delete).
--   2. An explicitly assigned pdf_source_revision is the app compile-publish signal and is
--      validated against NEW.source_revision before anything else. This is the only way to bind
--      byte-identical recompiles; it also rejects a stale compile racing a newer source save.
--   3. Changed PDF bytes are always bound to the current source revision.
--   4. Otherwise the old binding is preserved (legacy NULL included).
-- ---------------------------------------------------------------------------------------------

create or replace function public.documents_track_preview_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Ignore any client-supplied revision on insert as well.
    new.source_revision := pg_catalog.gen_random_uuid();
    if new.pdf_base64 is not null then
      new.pdf_source_revision := new.source_revision;
    else
      new.pdf_source_revision := null;
    end if;
    return new;
  end if;

  -- Immutable per source: only the three source columns can advance it.
  if new.latex is distinct from old.latex
     or new.files is distinct from old.files
     or new.root_file is distinct from old.root_file then
    new.source_revision := pg_catalog.gen_random_uuid();
  else
    new.source_revision := old.source_revision;
  end if;

  if new.pdf_base64 is null then
    new.pdf_source_revision := null;
  elsif new.pdf_source_revision is distinct from old.pdf_source_revision then
    -- Explicit app binding. It must name the revision this row now has (which the app knows
    -- because compile publishing happens after the source save), otherwise the preview is stale.
    if new.pdf_source_revision is null
       or new.pdf_source_revision is distinct from new.source_revision then
      raise exception using
        errcode = 'PT422',
        message = 'invalid_pdf_source_revision';
    end if;
  elsif new.pdf_base64 is distinct from old.pdf_base64 then
    new.pdf_source_revision := new.source_revision;
  else
    new.pdf_source_revision := old.pdf_source_revision;
  end if;

  return new;
end;
$$;

comment on function public.documents_track_preview_revision() is
  'Owns documents.source_revision and binds pdf_source_revision to it; rejects forged/stale bindings with PT422.';

drop trigger if exists documents_track_preview_revision on public.documents;
create trigger documents_track_preview_revision
  before insert or update on public.documents
  for each row
  execute function public.documents_track_preview_revision();

revoke all on function public.documents_track_preview_revision()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- MCP source update (supersedes 0008). Behaviour is identical except that pdf_base64 is no longer
-- cleared: the old preview survives a source-only edit, still bound to its old revision and shown
-- as 'stale'. Owner scope, OpenID consent and updated_at CAS are unchanged.
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

  -- pdf_base64 and pdf_source_revision are intentionally untouched: the trigger advances
  -- source_revision and leaves the old preview bound to its old revision (status 'stale').
  update public.documents as doc
  set latex = p_latex,
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
  'Compare-and-set LaTeX source for an owned single-file document; keeps the old PDF bound to its old revision. NULL = absent/foreign; PT409 = stale; PT422 = invalid/unsupported.';

revoke all on function public.mcp_update_document_source(uuid, timestamptz, text)
  from public, anon, authenticated, service_role;
grant execute on function public.mcp_update_document_source(uuid, timestamptz, text)
  to authenticated;

-- ---------------------------------------------------------------------------------------------
-- MCP project text update (supersedes 0009). Same patch rules, ACL and CAS; only the PDF clearing
-- is removed so the previous preview survives and becomes 'stale'.
-- ---------------------------------------------------------------------------------------------

create or replace function public.mcp_update_document_project_text(
  p_document_id uuid,
  p_expected_updated_at timestamptz,
  p_files jsonb
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
  v_patch jsonb;
  v_file jsonb;
  v_key text;
  v_path text;
  v_root text;
  v_seen text[] := '{}';
  v_total_bytes bigint := 0;
  v_updated_files jsonb;
begin
  if v_owner is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  v_scopes := public.mcp_current_oauth_scopes();
  if v_scopes is null or not ('openid' = any(v_scopes)) then
    raise exception using errcode = '42501', message = 'insufficient_scope';
  end if;

  select * into v_document
  from public.documents as doc
  where doc.id = p_document_id and doc.owner_id = v_owner
  for update;
  if not found then return null; end if;

  if v_document.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'PT409', message = 'stale_revision';
  end if;
  if pg_catalog.jsonb_typeof(v_document.files) is distinct from 'array'
     or pg_catalog.jsonb_typeof(p_files) is distinct from 'array' then
    raise exception using errcode = 'PT422', message = 'invalid_project_patch';
  end if;
  if pg_catalog.jsonb_array_length(v_document.files) = 0
     or pg_catalog.jsonb_array_length(p_files) < 1
     or pg_catalog.jsonb_array_length(p_files) > 100 then
    raise exception using errcode = 'PT422', message = 'invalid_project_patch';
  end if;

  for v_patch in select value from pg_catalog.jsonb_array_elements(p_files) loop
    if pg_catalog.jsonb_typeof(v_patch) is distinct from 'object' then
      raise exception using errcode = 'PT422', message = 'invalid_project_patch';
    end if;
    for v_key in select jsonb_object_keys(v_patch) loop
      if v_key not in ('path', 'content') then
        raise exception using errcode = 'PT422', message = 'invalid_project_patch';
      end if;
    end loop;
    if not (v_patch ? 'path') or not (v_patch ? 'content')
       or pg_catalog.jsonb_typeof(v_patch->'path') is distinct from 'string'
       or pg_catalog.jsonb_typeof(v_patch->'content') is distinct from 'string' then
      raise exception using errcode = 'PT422', message = 'invalid_project_patch';
    end if;

    v_path := v_patch->>'path';
    if not public.mcp_is_safe_relative_path(v_path) or v_path = any(v_seen) then
      raise exception using errcode = 'PT422', message = 'invalid_project_patch';
    end if;
    v_seen := v_seen || v_path;
    v_total_bytes := v_total_bytes + pg_catalog.octet_length(v_patch->>'content');
    if v_total_bytes > 100000 then
      raise exception using errcode = 'PT422', message = 'project_patch_too_large';
    end if;

    select item.value into v_file
    from pg_catalog.jsonb_array_elements(v_document.files) as item(value)
    where item.value->>'path' = v_path;
    if not found
       or pg_catalog.jsonb_typeof(v_file->'content') is distinct from 'string'
       or v_file ? 'contentBase64' then
      raise exception using errcode = 'PT422', message = 'unreadable_or_binary_project_file';
    end if;
    if (select count(*) from pg_catalog.jsonb_array_elements(v_document.files) as item(value)
        where item.value->>'path' = v_path) <> 1 then
      raise exception using errcode = 'PT422', message = 'ambiguous_project_path';
    end if;
  end loop;

  v_root := coalesce(v_document.root_file, v_document.files->0->>'path');
  select pg_catalog.jsonb_agg(
    case
      when patch.value->>'path' is not null
        then pg_catalog.jsonb_set(file.value, '{content}', patch.value->'content', false)
      else file.value
    end order by file.ordinality
  ) into v_updated_files
  from pg_catalog.jsonb_array_elements(v_document.files) with ordinality as file(value, ordinality)
  left join lateral (
    select candidate.value
    from pg_catalog.jsonb_array_elements(p_files) as candidate(value)
    where candidate.value->>'path' = file.value->>'path'
    limit 1
  ) as patch on true;

  update public.documents as doc
  set files = v_updated_files,
      latex = coalesce((
        select patch.value->>'content'
        from pg_catalog.jsonb_array_elements(p_files) as patch(value)
        where patch.value->>'path' = v_root
      ), v_document.latex),
      log = null,
      error = null,
      updated_at = pg_catalog.now()
  where doc.id = v_document.id and doc.owner_id = v_owner
  returning * into v_document;

  return pg_catalog.jsonb_build_object(
    'documentId', v_document.id,
    'updatedAt', v_document.updated_at
  );
end;
$$;

comment on function public.mcp_update_document_project_text(uuid, timestamptz, jsonb) is
  'Atomically patch readable project text files; keeps the old PDF bound to its old revision. Preserves binary/untouched entries; NULL = absent/foreign; PT409 = stale; PT422 = invalid/unsupported.';

revoke all on function public.mcp_update_document_project_text(uuid, timestamptz, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.mcp_update_document_project_text(uuid, timestamptz, jsonb)
  to authenticated;
