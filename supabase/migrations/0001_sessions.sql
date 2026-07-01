create table if not exists public.sessions (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  messages jsonb not null default '[]'::jsonb,
  profile jsonb
);

alter table public.sessions enable row level security;

grant all privileges on table public.sessions to service_role;

-- No policies are defined for anon/authenticated roles.
-- With RLS enabled and zero policies, Postgres denies all access to those
-- roles by default. The service_role key (server-only) bypasses RLS entirely,
-- so only server code using SUPABASE_SERVICE_ROLE_KEY can read/write this table.
