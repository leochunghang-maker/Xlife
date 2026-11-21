import { execFile } from 'node:child_process';
import assert from 'node:assert/strict';
// Separate actual psql connections, all SET ROLE authenticated. No shared JS
// counter masquerading as a concurrency test. psql failures reject the suite.
export async function testQuotaConcurrency({port,env,psqlFile}) {
 const run=(sql)=>new Promise((resolve,reject)=>execFile('psql',['-v','ON_ERROR_STOP=1','-At','-h','127.0.0.1','-p',String(port),'-U','postgres','-d','postgres','-c',sql],{env,encoding:'utf8'},(error,out,stderr)=>error?reject(new Error(stderr||error.message)):resolve(out.trim())));
 const uid='88888888-8888-8888-8888-888888888888';
 await run(`insert into auth.users(id,email) values('${uid}','concurrent@test.invalid'); update public.ai_quota_config set daily_limit=7;`);
 // Deliberately delay INSERT to overlap attempts at the contention point.
 await run(`create function public.test_quota_overlap() returns trigger language plpgsql as $quota$ begin if new.user_id='${uid}' then perform pg_sleep(0.03); end if; return new; end $quota$; create trigger test_quota_overlap before insert on public.ai_daily_usage for each row execute function public.test_quota_overlap();`);
 const attempts=await Promise.all(Array.from({length:40},()=>run(`set role authenticated; set request.jwt.sub='${uid}'; select public.reserve_nutrition_quota();`)));
 const allowed=attempts.filter(s=>s.split('\n').at(-1)==='t').length;
 assert.equal(allowed,7,'40 concurrent real SQL reservations must allow exactly 7');
 const count=await run(`select attempts from public.ai_daily_usage where user_id='${uid}' and utc_day=(clock_timestamp() at time zone 'UTC')::date;`);
 assert.equal(count,'7');
 await run('drop trigger test_quota_overlap on public.ai_daily_usage; drop function public.test_quota_overlap();');
 console.log('PASS SQL concurrency: 40 authenticated connections, exactly 7 allowed / 33 denied, persisted attempts=7');
 // Re-running the additive migration must never lower already-spent quota;
 // legacy audit attempts are carried forward and preserved too.
 await run(`insert into public.ai_requests(user_id,kind) values('${uid}','nutrition');`);
 psqlFile('supabase/migrations/20261121000000_atomic_ai_quota.sql');
 assert.equal(await run(`select attempts from public.ai_daily_usage where user_id='${uid}' and utc_day=(clock_timestamp() at time zone 'UTC')::date;`),'7');
 console.log('PASS SQL migration re-run preserves existing spent quota');
 const legacy='99999999-9999-9999-9999-999999999999';
 await run(`insert into auth.users(id,email) values('${legacy}','legacy-quota@test.invalid'); insert into public.ai_requests(user_id,kind) select '${legacy}','nutrition' from generate_series(1,8);`);
 psqlFile('supabase/migrations/20261121000000_atomic_ai_quota.sql');
 assert.equal(await run(`set role authenticated; set request.jwt.sub='${legacy}'; select public.reserve_nutrition_quota();`),'SET\nSET\nf');
 console.log('PASS legacy ai_requests UTC attempts carried forward, no upgrade quota reset');
}
