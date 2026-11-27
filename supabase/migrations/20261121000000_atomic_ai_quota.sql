-- Attempt quota, UTC calendar day (not rolling 24h). No leases/refunds:
-- a timed-out/failed upstream attempt still consumes one slot to prevent abuse.
begin;
create table if not exists public.ai_quota_config (
  singleton boolean primary key default true check(singleton),
  daily_limit integer not null check(daily_limit between 1 and 1000)
);
insert into public.ai_quota_config(singleton,daily_limit) values(true,30) on conflict do nothing;
create table if not exists public.ai_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  utc_day date not null,
  attempts integer not null check(attempts > 0),
  primary key(user_id,utc_day)
);
-- Carry historical nutrition attempts into their UTC day without reducing an
-- already-spent counter when this upgrade is re-run.
insert into public.ai_daily_usage(user_id,utc_day,attempts)
  select user_id,(created_at at time zone 'UTC')::date,count(*)::integer
    from public.ai_requests where kind = 'nutrition' group by user_id,(created_at at time zone 'UTC')::date
  on conflict(user_id,utc_day) do update set attempts = greatest(ai_daily_usage.attempts,excluded.attempts);
alter table public.ai_quota_config enable row level security;
alter table public.ai_daily_usage enable row level security;
-- No client DML/config/RPC limit parameter. Service role is server-only.
revoke all on public.ai_quota_config, public.ai_daily_usage from public, anon, authenticated;
grant select on public.ai_daily_usage to authenticated;
drop policy if exists "ai usage owner read" on public.ai_daily_usage;
create policy "ai usage owner read" on public.ai_daily_usage for select to authenticated using(user_id = auth.uid());
grant select, insert, update, delete on public.ai_quota_config, public.ai_daily_usage to service_role;

create or replace function public.reserve_nutrition_quota()
returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
declare caller uuid := auth.uid(); today_utc date := (clock_timestamp() at time zone 'UTC')::date;
  max_attempts integer; reserved integer;
begin
  if caller is null then raise exception 'authentication required'; end if;
  select daily_limit into strict max_attempts from public.ai_quota_config where singleton;
  if max_attempts < 1 or max_attempts > 1000 then raise exception 'invalid quota configuration'; end if;
  insert into public.ai_daily_usage(user_id,utc_day,attempts) values(caller,today_utc,1)
    on conflict(user_id,utc_day) do update set attempts = ai_daily_usage.attempts + 1
      where ai_daily_usage.attempts < max_attempts
    returning attempts into reserved;
  return reserved is not null;
end $$;
revoke all on function public.reserve_nutrition_quota() from public, anon;
grant execute on function public.reserve_nutrition_quota() to authenticated;
-- Historical ai_requests audit rows are retained, but clients must not mutate
-- them or use them as a quota bypass. New enforcement uses the atomic counter.
revoke insert, update, delete on public.ai_requests from anon, authenticated;
commit;
