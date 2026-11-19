-- Synthetic fixtures only. Every attack runs as authenticated/anon, NOT postgres.
\set ON_ERROR_STOP on
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
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','a@test.invalid'),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','b@test.invalid'),
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','c@test.invalid');
grant usage on schema auth, storage, public to anon;
grant select on storage.objects, public.couples to anon;
set role authenticated;
select pg_temp.check_true('tests use authenticated role', current_user = 'authenticated');
select set_config('request.jwt.sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select public.create_couple_invite() as a_code \gset
select pg_temp.denied('self invite rejected', format('select public.accept_couple_invite(%L)', :'a_code'));
select set_config('request.jwt.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',false);
select public.create_couple_invite() as stale_b_code \gset
select public.accept_couple_invite(:'a_code');
select pg_temp.check_true('legitimate invite accepted', public.partner_of(auth.uid()) = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
-- UPDATE can be a zero-row RLS denial or a privilege error; assert immutability either way.
do $$ begin
  begin update public.couples set user_a = 'cccccccc-cccc-cccc-cccc-cccccccccccc' where user_b = auth.uid(); exception when insufficient_privilege then null; end;
  if public.partner_of(auth.uid()) <> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' then raise exception 'FAIL membership swap'; end if;
  raise notice 'PASS: membership swap denied';
end $$;
-- Trigger defense survives an accidentally reintroduced permissive update policy.
reset role;
create policy test_old_update_policy on public.couples for update to authenticated
 using (auth.uid() in (user_a,user_b)) with check (auth.uid() in (user_a,user_b));
set role authenticated;
select pg_temp.denied('immutable-members trigger blocks old-policy swap', 'update public.couples set user_a = ''cccccccc-cccc-cccc-cccc-cccccccccccc'' where user_b = auth.uid()');
reset role;
drop policy test_old_update_policy on public.couples;
set role authenticated;
select set_config('request.jwt.sub','cccccccc-cccc-cccc-cccc-cccccccccccc',false);
insert into public.memories(id,user_id,data) values('secure:c-private',auth.uid(),'{"caption":"C data must not leak to B"}');
insert into public.couple_shares(user_id,category,shared) values(auth.uid(),'memories',true);
select set_config('request.jwt.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',false);
select pg_temp.check_true('swap attack cannot read C even when C shares memories', not exists(select 1 from public.memories where user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'));
select pg_temp.denied('direct self-created pairing denied', 'insert into public.couples(user_a,user_b) values(auth.uid(),''cccccccc-cccc-cccc-cccc-cccccccccccc'')');
select pg_temp.denied('invite creation spoof denied', 'insert into public.couple_invites(code,created_by) values(''STOLEN'',''cccccccc-cccc-cccc-cccc-cccccccccccc'')');
select pg_temp.denied('already paired cannot create invite', 'select public.create_couple_invite()');
select set_config('request.jwt.sub','cccccccc-cccc-cccc-cccc-cccccccccccc',false);
select pg_temp.denied('used invite cannot be replayed', format('select public.accept_couple_invite(%L)', :'a_code'));
select pg_temp.check_true('outsider sees no couple', (select count(*) from public.couples) = 0);

select set_config('request.jwt.sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
insert into public.couple_shares(user_id,category,shared) values
 (auth.uid(),'memories',true), (auth.uid(),'spending',false), (auth.uid(),'meals',true),
 (auth.uid(),'sleep',true), (auth.uid(),'cycle',true), (auth.uid(),'journal',true), (auth.uid(),'intimacy',true);
insert into public.memories(id,user_id,data) values
 ('secure:memory',auth.uid(),'{"url":"xlife-photo:memory"}'),
 ('secure:overlap',auth.uid(),'{"url":"xlife-photo:overlap"}'),
 ('secure:spoof',auth.uid(),'{"url":"https://attacker/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/spoof.jpg","caption":"xlife-photo:memory-extra"}'),
 ('secure:foreignpath',auth.uid(),'{"url":"xlife-photo:../secret"}');
insert into public.spending(id,user_id,data) values
 ('secure:spending',auth.uid(),'{"photo_url":"xlife-photo:spending"}'),
 ('secure:private-overlap',auth.uid(),'{"photo_url":"xlife-photo:overlap"}');
insert into public.meals(id,user_id,data) values ('secure:meal',auth.uid(),'{"photo_url":"xlife-photo:meal"}');
insert into public.sleep_logs(id,user_id,data) values ('secure:sleep',auth.uid(),'{"url":"xlife-photo:sleep"}');
insert into public.period_logs(id,user_id,data) values ('secure:cycle',auth.uid(),'{"url":"xlife-photo:cycle"}');
insert into public.journal_entries(id,user_id,data) values ('secure:journal',auth.uid(),'{"url":"xlife-photo:journal"}');
insert into public.intimacy_logs(id,user_id,data) values ('secure:intimacy',auth.uid(),'{"url":"xlife-photo:intimacy"}');
insert into storage.objects(bucket_id,name) select 'photos','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/' || id || '.jpg'
 from unnest(array['memory','meal','spending','unreferenced','cycle','sleep','journal','intimacy','overlap','spoof','secret']) id;
select pg_temp.check_true('owner sees own private photos', (select count(*) from storage.objects where name like 'aaaaaaaa%') = 11);
select set_config('request.jwt.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',false);
select pg_temp.check_true('partner sees only exact shared memory and meal', (select count(*) from storage.objects where name like 'aaaaaaaa%') = 2);
select pg_temp.check_true('shared memory allowed', exists(select 1 from storage.objects where name = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/memory.jpg'));
select pg_temp.check_true('private/unreferenced/sensitive/overlap/URL-spoof denied', not exists(select 1 from storage.objects where name ~ '/(spending|unreferenced|cycle|sleep|journal|intimacy|overlap|spoof|secret)[.]jpg$'));
select pg_temp.check_true('path traversal and encoded path denied', not public.partner_can_read_photo('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/../memory.jpg') and not public.partner_can_read_photo('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/%6demory.jpg'));
select pg_temp.denied('partner cannot upload to owner directory', 'insert into storage.objects(bucket_id,name) values(''photos'',''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/injected.jpg'')');
select set_config('request.jwt.sub','cccccccc-cccc-cccc-cccc-cccccccccccc',false);
select pg_temp.check_true('outsider sees no photos', (select count(*) from storage.objects) = 0);
-- Even a forged memory that mentions another owner's ID cannot grant access.
insert into public.memories(id,user_id,data) values ('secure:c-spoof',auth.uid(),'{"url":"xlife-photo:memory"}');
select pg_temp.check_true('foreign-owner record cannot authorize storage', not public.partner_can_read_photo('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/memory.jpg'));
select set_config('request.jwt.sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
update public.couple_shares set shared = false where user_id = auth.uid() and category = 'memories';
select set_config('request.jwt.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',false);
select pg_temp.check_true('category switch revokes memory, keeps meals', (select count(*) from storage.objects where name like 'aaaaaaaa%') = 1);
select set_config('request.jwt.sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
update public.couple_shares set shared = true where user_id = auth.uid() and category = 'spending';
select set_config('request.jwt.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',false);
select pg_temp.check_true('spending opt-in only grants referenced spending', exists(select 1 from storage.objects where name = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/spending.jpg'));
select public.leave_couple();
select pg_temp.check_true('disconnect revokes access', (select count(*) from storage.objects) = 0);
select set_config('request.jwt.sub','cccccccc-cccc-cccc-cccc-cccccccccccc',false);
select pg_temp.denied('pre-pair invitation revoked on acceptance/disconnect', format('select public.accept_couple_invite(%L)', :'stale_b_code'));
-- Expired invitations, including one that was never consumed.
select set_config('request.jwt.sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select public.create_couple_invite() as expired_code \gset
reset role;
update public.couple_invites set expires_at = now() - interval '1 second' where code = :'expired_code';
set role authenticated;
select set_config('request.jwt.sub','cccccccc-cccc-cccc-cccc-cccccccccccc',false);
select pg_temp.denied('expired invitation rejected', format('select public.accept_couple_invite(%L)', :'expired_code'));
-- Legitimate re-pair with a NEW code works; unpair cannot destroy somebody else's couple.
select set_config('request.jwt.sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select public.create_couple_invite() as fresh_code \gset
select set_config('request.jwt.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',false);
select public.accept_couple_invite(:'fresh_code');
select set_config('request.jwt.sub','cccccccc-cccc-cccc-cccc-cccccccccccc',false);
select public.leave_couple();
select set_config('request.jwt.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',false);
select pg_temp.check_true('outsider disconnect leaves real couple intact', public.partner_of(auth.uid()) = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
-- Legacy/racy state: inviter is already paired in the OTHER membership column.
select set_config('request.jwt.sub','cccccccc-cccc-cccc-cccc-cccccccccccc',false);
select public.create_couple_invite() as c_stale_code \gset
reset role;
insert into auth.users(id,email) values
 ('dddddddd-dddd-dddd-dddd-dddddddddddd','d@test.invalid'),
 ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','e@test.invalid');
insert into public.couples(user_a,user_b) values('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','cccccccc-cccc-cccc-cccc-cccccccccccc');
set role authenticated;
select set_config('request.jwt.sub','eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',false);
select pg_temp.check_true('legacy forged couple cannot authorize partner reads', public.partner_of(auth.uid()) is null);
select set_config('request.jwt.sub','dddddddd-dddd-dddd-dddd-dddddddddddd',false);
select pg_temp.check_true('outsider cannot query another couple via helper', public.partner_of('cccccccc-cccc-cccc-cccc-cccccccccccc') is null);
select pg_temp.denied('already-paired inviter in other column rejected', format('select public.accept_couple_invite(%L)', :'c_stale_code'));
reset role;
set role anon;
select set_config('request.jwt.sub','',false);
select pg_temp.denied('anonymous create denied', 'select public.create_couple_invite()');
select pg_temp.denied('anonymous accept denied', format('select public.accept_couple_invite(%L)', :'fresh_code'));
select pg_temp.denied('anonymous leave denied', 'select public.leave_couple()');
select pg_temp.check_true('anonymous storage denied', (select count(*) from storage.objects) = 0);
reset role;
