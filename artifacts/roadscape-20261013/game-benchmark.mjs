import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.MUMU_PLAYWRIGHT_MODULE || (process.env.USERPROFILE + '/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const label=process.argv[2]||'quiet-game-low',track=process.argv[3]||'namak',quality=process.argv[4]||'low',dir='artifacts/roadscape-20261013';
if(fs.existsSync(`${dir}/${label}.json`))throw Error('preserve prior samples');
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=d3d11','--mute-audio']});
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
await context.addInitScript(q=>{localStorage.setItem('mumu.circuit.graphics.v1',q);},quality);
const page=await context.newPage(),errors=[],results=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 for(const before of [true,false,true]){
  if(results.length)await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  const path=before?'/artifacts/roadscape-20261013/baseline-game.html':'/';
  await page.goto(`http://127.0.0.1:5196${path}?track=${track}&qaPerf=1`,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.__mumuRebuild?.mode==='garage',undefined,{timeout:120000});
  await page.getByRole('button',{name:'30초 제품 기준 측정',exact:true}).click();
  await page.waitForFunction(()=>window.__mumuRebuild?.performanceTrial?.status==='complete',undefined,{timeout:180000});
  const state=await page.evaluate(()=>window.__mumuRebuild);const probe=state.performanceTrial.results[0];
  if(!probe||probe.durationMs<30000||probe.context.profile||probe.context.frozen)throw Error('acceptance sample is incomplete or instrumented');
  const frame=probe.frame;if(frame.samples<1||probe.intervals.some(r=>!r.visible||!r.focused))throw Error('hidden/unfocused sample retained as failure, not acceptance');
  const gpu=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2');if(!gl)return null;const e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
  await page.screenshot({path:`${dir}/${label}-${results.length+1}-${before?'before':'after'}.png`});
  results.push({before,probe,gpu,loading:state.loading,input:state.input,rendering:state.rendering});
  fs.writeFileSync(`${dir}/${label}-partial.json`,JSON.stringify({execution:'Headless Edge actual development application / real local GPU and Rapier; no expensive GPU/profile/frozen hooks.',track,quality,results,errors},null,2));
 }
 const report={execution:'Same headless Edge session/page/1280x720/DPR/quality/car/course/start segment, actual Rapier automatic pedals. No GPU query, frozen comparison or profile hook. Fresh test-owned storage per condition. Not mobile or human driving.',track,quality,results,errors};fs.writeFileSync(`${dir}/${label}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({track,quality,errors,results:results.map(r=>({before:r.before,context:r.probe.context,frame:r.probe.frame,cpu:r.probe.cpu,gpu:r.gpu}))},null,2));if(errors.length)process.exitCode=1;
}catch(e){fs.writeFileSync(`${dir}/${label}-failure.json`,JSON.stringify({error:String(e.stack||e),results,errors},null,2));throw e;}finally{await browser.close();}
