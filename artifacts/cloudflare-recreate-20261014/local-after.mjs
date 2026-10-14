import dns from 'node:dns/promises';
import fs from 'node:fs';
const host='racing.mumuworld.com',report={checkedAt:new Date().toISOString(),host};
try{report.lookup=await dns.lookup(host,{all:true});}catch(error){report.lookupError=error.code;}
report.requests=await Promise.all(['https://racing.mumuworld.com/release.json','https://mumu-circuit.reinhardt7177.workers.dev/release.json'].map(async url=>{
 try{const r=await fetch(url,{signal:AbortSignal.timeout(15000)}),body=await r.json();return {url,status:r.status,sourceCommit:body.sourceCommit};}
 catch(error){return {url,error:error.cause?.code??String(error),address:error.cause?.address??null};}
}));
fs.writeFileSync('artifacts/cloudflare-recreate-20261014/local-after.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
