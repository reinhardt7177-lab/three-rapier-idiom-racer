import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const base=process.argv[2]||'https://racing.mumuworld.com/';
const source='85a34eaff55417b6b7e14ff5133868c5aa851c14';
const preflight=JSON.parse(fs.readFileSync(new URL('preflight.json',import.meta.url),'utf8'));
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const rows=[];let cursor=0;
async function asset(file){
 const url=new URL(file.path,base);url.searchParams.set('deploy',source.slice(0,7));
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)}),data=Buffer.from(await response.arrayBuffer());
  const hash=sha(data),local=fs.readFileSync(path.join('dist',file.path));
  const textOnly=/\.(?:html|json|txt)$/.test(file.path);
  const normalized=textOnly&&data.toString('utf8').replaceAll('\r\n','\n')===local.toString('utf8').replaceAll('\r\n','\n');
  rows.push({path:file.path,status:response.status,bytes:data.length,sha256:hash,exact:hash===file.sha256,lineEndingsOnly:hash!==file.sha256&&normalized,etag:response.headers.get('etag'),cache:response.headers.get('x-vercel-cache')});
 }catch(error){rows.push({path:file.path,error:error.message});}
}
await Promise.all(Array.from({length:3},async()=>{while(cursor<preflight.build.length)await asset(preflight.build[cursor++]);}));
const courses=[];
for(const track of ['coastal','namak','yeosu','seongsamjae']){
 try{const response=await fetch(`${base}?track=${track}&v=${source.slice(0,7)}`,{signal:AbortSignal.timeout(15000)}),html=await response.text();courses.push({track,status:response.status,scripts:[...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+\.(?:js|css))"/g)].map(m=>m[1])});}
 catch(error){courses.push({track,error:error.message});}
}
let missing;
try{const r=await fetch(`${base}assets/rebuild/does-not-exist-mobile-release.glb`,{signal:AbortSignal.timeout(15000)});missing=r.status;await r.arrayBuffer();}catch(error){missing=error.message;}
const result={at:new Date().toISOString(),base,source,files:rows.length,exact:rows.filter(r=>r.status===200&&r.exact).length,lineEndingsOnly:rows.filter(r=>r.status===200&&r.lineEndingsOnly).length,failures:rows.filter(r=>r.status!==200||!r.exact&&!r.lineEndingsOnly),bytes:rows.reduce((n,r)=>n+(r.bytes||0),0),rows,courses,missing};
fs.writeFileSync(new URL(process.argv[3]||'public-assets.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({files:result.files,exact:result.exact,lineEndingsOnly:result.lineEndingsOnly,bytes:result.bytes,failures:result.failures,courses,missing}));
if(result.failures.length||courses.some(r=>r.status!==200)||missing!==404)process.exitCode=1;
