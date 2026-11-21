// Synthetic isolated RLS tests, no Docker or live Supabase. Requires psql.
import { testQuotaConcurrency } from './quota-concurrency.mjs';
import EmbeddedPostgres from 'embedded-postgres';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const databaseDir = await mkdtemp(join(tmpdir(), 'xlife-sql-'));
const port = Number(process.env.XLIFE_SQL_PORT || 54329);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid isolated SQL test port');
const pg = new EmbeddedPostgres({ databaseDir, user: 'postgres', password: 'synthetic-test-password', port, persistent: false });
let started = false;
function psql(file) {
  const out = execFileSync('psql', ['-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',String(port),'-U','postgres','-d','postgres','-f',file], {
    env: { ...process.env, PGPASSWORD: 'synthetic-test-password' }, encoding: 'utf8', stdio: ['ignore','pipe','pipe'],
  });
  return out;
}
try {
  await pg.initialise(); await pg.start(); started = true;
  psql('supabase/tests/supabase_stub.sql');
  const migration = 'supabase/migrations/20261113000000_xlife_init.sql';
  psql(migration); psql(migration);
  psql('supabase/migrations/20261113000100_couple_daily_question.sql');
  const upgrade = 'supabase/migrations/20261119000000_partner_authorization.sql';
  psql(upgrade); psql(upgrade);
  // Notices are emitted on stderr; assertions all RAISE on failure and psql's
  // ON_ERROR_STOP makes that exit nonzero. Log named PASS assertions as SQL rows.
  console.log(psql('supabase/tests/rls_smoke.sql'));
  console.log(psql('supabase/tests/security_regression.sql'));
  const quotaUpgrade='supabase/migrations/20261121000000_atomic_ai_quota.sql';
  psql(quotaUpgrade); psql(quotaUpgrade);
  console.log(psql('supabase/tests/ai_quota_regression.sql'));
  await testQuotaConcurrency({port,env:{...process.env,PGPASSWORD:'synthetic-test-password'},psqlFile:psql});
  console.log('PASS isolated SQL migrations (including upgrade re-run) and authenticated/anon security regressions');
} catch(error) {
  console.error('FAIL isolated SQL:', error.message, error.stdout, error.stderr);
  process.exitCode = 1;
} finally {
  if(started) await pg.stop();
  await rm(databaseDir, { recursive: true, force: true });
}
