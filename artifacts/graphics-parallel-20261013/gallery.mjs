import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.MUMU_PLAYWRIGHT_MODULE || (process.env.USERPROFILE + '/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const track=process.argv[2],label=process.argv[3]||'gallery';const dir='artifacts/graphics-parallel-20261013';
if(fs.existsSync(`${dir}/${label}-${track}.json`))throw Error('preserve existing gallery');
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=d3d11']});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});const errors=[],rows=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`http://127.0.0.1:5196/artifacts/graphics-parallel-20261013/inspection.html?track=${track}&dpr=1`,{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>window.graphicsReady||window.graphicsFailure,undefined,{timeout:120000});
 const failure=await page.evaluate(()=>window.graphicsFailure);if(failure)throw Error(failure);
 const context=await page.evaluate(()=>({context:graphicsProbe.context,points:graphicsProbe.routePoints,regions:graphicsProbe.regions}));
 for(const fraction of [0,.22,.48,.73]){
  const index=Math.floor(context.points*fraction);await page.evaluate(i=>graphicsProbe.camera(i),index);
  for(const value of [false,true]){await page.evaluate(v=>graphicsProbe.enhanced(v),value);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const file=`${dir}/${label}-${track}-${index}-${value?'after':'before'}.png`;await page.screenshot({path:file});rows.push({index,value,path:file,...await page.evaluate(()=>graphicsProbe.snapshot())});}
 }
 const report={execution:'Isolated headless Edge scene, no game physics/UI; CPU regression concurrently running; captures only, no performance acceptance.',context,rows,errors};fs.writeFileSync(`${dir}/${label}-${track}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({track,captures:rows.length,errors,regions:context.regions},null,2));if(errors.length)process.exitCode=1;
}finally{await browser.close();}
