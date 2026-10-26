import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.MUMU_PLAYWRIGHT_MODULE || `${process.env.USERPROFILE}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const directory = 'artifacts/cloudflare-deploy-20261013';
const browser = await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=d3d11','--mute-audio']});
const context = await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
await context.addInitScript(() => localStorage.setItem('mumu.circuit.graphics.v1','low'));
const page = await context.newPage();
const errors = [], failedRequests = [], states = [];
page.on('pageerror',error => errors.push(String(error)));
page.on('console',message => { if(message.type()==='error') errors.push(message.text()); });
page.on('requestfailed',request => failedRequests.push({url:request.url(),error:request.failure()}));
const snapshot = async phase => {
  const state = await page.evaluate(() => window.__mumuRebuild);
  states.push({phase,state});
  return state;
};
try {
  await page.goto('https://racing.mumuworld.com/?track=namak',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.__mumuRebuild?.mode==='garage',undefined,{timeout:120000});
  await snapshot('garage');
  await page.screenshot({path:`${directory}/public-garage.png`});
  await page.locator('.launch-modes > button.primary').click();
  await page.waitForFunction(()=>window.__mumuRebuild?.mode==='race'&&window.__mumuRebuild?.countdown<=0,undefined,{timeout:120000});
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(()=>window.__mumuRebuild?.input?.throttle===1,undefined,{timeout:15000});
  await page.waitForTimeout(5000);
  await snapshot('driving');
  await page.screenshot({path:`${directory}/public-driving.png`});
  await page.keyboard.press('Escape');
  await page.keyboard.up('ArrowUp');
  await page.waitForFunction(()=>window.__mumuRebuild?.paused&&window.__mumuRebuild?.input?.throttle===0);
  await snapshot('pause-input-cleared');
  await page.getByRole('button',{name:'차고로 돌아가기',exact:true}).click();
  await page.waitForFunction(()=>window.__mumuRebuild?.mode==='garage');
  await snapshot('returned-to-garage');
  assert.equal(errors.length,0);
  assert.equal(failedRequests.length,0);
  const report={url:page.url(),execution:'Public HTTPS site, isolated headless Edge, native keyboard, 1280x720/DPR1/low. Brief driving smoke, not a full race or real mobile test.',states,errors,failedRequests};
  fs.writeFileSync(`${directory}/browser-smoke.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify({url:page.url(),phases:states.map(s=>s.phase),errors,failedRequests},null,2));
} catch(error) {
  fs.writeFileSync(`${directory}/browser-smoke-failure.json`,JSON.stringify({error:String(error.stack),states,errors,failedRequests},null,2));
  throw error;
} finally { await browser.close(); }
