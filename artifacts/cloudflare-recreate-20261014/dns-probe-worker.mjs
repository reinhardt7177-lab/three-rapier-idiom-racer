import expected from './public-manifest.mjs';
const HOST='racing.mumuworld.com';
export default {async fetch(request){
 if(new URL(request.url).pathname==='/assets'){
  const results=[];let cursor=0;
  await Promise.all(Array.from({length:3},async()=>{
   while(cursor<expected.files.length){const file=expected.files[cursor++];try{
    const response=await fetch(`https://${HOST}/${file.path}`),data=await response.arrayBuffer();
    const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');
    results.push({path:file.path,status:response.status,bytes:data.byteLength,sha256,match:sha256===file.sha256});
   }catch(error){results.push({path:file.path,error:String(error),match:false});}}
  }));
  const entry=expected.files.find(f=>/^assets\/index-.*\.js$/.test(f.path)),routes=[];
  for(const track of ['coastal','namak','yeosu','seongsamjae']){const r=await fetch(`https://${HOST}/?track=${track}`);routes.push({track,status:r.status,entry:(await r.text()).includes('/'+entry.path)});}
  const missing=await fetch(`https://${HOST}/assets/missing-car-deployment-verification.glb`),r=await fetch(`https://${HOST}/release.json`),release=await r.json();
  const dns=[];for(const [provider,url] of [['cloudflare',`https://cloudflare-dns.com/dns-query?name=${HOST}&type=A`],['google',`https://dns.google/resolve?name=${HOST}&type=A`]]){try{const r=await fetch(url,{headers:{Accept:'application/dns-json'}}),body=await r.json();dns.push({provider,status:r.status,dnsStatus:body.Status,answers:body.Answer??[]});}catch(error){dns.push({provider,error:String(error)});}}
  return Response.json({host:HOST,location:'Cloudflare remote Wrangler preview',time:new Date().toISOString(),files:results.length,matched:results.filter(r=>r.status===200&&r.match).length,totalBytes:results.reduce((n,r)=>n+(r.bytes||0),0),routes,missingAssetStatus:missing.status,sourceCommit:release.sourceCommit,sourceMatch:release.sourceCommit===expected.release.sourceCommit,dns,results});
 }
 const answers=await Promise.all([
  ['cloudflare',`https://cloudflare-dns.com/dns-query?name=${HOST}&type=A`],
  ['google',`https://dns.google/resolve?name=${HOST}&type=A`]
 ].map(async([provider,url])=>{try{const r=await fetch(url,{headers:{Accept:'application/dns-json'}}),data=await r.json();return {provider,status:r.status,dnsStatus:data.Status,answers:data.Answer??[]};}catch(e){return {provider,error:String(e)};}}));
 let website;try{const r=await fetch(`https://${HOST}/release.json`);website={status:r.status,release:await r.json()};}catch(e){website={error:String(e)};}
 return Response.json({host:HOST,location:'Cloudflare remote Wrangler preview',time:new Date().toISOString(),answers,website});
}};
