// Local RLS smoke test without Docker: `npm i --no-save embedded-postgres && node supabase/tests/run-embedded.mjs`
// (needs psql on PATH). Uses a tiny stub of Supabase auth/storage schemas.
import EmbeddedPostgres from "embedded-postgres";
import { execSync } from "node:child_process";
const pg = new EmbeddedPostgres({ databaseDir: ".pgtest-data", user: "postgres", password: "pw", port: 54329, persistent: false });
await pg.initialise(); await pg.start();
const env = { ...process.env, PGPASSWORD: "pw" };
const psql = (f) => execSync(`psql -v ON_ERROR_STOP=1 -h localhost -p 54329 -U postgres -d postgres -f ${f}`, { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
try {
  psql("supabase/tests/supabase_stub.sql");
  console.log(psql("supabase/migrations/20261113000000_xlife_init.sql").split("\n").filter(l => /ERROR/.test(l)).join("\n") || "migration ok");
  console.log("re-run:", psql("supabase/migrations/20261113000000_xlife_init.sql") ? "idempotent ok" : "");
  console.log(psql("supabase/tests/rls_smoke.sql"));
} catch (e) { console.log("FAILED", e.stdout?.slice(-1500), e.stderr?.slice(-2500)); }
await pg.stop();
