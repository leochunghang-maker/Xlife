grant all on all tables in schema public to authenticated;
grant all on storage.objects to authenticated;
insert into auth.users (id, email, raw_user_meta_data) values
 ('11111111-1111-1111-1111-111111111111','a@x','{"name":"Ann"}'),
 ('22222222-2222-2222-2222-222222222222','b@x','{"name":"Ben"}'),
 ('33333333-3333-3333-3333-333333333333','c@x','{}');
select count(*) as profiles_created from public.profiles;
set role authenticated;
-- Ann writes data
select set_config('request.jwt.sub','11111111-1111-1111-1111-111111111111', false);
insert into public.memories (id, user_id, date, data) values ('a:m1', auth.uid(), '2026-11-01', '{"caption":"hi"}');
insert into public.period_logs (id, user_id, date, data) values ('a:p1', auth.uid(), '2026-11-01', '{"flow":"medium"}');
insert into public.couple_shares (user_id, category, shared) values (auth.uid(), 'memories', true), (auth.uid(), 'cycle', false);
select public.create_couple_invite() as code \gset
-- Ann cannot write as Ben
do $$ begin
  insert into public.memories (id, user_id, data) values ('x', '22222222-2222-2222-2222-222222222222', '{}');
  raise exception 'RLS FAIL: wrote as other user';
exception when insufficient_privilege then raise notice 'ok: cannot write as other user';
end $$;
-- Ben before pairing sees nothing
select set_config('request.jwt.sub','22222222-2222-2222-2222-222222222222', false);
select count(*) as ben_sees_memories_before from public.memories;
select public.accept_couple_invite(:'code') is not null as paired;
select count(*) as ben_sees_memories_after from public.memories;
select count(*) as ben_sees_cycle_after from public.period_logs;
select name as partner_name from public.profiles where id = '11111111-1111-1111-1111-111111111111';
-- Carl (unpaired) sees nothing, cannot reuse code
select set_config('request.jwt.sub','33333333-3333-3333-3333-333333333333', false);
select count(*) as carl_sees from public.memories;
do $$ begin perform public.accept_couple_invite('ZZZZZZZZ'); raise exception 'FAIL'; exception when others then raise notice 'ok: bad code rejected: %', sqlerrm; end $$;
-- storage
select set_config('request.jwt.sub','11111111-1111-1111-1111-111111111111', false);
insert into storage.objects (bucket_id, name) values ('photos', '11111111-1111-1111-1111-111111111111/p1.jpg');
select set_config('request.jwt.sub','22222222-2222-2222-2222-222222222222', false);
select count(*) as ben_sees_ann_photos from storage.objects;
select set_config('request.jwt.sub','33333333-3333-3333-3333-333333333333', false);
select count(*) as carl_sees_photos from storage.objects;
-- Ann turns off memories sharing
select set_config('request.jwt.sub','11111111-1111-1111-1111-111111111111', false);
update public.couple_shares set shared=false where user_id=auth.uid() and category='memories';
select set_config('request.jwt.sub','22222222-2222-2222-2222-222222222222', false);
select count(*) as ben_sees_after_unshare from public.memories;
select public.leave_couple();
select count(*) as couples_left from public.couples;
-- daily question reveal rule
select set_config('request.jwt.sub','11111111-1111-1111-1111-111111111111', false);
select public.create_couple_invite() as code2 \gset
select set_config('request.jwt.sub','22222222-2222-2222-2222-222222222222', false);
select public.accept_couple_invite(:'code2') is not null as repaired;
select set_config('request.jwt.sub','11111111-1111-1111-1111-111111111111', false);
insert into public.couple_answers (id, user_id, date, question, answer) values ('a:q1', auth.uid(), '2026-11-13', 'Q?', 'Ann answer');
select set_config('request.jwt.sub','22222222-2222-2222-2222-222222222222', false);
select count(*) as ben_sees_answer_before_answering from public.couple_answers;
insert into public.couple_answers (id, user_id, date, question, answer) values ('b:q1', auth.uid(), '2026-11-13', 'Q?', 'Ben answer');
select count(*) as ben_sees_answers_after_answering from public.couple_answers;
