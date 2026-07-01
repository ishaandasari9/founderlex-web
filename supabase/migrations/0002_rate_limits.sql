create table if not exists public.rate_limits (
  identifier text not null,
  window_start timestamptz not null,
  count integer not null default 1,
  primary key (identifier, window_start)
);

alter table public.rate_limits enable row level security;

grant all privileges on table public.rate_limits to service_role;

-- Atomic increment: insert the window row on first hit, or bump the count on
-- every hit within the same window. The primary key + ON CONFLICT DO UPDATE
-- makes this race-safe under concurrent requests from the same identifier.
create or replace function public.increment_rate_limit(p_identifier text, p_window_start timestamptz)
returns integer
language sql
as $$
  insert into public.rate_limits (identifier, window_start, count)
  values (p_identifier, p_window_start, 1)
  on conflict (identifier, window_start)
  do update set count = rate_limits.count + 1
  returning count;
$$;

grant execute on function public.increment_rate_limit(text, timestamptz) to service_role;

-- No policies are defined for anon/authenticated roles. With RLS enabled and
-- zero policies, Postgres denies all access to those roles by default. The
-- service_role key (server-only) bypasses RLS entirely, so only server code
-- using SUPABASE_SERVICE_ROLE_KEY can read/write this table or call the function.
