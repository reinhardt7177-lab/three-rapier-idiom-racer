import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.MUMU_PLAYWRIGHT_MODULE || `${process.env.USERPROFILE}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const track=process.argv[2],label=process.argv[3]||'first',dir='artifacts/roadscape-20261013';
const indices=track==='yeosu'?[846,1811,3850,4100]:[250,1350,1980];
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=d3d11']});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1}),errors=[],rows=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try {
 await page.goto(`http://127.0.0.1:5196/${dir}/inspection.html?track=${track}`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.graphicsReady||window.graphicsFailure,undefined,{timeout:120000});
 const failure=await page.evaluate(()=>window.graphicsFailure);if(failure)throw Error(failure);
 for(const index of indices){
  await page.evaluate(i=>graphicsProbe.camera(i),index);
  for(const enhanced of [false,true]){
   await page.evaluate(v=>graphicsProbe.enhanced(v),enhanced);
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const file=`${dir}/${label}-${track}-${index}-${enhanced?'after':'before'}.png`;
   await page.screenshot({path:file});rows.push({file,index,enhanced,stats:await page.evaluate(()=>graphicsProbe.snapshot())});
  }
 }
 fs.writeFileSync(`${dir}/${label}-${track}.json`,JSON.stringify({execution:'Isolated Edge/WebGL actual GLB, same road positions before/after. Scene-only captures; not a frame acceptance test.',rows,errors},null,2));
 console.log(JSON.stringify({track,captures:rows.length,errors}));if(errors.length)process.exitCode=1;
}catch(error){fs.writeFileSync(`${dir}/${label}-${track}-failure.json`,JSON.stringify({error:String(error.stack),rows,errors},null,2));throw error;}
finally{await browser.close();}
