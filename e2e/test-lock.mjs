import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
let count=0;const ok=(name,value)=>{assert.ok(value,name);count++;console.log('PASS '+name);};
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{
  window.__nativeLock={added:0,removed:0,calls:0,outcome:sessionStorage.getItem('biometric-outcome')||'success',supported:sessionStorage.getItem('plugin-missing')!=='true'};
  window.__clockShift=0;const realNow=Date.now;Date.now=()=>realNow()+window.__clockShift;
  localStorage.setItem('dayflow_user',JSON.stringify({id:'lock-test',name:'Synthetic lock fixture',email:'lock@test.invalid'}));
 });
 await page.goto(process.env.XLIFE_LOCK_URL||'http://127.0.0.1:4186/');await page.locator('h1').first().waitFor();
 await page.getByRole('button',{name:'Home',exact:true}).click();await page.getByRole('button',{name:'Settings',exact:true}).click();
 const toggle=page.getByRole('switch',{name:'Lock with Face ID'});
 await toggle.click();await page.waitForFunction(()=>window.__nativeLock.added===2);
 ok('Settings enabling installs native lifecycle subscriptions in same session',await toggle.getAttribute('aria-checked')==='true');
 ok('enabling verifies once without Gate prompt loop',await page.evaluate(()=>window.__nativeLock.calls)===1);
 await page.evaluate(()=>window.__nativeLock.emit('appStateChange',{isActive:false}));
 await page.getByText('Xlife is private',{exact:true}).waitFor();ok('inactive native event obscures WebView content',await page.getByTestId('app-lock-shield').isVisible());
 await page.evaluate(()=>{window.__clockShift+=60_000;window.__nativeLock.emit('appStateChange',{isActive:true});});
 await page.getByText('Xlife is locked',{exact:true}).waitFor();
 ok('background resume after one minute locks without automatic prompt',await page.evaluate(()=>window.__nativeLock.calls)===1);
 for(const outcome of ['failure','cancel']) {
  await page.evaluate(outcome=>{window.__nativeLock.outcome=outcome;},outcome);
  await page.getByRole('button',{name:'Unlock',exact:true}).click();await page.getByText('Authentication cancelled or failed. Xlife stays locked.').waitFor();
  ok(outcome+' leaves real Gate shield locked',await page.getByText('Xlife is locked',{exact:true}).isVisible());
 }
 await page.evaluate(()=>{window.__nativeLock.outcome='success';});await page.getByRole('button',{name:'Unlock',exact:true}).click();
 await page.getByTestId('app-lock-shield').waitFor({state:'hidden'});
 ok('successful biometric mock unlocks and preserves Settings state',await toggle.getAttribute('aria-checked')==='true');
 await toggle.click();await page.waitForFunction(()=>window.__nativeLock.removed===2);
 ok('same-session disable removes owned native handles',await toggle.getAttribute('aria-checked')==='false');
 await page.evaluate(()=>{window.__nativeLock.emit('pause',{});window.__clockShift+=60_000;window.__nativeLock.emit('appStateChange',{isActive:true});});
 ok('disabled Gate stays unshielded on lifecycle changes',await page.getByTestId('app-lock-shield').count()===0);
 await page.evaluate(()=>{window.__originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='xlife_app_lock')throw new DOMException('synthetic quota','QuotaExceededError');return window.__originalSetItem.call(this,key,value);};});
 await toggle.click();await page.getByText("Couldn't save the lock setting. It was not changed.").waitFor();
 ok('failed preference persistence cannot claim lock enabled or install listeners',await toggle.getAttribute('aria-checked')==='false' && await page.evaluate(()=>window.__nativeLock.added===window.__nativeLock.removed));
 await page.evaluate(()=>{Storage.prototype.setItem=window.__originalSetItem;});
 await page.evaluate(()=>{localStorage.setItem('xlife_app_lock',JSON.stringify({enabled:true}));sessionStorage.setItem('biometric-outcome','cancel');});
 await page.reload();await page.getByText('Authentication cancelled or failed. Xlife stays locked.').waitFor();
 ok('enabled-at-launch cancellation stays locked with exactly one initial prompt',await page.evaluate(()=>window.__nativeLock.calls)===1);
 await page.evaluate(()=>{window.__nativeLock.outcome='success';});await page.getByRole('button',{name:'Unlock',exact:true}).click();
 await page.getByTestId('app-lock-shield').waitFor({state:'hidden'});
 ok('launch cancellation can be retried manually without unlock loop',await page.evaluate(()=>window.__nativeLock.calls)===2);
 await page.evaluate(()=>sessionStorage.setItem('plugin-missing','true'));await page.reload();
 await page.getByText('Authentication cancelled or failed. Xlife stays locked.').waitFor();
 ok('missing native biometric capability fails closed for configured lock',await page.getByText('Xlife is locked',{exact:true}).isVisible() && await page.evaluate(()=>window.__nativeLock.calls)===0);
 ok('mock-native UI produces no runtime errors',errors.length===0);
 console.log(`Mock-native lock browser checks: ${count} (NOT physical Face ID verification)`);
} finally {await browser.close();}
