-- Auth/DB platform foundation: personal workspace, profile and an atomic daily quota.
-- Apply only through Supabase migration tooling after a staging rehearsal.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  daily_generation_limit integer not null default 10 check (daily_generation_limit > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Personal workspace',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists workspaces_one_personal_per_owner on public.workspaces(owner_id);

create table if not exists public.generation_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  completed_attempts integer not null default 0 check (completed_attempts >= 0),
  primary key (user_id, usage_date)
);

alter table public.documents add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
create index if not exists documents_workspace_updated_idx on public.documents(workspace_id, updated_at desc);

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.generation_daily_usage enable row level security;

create policy "profiles own" on public.profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workspaces own" on public.workspaces for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "usage own" on public.generation_daily_usage for select using (auth.uid() = user_id);

-- Atomic admission check. SECURITY DEFINER is safe because it only operates on auth.uid().
create or replace function public.consume_daily_generation_quota()
returns table(allowed boolean, used integer, limit_value integer)
language plpgsql security definer set search_path = public
as $$
declare effective_limit integer; next_used integer;
begin
  insert into public.profiles(user_id) values (auth.uid()) on conflict (user_id) do nothing;
  insert into public.workspaces(owner_id) values (auth.uid()) on conflict (owner_id) do nothing;
  select daily_generation_limit into effective_limit from public.profiles where user_id = auth.uid();
  insert into public.generation_daily_usage(user_id, usage_date, completed_attempts)
  values (auth.uid(), current_date, 1)
  on conflict (user_id, usage_date) do update
  set completed_attempts = public.generation_daily_usage.completed_attempts + 1
  where public.generation_daily_usage.completed_attempts < effective_limit
  returning completed_attempts into next_used;
  if next_used is null then
    select completed_attempts into next_used from public.generation_daily_usage where user_id = auth.uid() and usage_date = current_date;
    return query select false, coalesce(next_used, effective_limit), effective_limit;
  else
    return query select true, next_used, effective_limit;
  end if;
end;
$$;
grant execute on function public.consume_daily_generation_quota() to authenticated;
