-- Keep Supabase OAuth/MCP user tokens on the explicit compile-job RPC surface.
-- Cookie sessions have no client_id claim and retain the existing web CRUD policies.
-- Worker publication continues through the service_role-only RPCs in 0005.

-- Deployment-owned allowlist for the custom access token hook. Values are deliberately not
-- seeded: each Supabase project must set its canonical MCP resource URL and registered client IDs.
create table if not exists public.mcp_oauth_audience_policy (
  singleton boolean primary key default true check (singleton),
  resource_url text not null check (
    resource_url ~ '^https://[^[:space:]]+/api/mcp$'
    or resource_url ~ '^http://(localhost|127\.0\.0\.1|\[::1\])(:[0-9]+)?/api/mcp$'
  ),
  client_ids text[] not null check (
    cardinality(client_ids) > 0
    and cardinality(array_remove(client_ids, '')) = cardinality(client_ids)
    and array_position(client_ids, null) is null
  )
);

alter table public.mcp_oauth_audience_policy enable row level security;
drop policy if exists mcp_oauth_audience_policy_auth_admin_read
  on public.mcp_oauth_audience_policy;
create policy mcp_oauth_audience_policy_auth_admin_read
  on public.mcp_oauth_audience_policy for select to supabase_auth_admin
  using (true);

revoke all on table public.mcp_oauth_audience_policy
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
grant select on table public.mcp_oauth_audience_policy to supabase_auth_admin;

-- Supabase Auth invokes this function only after it is explicitly selected as the Custom Access
-- Token Hook. Unknown clients and non-OAuth sessions retain their original claims and therefore
-- cannot pass the MCP resource audience check.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  claims jsonb := event -> 'claims';
  auth_method text := replace(event ->> 'authentication_method', '"', '');
  token_client_id text := event -> 'claims' ->> 'client_id';
  configured_resource text;
begin
  if auth_method not in ('oauth', 'oauth_provider/authorization_code')
     or token_client_id is null then
    return event;
  end if;

  select policy.resource_url
    into configured_resource
    from public.mcp_oauth_audience_policy as policy
   where policy.singleton
     and token_client_id = any(policy.client_ids);

  if configured_resource is null then
    return event;
  end if;

  claims := jsonb_set(claims, '{aud}', to_jsonb(configured_resource), true);
  return jsonb_set(event, '{claims}', claims, true);
end;
$$;

revoke all on function public.custom_access_token_hook(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.custom_access_token_hook(jsonb) from supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

-- Existing permissive owner policies continue to serve cookie sessions. These restrictive
-- policies additionally require the JWT to be a non-OAuth session for any direct table mutation.
drop policy if exists documents_no_oauth_insert on public.documents;
create policy documents_no_oauth_insert on public.documents
  as restrictive for insert to authenticated
  with check ((select auth.jwt() ->> 'client_id') is null);
drop policy if exists documents_no_oauth_update on public.documents;
create policy documents_no_oauth_update on public.documents
  as restrictive for update to authenticated
  using ((select auth.jwt() ->> 'client_id') is null)
  with check ((select auth.jwt() ->> 'client_id') is null);
drop policy if exists documents_no_oauth_delete on public.documents;
create policy documents_no_oauth_delete on public.documents
  as restrictive for delete to authenticated
  using ((select auth.jwt() ->> 'client_id') is null);

drop policy if exists clarification_sessions_no_oauth_insert on public.clarification_sessions;
create policy clarification_sessions_no_oauth_insert on public.clarification_sessions
  as restrictive for insert to authenticated
  with check ((select auth.jwt() ->> 'client_id') is null);
drop policy if exists clarification_sessions_no_oauth_update on public.clarification_sessions;
create policy clarification_sessions_no_oauth_update on public.clarification_sessions
  as restrictive for update to authenticated
  using ((select auth.jwt() ->> 'client_id') is null)
  with check ((select auth.jwt() ->> 'client_id') is null);

drop policy if exists profiles_no_oauth_insert on public.profiles;
create policy profiles_no_oauth_insert on public.profiles
  as restrictive for insert to authenticated
  with check ((select auth.jwt() ->> 'client_id') is null);
drop policy if exists profiles_no_oauth_update on public.profiles;
create policy profiles_no_oauth_update on public.profiles
  as restrictive for update to authenticated
  using ((select auth.jwt() ->> 'client_id') is null)
  with check ((select auth.jwt() ->> 'client_id') is null);
drop policy if exists profiles_no_oauth_delete on public.profiles;
create policy profiles_no_oauth_delete on public.profiles
  as restrictive for delete to authenticated
  using ((select auth.jwt() ->> 'client_id') is null);

drop policy if exists workspaces_no_oauth_insert on public.workspaces;
create policy workspaces_no_oauth_insert on public.workspaces
  as restrictive for insert to authenticated
  with check ((select auth.jwt() ->> 'client_id') is null);
drop policy if exists workspaces_no_oauth_update on public.workspaces;
create policy workspaces_no_oauth_update on public.workspaces
  as restrictive for update to authenticated
  using ((select auth.jwt() ->> 'client_id') is null)
  with check ((select auth.jwt() ->> 'client_id') is null);
drop policy if exists workspaces_no_oauth_delete on public.workspaces;
create policy workspaces_no_oauth_delete on public.workspaces
  as restrictive for delete to authenticated
  using ((select auth.jwt() ->> 'client_id') is null);

-- This SECURITY DEFINER RPC mutates profile/workspace/quota rows, so guard it as well as the
-- tables. The web cookie flow remains unchanged; MCP compilation uses its separate quota RPC.
create or replace function public.consume_daily_generation_quota()
returns table(allowed boolean, used integer, limit_value integer)
language plpgsql security definer set search_path = public
as $$
declare
  effective_limit integer;
  next_used integer;
begin
  if (select auth.jwt() ->> 'client_id') is not null then
    raise insufficient_privilege using message = 'OAuth clients cannot consume web generation quota';
  end if;

  insert into public.profiles(user_id) values (auth.uid()) on conflict (user_id) do nothing;
  insert into public.workspaces(owner_id) values (auth.uid()) on conflict (owner_id) do nothing;
  select daily_generation_limit into effective_limit
    from public.profiles where user_id = auth.uid();
  insert into public.generation_daily_usage(user_id, usage_date, completed_attempts)
  values (auth.uid(), current_date, 1)
  on conflict (user_id, usage_date) do update
    set completed_attempts = public.generation_daily_usage.completed_attempts + 1
    where public.generation_daily_usage.completed_attempts < effective_limit
  returning completed_attempts into next_used;

  if next_used is null then
    select completed_attempts into next_used from public.generation_daily_usage
     where user_id = auth.uid() and usage_date = current_date;
    return query select false, coalesce(next_used, effective_limit), effective_limit;
  else
    return query select true, next_used, effective_limit;
  end if;
end;
$$;
