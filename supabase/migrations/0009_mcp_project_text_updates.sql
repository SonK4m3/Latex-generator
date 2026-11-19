-- Atomic, owner-scoped patch updates for existing text files in a saved project.
-- The patch never replaces the files array, so hidden binary assets and untouched metadata survive.

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
      pdf_base64 = null,
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
  'Atomically patch existing readable project text files. Preserves binary and untouched entries; NULL = absent/foreign; PT409 = stale; PT422 = invalid/unsupported.';

revoke all on function public.mcp_update_document_project_text(uuid, timestamptz, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.mcp_update_document_project_text(uuid, timestamptz, jsonb)
  to authenticated;
