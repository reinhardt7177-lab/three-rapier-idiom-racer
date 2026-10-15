import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const directory = 'artifacts/cloudflare-deploy-20261013';
const expected = JSON.parse(fs.readFileSync(`${directory}/preflight.json`));
const origin = 'https://racing.mumuworld.com';
const results = [];
for (const file of expected.files) {
  try {
    const response = await fetch(`${origin}/${file.path}`, {signal:AbortSignal.timeout(90000)});
    const data = Buffer.from(await response.arrayBuffer());
    const sha256 = crypto.createHash('sha256').update(data).digest('hex');
    results.push({path:file.path,status:response.status,type:response.headers.get('content-type'),bytes:data.length,
      sha256,match:sha256===file.sha256,server:response.headers.get('server')});
  } catch (error) { results.push({path:file.path,error:String(error),match:false}); }
  fs.writeFileSync(`${directory}/public-assets.json`,JSON.stringify({origin,checkedAt:new Date().toISOString(),results},null,2));
}
const routes = [];
for (const track of ['coastal','namak','yeosu','seongsamjae']) {
  const response = await fetch(`${origin}/?track=${track}`);
  const html = await response.text();
  routes.push({track,status:response.status,entry:html.includes('/assets/index-CuALlwKA.js')});
}
const absent = await fetch(`${origin}/assets/missing-deployment-verification.glb`);
const report = {origin,checkedAt:new Date().toISOString(),files:results.length,
  matched:results.filter(r=>r.status===200&&r.match).length,totalBytes:results.reduce((n,r)=>n+(r.bytes||0),0),
  routes,missingAssetStatus:absent.status,results};
fs.writeFileSync(`${directory}/public-assets.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({origin,files:report.files,matched:report.matched,totalBytes:report.totalBytes,routes,missingAssetStatus:report.missingAssetStatus},null,2));
assert.ok(results.every(r=>r.status===200&&r.match), 'Public assets must match the exact deployment bytes');
assert.ok(routes.every(r=>r.status===200&&r.entry));
assert.equal(absent.status,404,'Absent models must not return HTML');
