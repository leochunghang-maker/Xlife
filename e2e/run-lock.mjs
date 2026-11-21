// Isolated fake-config server; never reads a developer .env or a real project.
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
const port = 4186;
const url = `http://127.0.0.1:${port}/`;
const env = { ...process.env, VITE_ENABLE_CLOUD: 'false', VITE_ENABLE_AI_NUTRITION: 'false', XLIFE_LOCK_URL: url };
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'e2e/vite.lock.config.mjs', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { env, stdio: ['ignore','pipe','pipe'] });
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
  await run('e2e/test-lock.mjs');
} catch(error) { console.error(error); process.exitCode = 1; }
finally { server.kill('SIGTERM'); await exited; }
