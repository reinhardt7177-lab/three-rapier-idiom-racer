import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import expected from './public-manifest.mjs';
const dir='artifacts/vercel-cutover-20261014',bin=process.argv[2],assets=process.argv[3]==='assets';
const child=spawn(process.execPath,[bin,'dev','--remote','--config',path.resolve(dir,'probe-wrangler.jsonc'),'--ip','127.0.0.1','--port','8852','--show-interactive-dev-session','false'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
let ready=false,tail='';
const observe=b=>{tail=(tail+b.toString()).slice(-6000);if(/Ready on|Ready at/.test(tail))ready=true;};
child.stdout.on('data',observe);child.stderr.on('data',observe);
let result;const start=Date.now();
try{
 while(Date.now()-start<60000&&child.exitCode===null){
  if(ready){try{const r=await fetch('http://127.0.0.1:8852/'+(assets?'assets':''),{signal:AbortSignal.timeout(assets?90000:20000)}),data=await r.json();if(data.host==='racing.mumuworld.com'){result={...data,localProxyStatus:r.status};}}catch(error){result={failed:true,reason:String(error)};}break;}
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 if(!result)result={failed:true,reason:'Remote Wrangler preview did not return the bounded domain diagnostic',childExit:child.exitCode,ready};
 fs.writeFileSync(`${dir}/${assets?'remote-public-assets':'remote-probe'}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,results:undefined},null,2));
}finally{
 if(child.exitCode===null){try{execFileSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore'});}catch{}}
}
if(result.failed||(assets&&(result.files!==expected.files.length||result.matched!==expected.files.length||!result.sourceMatch||result.missingAssetStatus!==404||!result.routes?.every(r=>r.status===200&&r.entry))))process.exitCode=1;
