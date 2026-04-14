-- Run in Supabase → SQL Editor (once per project).
-- Table name matches main.js PostgREST path: /rest/v1/waitlist_signups

create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now(),
  constraint waitlist_signups_email_key unique (email)
);

alter table public.waitlist_signups enable row level security;

grant insert on table public.waitlist_signups to anon;

-- Public landing page: anyone may add an email; no public reads.
create policy "waitlist_insert_anon"
  on public.waitlist_signups
  for insert
  to anon
  with check (true);

create policy "waitlist_no_select_anon"
  on public.waitlist_signups
  for select
  to anon
  using (false);
