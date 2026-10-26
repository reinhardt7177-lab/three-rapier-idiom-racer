import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.MUMU_PLAYWRIGHT_MODULE || (process.env.USERPROFILE + '/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const track=process.argv[2]||'coastal',quality=process.argv[3]||'high',label=process.argv[4]||'baseline',kind=process.argv[5]||'capture',index=process.argv[6];
const dir=path.resolve('artifacts/roadscape-20261013'),prefix=path.join(dir,`${label}-${track}-${quality}`);if(fs.existsSync(prefix+'.json'))throw Error('Evidence already exists');
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=d3d11']});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});const errors=[],records=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const started=performance.now();
try{
 await page.goto(`http://127.0.0.1:5196/artifacts/roadscape-20261013/inspection.html?track=${track}&quality=${quality}&dpr=${quality==='low'?'.75':'1'}${index?'&index='+index:''}`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.graphicsReady||window.graphicsFailure,undefined,{timeout:120000});
 const failure=await page.evaluate(()=>window.graphicsFailure);if(failure)throw Error(failure);
 const context=await page.evaluate(()=>({context:graphicsProbe.context,regions:graphicsProbe.regions,routePoints:graphicsProbe.routePoints}));
 const region=({coastal:'City',namak:'Namak City',yeosu:'Dolsan Bridge',seongsamjae:'Seongsamjae'})[track];
 const found=await page.evaluate(r=>graphicsProbe.find(r),region);if(index===undefined&&found>=0)await page.evaluate(i=>graphicsProbe.camera(i),found);
 for(const enhanced of kind==='capture'?[false]:[false,true,false]){
  await page.evaluate(v=>graphicsProbe.enhanced(v),enhanced);
  if(kind==='measure')records.push(await page.evaluate(()=>graphicsProbe.sample(30)));
  await page.screenshot({path:prefix+`-${records.length||1}-${enhanced?'after':'before'}.png`});
  records.push({capture:await page.evaluate(()=>graphicsProbe.snapshot())});
 }
 const result={execution:'Isolated headless Edge / real WebGL2; scene-only, no Rapier or product UI',startedAt:new Date(Date.now()-(performance.now()-started)).toISOString(),seconds:(performance.now()-started)/1000,context,kind,records,errors};
 fs.writeFileSync(prefix+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify({track,quality,kind,seconds:result.seconds,context,errors,measurements:records.filter(r=>r.samples).map(({raw,...r})=>r)},null,2));
 if(errors.length)process.exitCode=1;
}catch(e){fs.writeFileSync(prefix+'-failure.json',JSON.stringify({error:String(e.stack||e),errors,seconds:(performance.now()-started)/1000},null,2));throw e;}finally{await browser.close();}
