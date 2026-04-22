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

create table if not exists public.traffic_events (
  id uuid primary key default gen_random_uuid(),
  path text not null default '/',
  created_at timestamptz not null default now()
);

alter table public.traffic_events enable row level security;

grant insert on table public.traffic_events to anon;

drop policy if exists "traffic_insert_anon" on public.traffic_events;
create policy "traffic_insert_anon"
  on public.traffic_events
  for insert
  to anon
  with check (true);

drop policy if exists "traffic_no_select_anon" on public.traffic_events;
create policy "traffic_no_select_anon"
  on public.traffic_events
  for select
  to anon
  using (false);

-- Dashboard (public stats only — no emails). Safe to expose to anon.
-- p_days: last N days, sliced into one point per hour (dense series; zeros where there were no signups).
drop function if exists public.waitlist_dashboard_stats();

create or replace function public.waitlist_dashboard_stats(p_days integer default 7)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  d int := least(greatest(coalesce(p_days, 7), 1), 90);
  win interval := (d::text || ' days')::interval;
  total_w bigint;
  total_traffic bigint;
  series jsonb;
  traffic_times jsonb;
  start_ts timestamptz;
  end_ts timestamptz;
begin
  select count(*)::bigint into total_w from public.waitlist_signups w where w.created_at >= now() - win;
  select count(*)::bigint into total_traffic from public.traffic_events t where t.created_at >= now() - win;

  end_ts := date_trunc('hour', clock_timestamp());
  start_ts := end_ts - win;

  select coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          't', sub.bucket_start,
          'count', sub.cnt
        )
        order by sub.bucket_start
      )
      from (
        select
          gs.bucket_start,
          coalesce(c.cnt, 0)::bigint as cnt
        from generate_series(start_ts, end_ts, interval '1 hour') as gs(bucket_start)
        left join (
          select
            date_trunc('hour', w.created_at) as bucket_start,
            count(*)::bigint as cnt
          from public.waitlist_signups w
          where w.created_at >= start_ts
            and w.created_at < end_ts + interval '1 hour'
          group by 1
        ) c on c.bucket_start = gs.bucket_start
      ) sub
    ),
    '[]'::jsonb
  ) into series;

  select coalesce(
    (
      select jsonb_agg(t.created_at order by t.created_at desc)
      from (
        select created_at
        from public.traffic_events
        where created_at >= now() - win
        order by created_at desc
        limit 18
      ) t
    ),
    '[]'::jsonb
  ) into traffic_times;

  return jsonb_build_object(
    'total', coalesce(total_w, 0),
    'all_time_total', coalesce((select count(*)::bigint from public.waitlist_signups), 0),
    'traffic_total', coalesce(total_traffic, 0),
    'traffic_times', coalesce(traffic_times, '[]'::jsonb),
    'granularity', 'hour',
    'days', d,
    'series', coalesce(series, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.waitlist_dashboard_stats(integer) from public;
grant execute on function public.waitlist_dashboard_stats(integer) to anon, authenticated;
