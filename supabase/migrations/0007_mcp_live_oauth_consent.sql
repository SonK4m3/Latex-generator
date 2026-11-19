-- GoTrue rejects OAuth access tokens at /user/oauth/grants. This read-only RPC
-- exposes only the current caller's consent scopes for their bound MCP client.
create or replace function public.mcp_current_oauth_scopes()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.regexp_split_to_array(c.scopes, '[[:space:]]+')
  from auth.oauth_consents as c
  join auth.oauth_clients as client on client.id = c.client_id
  join public.mcp_oauth_audience_policy as policy
    on policy.singleton
    and policy.resource_url = (auth.jwt() ->> 'aud')
    and (auth.jwt() ->> 'client_id') = any(policy.client_ids)
  where c.user_id = auth.uid()
    and c.client_id::text = (auth.jwt() ->> 'client_id')
    and c.revoked_at is null
    and client.deleted_at is null
  order by c.granted_at desc
  limit 1;
$$;

revoke all on function public.mcp_current_oauth_scopes() from public, anon, authenticated, service_role;
grant execute on function public.mcp_current_oauth_scopes() to authenticated;
