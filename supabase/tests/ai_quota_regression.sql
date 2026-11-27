\set ON_ERROR_STOP on
-- This is an isolated synthetic DB. Privileged setup is separate from attacks.
reset role;
create function pg_temp.check_true(test_name text, result boolean) returns text language plpgsql as $$
begin if result is not true then raise exception 'FAIL: %', test_name; end if; return 'PASS: ' || test_name; end $$;
create function pg_temp.denied(test_name text, statement text) returns text language plpgsql as $$
declare blocked boolean := false;
begin
  begin execute statement; exception when others then blocked := true; end;
  if not blocked then raise exception 'FAIL (unexpectedly allowed): %', test_name; end if;
  return 'PASS: ' || test_name;
end $$;
insert into auth.users(id,email) values
 ('66666666-6666-6666-6666-666666666666','quota-a@test.invalid'),
 ('77777777-7777-7777-7777-777777777777','quota-b@test.invalid');
update public.ai_quota_config set daily_limit=3;
set role authenticated;
select set_config('request.jwt.sub','66666666-6666-6666-6666-666666666666',false);
select pg_temp.check_true('quota tests run as authenticated role',current_user='authenticated');
select pg_temp.check_true('quota RPC first slot',public.reserve_nutrition_quota());
select pg_temp.check_true('quota RPC second slot',public.reserve_nutrition_quota());
select pg_temp.check_true('quota RPC third slot',public.reserve_nutrition_quota());
select pg_temp.check_true('quota RPC refuses extra slot',not public.reserve_nutrition_quota());
select pg_temp.check_true('quota UTC row count is exactly limit',(select attempts from public.ai_daily_usage where utc_day=(clock_timestamp() at time zone 'UTC')::date)=3);
select pg_temp.check_true('authenticated cannot mutate counters via grants',not has_table_privilege(current_user,'public.ai_daily_usage','INSERT') and not has_table_privilege(current_user,'public.ai_daily_usage','UPDATE') and not has_table_privilege(current_user,'public.ai_daily_usage','DELETE'));
select pg_temp.check_true('authenticated cannot change/read quota config',not has_table_privilege(current_user,'public.ai_quota_config','UPDATE') and not has_table_privilege(current_user,'public.ai_quota_config','SELECT'));
select pg_temp.denied('caller cannot spoof RPC owner or limit','select public.reserve_nutrition_quota(''77777777-7777-7777-7777-777777777777'',999)');
select pg_temp.denied('counter direct insert denied','insert into public.ai_daily_usage values(auth.uid(),current_date,1)');
select pg_temp.denied('counter direct update denied','update public.ai_daily_usage set attempts=1');
select pg_temp.denied('quota config mutation denied','update public.ai_quota_config set daily_limit=1000');
select pg_temp.check_true('authenticated role has no service-role membership',not pg_has_role('authenticated','service_role','MEMBER'));
select pg_temp.denied('historical request log cannot bypass quota','insert into public.ai_requests(user_id,kind) values(auth.uid(),''nutrition'')');
select set_config('request.jwt.sub','77777777-7777-7777-7777-777777777777',false);
select pg_temp.check_true('separate authenticated UID has independent quota',public.reserve_nutrition_quota());
select pg_temp.check_true('caller can only see own usage',(select count(*) from public.ai_daily_usage)=1);
-- DB UTC day is independent of connection timezone and of yesterday's spent quota.
reset role;
insert into public.ai_daily_usage(user_id,utc_day,attempts) values('77777777-7777-7777-7777-777777777777',(clock_timestamp() at time zone 'UTC')::date-1,999);
set role authenticated;
set time zone 'Pacific/Kiritimati';
select pg_temp.check_true('UTC-day quota ignores yesterday and session timezone',public.reserve_nutrition_quota());
select pg_temp.check_true('UTC-day row charged rather than caller local date',(select attempts from public.ai_daily_usage where utc_day=(clock_timestamp() at time zone 'UTC')::date)=2);
reset role;
-- Missing configuration is a DB failure, not an unlimited allowance.
delete from public.ai_quota_config;
set role authenticated;
select pg_temp.denied('missing DB quota configuration fails closed','select public.reserve_nutrition_quota()');
select pg_temp.check_true('failed reservation does not mutate usage',(select attempts from public.ai_daily_usage where utc_day=(clock_timestamp() at time zone 'UTC')::date)=2);
reset role;
insert into public.ai_quota_config values(true,3);
set role anon;
select set_config('request.jwt.sub','',false);
select pg_temp.denied('anonymous quota RPC denied','select public.reserve_nutrition_quota()');
select pg_temp.denied('anonymous counter denied','select * from public.ai_daily_usage');
reset role;
set role authenticated;
select pg_temp.denied('authenticated role without UID denied','select public.reserve_nutrition_quota()');
reset role;
