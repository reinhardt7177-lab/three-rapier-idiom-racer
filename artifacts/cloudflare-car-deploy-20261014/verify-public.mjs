import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const directory='artifacts/cloudflare-car-deploy-20261014',expected=JSON.parse(fs.readFileSync(`${directory}/preflight.json`)),origin=process.argv[2]??'https://racing.mumuworld.com';
assert.ok(['https://racing.mumuworld.com','https://mumu-circuit.reinhardt7177.workers.dev'].includes(origin));
const output=origin.includes('workers.dev')?'public-assets-worker.json':'public-assets.json';
const results=[];let cursor=0;
await Promise.all(Array.from({length:4},async()=>{
 while(cursor<expected.files.length){const file=expected.files[cursor++];try{
  const response=await fetch(`${origin}/${file.path}`,{signal:AbortSignal.timeout(90000)}),data=Buffer.from(await response.arrayBuffer()),sha256=crypto.createHash('sha256').update(data).digest('hex');
  results.push({path:file.path,status:response.status,type:response.headers.get('content-type'),cacheControl:response.headers.get('cache-control'),etag:response.headers.get('etag'),bytes:data.length,sha256,match:sha256===file.sha256,server:response.headers.get('server')});
 }catch(error){results.push({path:file.path,error:String(error),match:false});}
 fs.writeFileSync(`${directory}/${output}`,JSON.stringify({origin,checkedAt:new Date().toISOString(),results},null,2));
 }
}));
const entry=expected.files.find(f=>/^assets\/index-.*\.js$/.test(f.path));assert.ok(entry);
const routes=[];for(const track of ['coastal','namak','yeosu','seongsamjae']){const r=await fetch(`${origin}/?track=${track}`),html=await r.text();routes.push({track,status:r.status,entry:html.includes('/'+entry.path)});}
const absent=await fetch(`${origin}/assets/missing-car-deployment-verification.glb`);
const r=await fetch(`${origin}/release.json`),release=await r.json();
const report={origin,checkedAt:new Date().toISOString(),sourceCommit:release.sourceCommit,files:results.length,matched:results.filter(r=>r.status===200&&r.match).length,totalBytes:results.reduce((n,r)=>n+(r.bytes||0),0),routes,missingAssetStatus:absent.status,results};
fs.writeFileSync(`${directory}/${output}`,JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,results:undefined},null,2));
assert.ok(results.every(r=>r.status===200&&r.match),'Public assets must match exact deployment bytes');assert.ok(routes.every(r=>r.status===200&&r.entry));assert.equal(absent.status,404);assert.equal(release.sourceCommit,expected.release.sourceCommit);
