// Isolated fake-config server; never reads a developer .env or a real project.
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
const port = 4185;
const url = `http://127.0.0.1:${port}/`;
const env = { ...process.env, VITE_SUPABASE_URL: 'https://xlife-security.invalid', VITE_SUPABASE_ANON_KEY: 'synthetic-test-only', VITE_ENABLE_CLOUD: 'true', VITE_ENABLE_AI_NUTRITION: 'true', XLIFE_SECURITY_URL: url, XLIFE_CLOUD_URL: url };
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { env, stdio: ['ignore','pipe','pipe'] });
let output = ''; server.stdout.on('data', d=> { output += d; }); server.stderr.on('data', d=> { output += d; });
const exited = new Promise(resolve=> server.on('exit',resolve));
async function run(file) {
  const child = spawn(process.execPath,[file],{env,stdio:'inherit'});
  const code = await new Promise((resolve,reject)=>{ child.on('error',reject); child.on('exit',resolve); });
  if(code !== 0) throw new Error(`${file} exited ${code}`);
}
try {
  let ready = false;
  for(let i=0;i<100;i++) {
    if(server.exitCode !== null) throw new Error(`Test server exited: ${output}`);
    try { ready = (await fetch(url)).ok; } catch { /* startup */ }
    if(ready) break;
    await delay(100);
  }
  if(!ready) throw new Error(`Test server did not become ready: ${output}`);
  await run('e2e/test-cloud.mjs');
  await run('e2e/test-security.mjs');
} catch(error) { console.error(error); process.exitCode = 1; }
finally { server.kill('SIGTERM'); await exited; }
