// Read-only public DNS diagnostics. Does not change DNS, hosts or browser settings.
import dns from 'node:dns/promises';
import fs from 'node:fs';
const host='racing.mumuworld.com',results=[];
try {results.push({method:'OS lookup',answers:await dns.lookup(host,{all:true})});}
catch(error){results.push({method:'OS lookup',error:error.code});}
await Promise.all(['1.1.1.1','8.8.8.8'].map(async server=>{
 const resolver=new dns.Resolver({timeout:3000,tries:1});resolver.setServers([server]);
 try{results.push({method:'Node c-ares DNS query',server,answers:await resolver.resolve4(host,{ttl:true})});}
 catch(error){results.push({method:'Node c-ares DNS query',server,error:error.code});}
}));
for(const url of ['https://racing.mumuworld.com/release.json','https://mumu-circuit.reinhardt7177.workers.dev/release.json','https://dns.google/resolve?name=racing.mumuworld.com&type=A']){
 try{const r=await fetch(url,{signal:AbortSignal.timeout(10000)});const body=await r.json();results.push({url,status:r.status,sourceCommit:body.sourceCommit??null,answers:body.Answer??null});}
 catch(error){results.push({url,error:error.cause?.code??String(error),address:error.cause?.address??null});}
}
const report={checkedAt:new Date().toISOString(),host,results};
fs.writeFileSync('artifacts/chrome-access-20261014/dns-path-probe.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
