import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
const dir='artifacts/vercel-cutover-20261014';
const expected=JSON.parse(await fs.readFile('artifacts/cloudflare-car-deploy-20261014/preflight.json','utf8'));
const base='https://racing.mumuworld.com/';
const report={checkedAt:new Date().toISOString(),base,gitCommit:'1ef0c2472a871552331e7792e5a6e8033c99e9a4',deploymentId:'dpl_7W4e1KMBeYcMChDVETFnYpZ1Mubf',files:[],routes:[]};
try{report.localDns=await dns.lookup('racing.mumuworld.com',{all:true});}catch(e){report.localDnsError=e.code;}
const items=expected.files.filter(f=>f.path!=='release.json');
for(let i=0;i<items.length;i+=4){
 const rows=await Promise.all(items.slice(i,i+4).map(async f=>{
  try{const r=await fetch(new URL(f.path,base),{signal:AbortSignal.timeout(30000)}),bytes=Buffer.from(await r.arrayBuffer());const sha256=crypto.createHash('sha256').update(bytes).digest('hex');return {path:f.path,status:r.status,bytes:bytes.length,sha256,match:r.status===200&&bytes.length===f.bytes&&sha256===f.sha256};}
  catch(e){return {path:f.path,error:e.cause?.code??e.name,match:false};}
 }));report.files.push(...rows);
}
for(const track of ['coastal','namak','yeosu','seongsamjae']){
 try{const r=await fetch(base+'?track='+track,{signal:AbortSignal.timeout(15000)}),html=await r.text();report.routes.push({track,status:r.status,title:html.match(/<title>(.*?)<\/title>/)?.[1]??null,contentType:r.headers.get('content-type')});}catch(e){report.routes.push({track,error:e.cause?.code??e.name});}
}
for(const [name,url] of [['missingModel',base+'assets/rebuild/cutover-nonexistent.glb'],['oldDefault','https://mumu-circuit.reinhardt7177.workers.dev/'],['vercelAlias','https://mumu-racing.vercel.app/'],['releaseMarker',base+'release.json']]){
 try{const r=await fetch(url,{signal:AbortSignal.timeout(15000)});report[name]={status:r.status,contentType:r.headers.get('content-type'),server:r.headers.get('server'),url:r.url};}catch(e){report[name]={error:e.cause?.code??e.name};}
}
report.matched=report.files.filter(f=>f.match).length;report.total=items.length;report.bytes=report.files.filter(f=>f.match).reduce((s,f)=>s+f.bytes,0);
await fs.writeFile(dir+'/public-verification.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({matched:report.matched,total:report.total,bytes:report.bytes,localDns:report.localDns,routes:report.routes,missingModel:report.missingModel,oldDefault:report.oldDefault,vercelAlias:report.vercelAlias,releaseMarker:report.releaseMarker},null,2));
if(report.matched!==report.total||report.routes.some(r=>r.status!==200)||report.missingModel.status!==404)process.exitCode=1;
