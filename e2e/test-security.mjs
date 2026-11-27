import { chromium } from 'playwright-core';
const URL = process.env.XLIFE_SECURITY_URL || 'http://localhost:4175/';
const A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const results = [];
function ok(name, value) { results.push(`${value ? 'PASS' : 'FAIL'} ${name}`); }
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
function auth(uid = A, email = 'a@test.invalid') {
  const token = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: uid, email, role: 'authenticated', exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url')}.fake-signature`;
  return { access_token: token, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, user: { id: uid, email, aud: 'authenticated', role: 'authenticated', user_metadata: {} } };
}
async function fixture({ session = null, bound = false, active = true, uid = A, email = "a@test.invalid" } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  const calls = []; const controls = { login: auth(), holdTable: null, release: null, reached: null, foreignRestore: false, validRestore: false };
  await page.route('https://xlife-security.invalid/**', async route => {
    const req = route.request(); const url = new globalThis.URL(req.url());
    calls.push({ path: url.pathname, method: req.method(), body: req.postData(), auth: req.headers().authorization });
    let body = [];
    if (url.pathname.includes('/auth/v1/token')) body = controls.login;
    else if (url.pathname.includes('/auth/v1/user')) body = (session || controls.login).user;
    else if (url.pathname.includes('/auth/v1/logout')) return route.fulfill({ status: 204 });
    else if (url.pathname.includes('/rest/v1/couples') || url.pathname.includes('/rest/v1/profiles') && req.method() === 'GET') body = null;
    else if (url.pathname.includes('/storage/v1/object/') && req.method() === 'POST') body = { Key: 'fake-photo' };
    else if (controls.validRestore && url.pathname.endsWith('/daily_logs')) body = [{id:A+':2025-01-01', user_id:A, date:'2025-01-01', data:{date:'2025-01-01',notes:'original owner diary',meals:[],snaps:[]}}];
    else if (controls.foreignRestore && url.pathname.endsWith('/daily_logs')) body = [{id:'foreign', user_id:B, date:'2020-01-01', data:{notes:'wrong owner'}}];
    else if (controls.holdTable && url.pathname.endsWith('/'+controls.holdTable)) {
      controls.reached?.();
      await new Promise(resolve => { controls.release = resolve; });
      body = [{ id: A+':foreign', user_id: A, date: '2026-01-01', data: { notes: 'must not restore after signout' } }];
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }).catch(() => {});
  });
  await page.addInitScript(({ session, bound, active, uid, email }) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded','yes');
    localStorage.setItem('dayflow_user', JSON.stringify({ id: uid === 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' ? 'local-a' : 'local-b', email, name: 'Synthetic fixture' }));
    localStorage.setItem('dayflow_active_session', active ? 'true' : 'false');
    localStorage.setItem('dayflow_log', JSON.stringify({ date: '2026-01-01', notes: 'private A diary', meals: [], snaps: [] }));
    if (bound) localStorage.setItem('xlife_data_owner_v1', JSON.stringify({ uid, email, profileId: uid === 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' ? 'local-a' : 'local-b' }));
    if (session) localStorage.setItem('sb-xlife-security-auth-token', JSON.stringify(session));
  }, { session, bound, active, uid, email });
  await page.goto(URL); await page.locator('h1').first().waitFor();
  await page.waitForTimeout(300);
  return { ctx, page, calls, controls, errors };
}
async function settings(page) { await page.getByRole('button', {name:'Home', exact:true}).click(); await page.getByRole('button', {name:'Settings', exact:true}).click(); }
async function cloudEval(page, fn, arg) { return page.evaluate(async ([text, arg]) => { const c = await import('/src/lib/cloud.js'); return new Function('c','arg', `return (${text})(c,arg)`)(c,arg); }, [fn.toString(), arg]); }
try {
  { // CloudSettings rejects B before even changing the session.
    const f = await fixture(); const { page, calls } = f;
    await settings(page);
    await page.getByPlaceholder('Email', { exact:true }).fill('b@test.invalid');
    await page.getByPlaceholder('Password', { exact:true }).fill('not-stored');
    await page.getByRole('button', {name:'Sign in',exact:true}).click();
    await page.getByText(/Account mismatch/).waitFor();
    ok('Settings mismatched sign-in blocked before auth request', !calls.some(c => c.path.includes('/token')));
    ok('Settings mismatch preserves local profile and no password stored', await page.evaluate(() => JSON.parse(localStorage.getItem('dayflow_user')).id === 'local-a' && !JSON.stringify(localStorage).includes('not-stored')));
    // Matching account login still requires explicit association; no upload before consent.
    await page.getByPlaceholder('Email',{exact:true}).fill('a@test.invalid');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await page.getByRole('button',{name:'Associate this phone’s data'}).waitFor();
    ok('legacy local data remains unbound until explicit consent', await page.getByRole('button',{name:'Back up now'}).isDisabled() && !calls.some(c=>c.path.startsWith('/rest/')));
    await page.getByRole('button',{name:'Associate this phone’s data'}).click();
    await page.getByText('Data associated. Cloud operations are now available.').waitFor();
    ok('explicit matching-account association persisted', await page.evaluate(() => JSON.parse(localStorage.getItem('xlife_data_owner_v1')).uid) === A);
    await page.getByRole('button',{name:'Back up now'}).click();
    await page.getByText('Backup complete. Your data is still on this phone too.').waitFor();
    const writes = calls.filter(c=> c.path.startsWith('/rest/') && c.method === 'POST');
    ok('original owner can back up, all payloads use A not B', writes.length > 0 && writes.every(c=>!c.body?.includes(B)));
    ok('Settings account flow has no runtime errors', f.errors.length === 0);
    await f.ctx.close();
  }
  { // Onboarding uses the same preflight; cannot leave B's session behind.
    const f = await fixture({ active: false }); const {page,calls} = f;
    await page.getByRole('button',{name:'Sign In',exact:true}).first().click();
    await page.getByPlaceholder('Email',{exact:true}).fill('b@test.invalid');
    await page.getByPlaceholder('Password',{exact:true}).fill('not-stored');
    await page.getByRole('button',{name:'Sign In',exact:true}).click();
    await page.getByText(/Account mismatch/).waitFor();
    ok('Onboarding mismatch never changes auth or local identity', !calls.some(c=>c.path.includes('/token')) && await page.evaluate(()=>JSON.parse(localStorage.getItem('dayflow_user')).id === 'local-a'));
    await f.ctx.close();
  }
  { // Unexpected returned UID, and a persisted mismatched session, are signed out.
    const f = await fixture({bound:true}); await settings(f.page);
    f.controls.login = auth(B,'a@test.invalid');
    await f.page.getByPlaceholder('Password',{exact:true}).fill('fake');
    await f.page.getByRole('button',{name:'Sign in',exact:true}).click();
    await f.page.getByText(/Account mismatch/).waitFor();
    ok('unexpected returned UID signed out without data request', !f.calls.some(c=>c.path.startsWith('/rest/')) && !await f.page.evaluate(()=>localStorage.getItem('sb-xlife-security-auth-token')));
    await f.ctx.close();
    const g = await fixture({session:auth(B,'b@test.invalid'),bound:true});
    const blocked = await cloudEval(g.page, async c => { try { await c.backupLocalToCloud(); return false; } catch { return true; } });
    ok('persisted mismatched session cannot upload and is removed', blocked && !g.calls.some(c=>c.path.startsWith('/rest/')) && !await g.page.evaluate(()=>localStorage.getItem('sb-xlife-security-auth-token')));
    await g.ctx.close();
  }
  { // Pure payload guard is not only a button/UI check.
    const f = await fixture({session:auth(),bound:true});
    const r = await cloudEval(f.page, async (c, B) => {
      let denied = false; try { c.buildCloudRows(B); } catch { denied = true; }
      return {denied, valid: Object.values(c.buildCloudRows('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')).flat().every(r=>r.user_id !== B)};
    }, B);
    ok('wrong-owner backup payload denied, original owner allowed', r.denied && r.valid);
    const offline = await f.page.evaluate(async B => {
      const {applyBackupPackage} = await import('/src/lib/backup.js');
      const before = JSON.stringify(localStorage);
      try { await applyBackupPackage({format:'xlife-backup',version:1, keys:{xlife_data_owner_v1:{encoding:'json',value:{uid:B}},dayflow_user:{encoding:'json',value:{id:'other',email:'b@test.invalid'}},dayflow_log:{encoding:'json',value:{notes:'foreign'}}},photos:{}}); return false; }
      catch { return JSON.stringify(localStorage) === before; }
    },B);
    ok('foreign offline restore denied before any identity or data write', offline);
    const keys = await cloudEval(f.page, (c,[A,B])=>[c.uploadedPhotosKey(A),c.uploadedPhotosKey(B)], [A,B]);
    ok('upload cache keys are UID scoped', keys[0] !== keys[1] && keys[0].endsWith(A) && keys[1].endsWith(B));
    await f.ctx.close();
  }
  { // Real IndexedDB photo, legacy unscoped cache must NOT skip a new upload.
    const f = await fixture({session:auth(),bound:true});
    await f.page.evaluate(async () => {
      const {savePhotoWithRef} = await import('/src/lib/photoStore.js');
      await savePhotoWithRef('xlife-photo:cachetest','data:image/jpeg;base64,ZmFrZQ==');
      localStorage.setItem('dayflow_log',JSON.stringify({date:'2026-01-01',notes:'',meals:[],snaps:[{id:'s',url:'xlife-photo:cachetest',date:'2026-01-01'}]}));
      localStorage.setItem('xlife_cloud_uploaded_photos',JSON.stringify(['xlife-photo:cachetest']));
    });
    await cloudEval(f.page,c=>c.backupLocalToCloud());
    ok('legacy unscoped cache does not skip upload for A', f.calls.some(c=>c.path.includes('/storage/v1/object/photos/'+A+'/cachetest.jpg')));
    ok('legacy cache preserved; scoped cache written', await f.page.evaluate(A=>Boolean(localStorage.getItem('xlife_cloud_uploaded_photos')) && JSON.parse(localStorage.getItem('xlife_cloud_uploaded_photos:'+A)).includes('xlife-photo:cachetest'),A));
    // SDK persistent session resumes legitimately after reload.
    await f.page.reload(); await f.page.locator('h1').first().waitFor();
    ok('original-owner persistent session works', await cloudEval(f.page,async c=>(await c.getCloudSession())?.user.id) === A);
    await f.ctx.close();
  }
  {
    const f = await fixture({session:auth(B,'b@test.invalid'),bound:true,uid:B,email:'b@test.invalid'});
    await f.page.evaluate(async A => {
      const {savePhotoWithRef} = await import('/src/lib/photoStore.js');
      await savePhotoWithRef('xlife-photo:cachetest','data:image/jpeg;base64,ZmFrZQ==');
      localStorage.setItem('dayflow_log',JSON.stringify({date:'2026-01-01',meals:[],snaps:[{id:'s',url:'xlife-photo:cachetest',date:'2026-01-01'}]}));
      localStorage.setItem('xlife_cloud_uploaded_photos:'+A,JSON.stringify(['xlife-photo:cachetest']));
    },A);
    await cloudEval(f.page,c=>c.backupLocalToCloud());
    ok('B never reuses A cache/path; own upload still occurs', f.calls.some(c=>c.path.includes('/storage/v1/object/photos/'+B+'/cachetest.jpg')) && !f.calls.some(c=>c.path.includes('/storage/v1/object/photos/'+A+'/')));
    await f.ctx.close();
  }
  {
    const f = await fixture({session:auth(),bound:true}); f.controls.foreignRestore = true;
    const before = await f.page.evaluate(()=>localStorage.getItem('dayflow_daily_logs'));
    const denied = await cloudEval(f.page,async c=> { try { await c.restoreFromCloud(); return false; } catch(error) { return error.message.includes('different account'); } });
    ok('foreign-owner cloud restore rows rejected before merge',denied && await f.page.evaluate(()=>localStorage.getItem('dayflow_daily_logs')) === before);
    f.controls.foreignRestore = false; f.controls.validRestore = true;
    await cloudEval(f.page,c=>c.restoreFromCloud());
    ok('original owner can restore its own verified-owner rows',await f.page.evaluate(()=>JSON.parse(localStorage.getItem('dayflow_daily_logs'))['2025-01-01']?.notes) === 'original owner diary');
    await f.ctx.close();
  }
  { // A job already in flight must stop before sending further table payloads.
    const f = await fixture({session:auth(),bound:true}); f.controls.holdTable = 'daily_logs';
    const reached = new Promise(resolve=> { f.controls.reached = resolve; });
    await f.page.evaluate(async()=>{ const c = await import('/src/lib/cloud.js'); window.backupResult = c.backupLocalToCloud().then(()=> 'allowed',()=> 'blocked'); });
    await reached;
    await cloudEval(f.page,c=>c.cloudSignOut()); f.controls.release();
    const result = await f.page.evaluate(()=>window.backupResult);
    ok('signout cancels in-flight backup before remaining payloads/status', result === 'blocked' && !f.calls.some(c=>c.path.endsWith('/memories')) && !await f.page.evaluate(()=>localStorage.getItem('xlife_cloud_status')));
    await f.ctx.close();
  }
  { // Pause restore response then sign out: late response must not mutate storage.
    const f = await fixture({session:auth(),bound:true});
    f.controls.holdTable = 'daily_logs';
    const reached = new Promise(resolve => { f.controls.reached = resolve; });
    await f.page.evaluate(async()=> { const c = await import('/src/lib/cloud.js'); window.restoreResult = c.restoreFromCloud().then(()=> 'allowed',()=> 'blocked'); });
    await reached;
    const before = await f.page.evaluate(()=>localStorage.getItem('dayflow_daily_logs'));
    await cloudEval(f.page,c=>c.cloudSignOut());
    f.controls.release();
    const result = await f.page.evaluate(()=>window.restoreResult);
    ok('signout aborts in-flight restore; late response cannot write',result === 'blocked' && await f.page.evaluate(()=>localStorage.getItem('dayflow_daily_logs')) === before);
    await f.ctx.close();
  }
  { // Background jobs are gated with the same owner/session rules.
    const f = await fixture({session:auth(B,'b@test.invalid'),bound:true});
    await f.page.evaluate(async()=>{ const c = await import('/src/lib/cloudAuto.js'); c.maybeAutoBackup(); });
    await f.page.waitForTimeout(400);
    ok('background job never uploads A data under mismatched B', !f.calls.some(c=>c.path.startsWith('/rest/') || c.path.startsWith('/storage/')));
    await f.ctx.close();
  }
} finally { await browser.close(); }
console.log(results.join('\n'));
console.log(`Security checks: ${results.length}, failures: ${results.filter(r=>r.startsWith('FAIL')).length}`);
if(results.some(r=>r.startsWith('FAIL'))) process.exit(1);
