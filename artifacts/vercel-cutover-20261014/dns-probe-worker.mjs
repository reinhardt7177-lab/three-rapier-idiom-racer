// Ephemeral remote preview: public destination checks only, no persistent route.
import expected from './public-manifest.mjs';
const HOST='racing.mumuworld.com';
export default {async fetch(){
 const results=[];let cursor=0;
 await Promise.all(Array.from({length:3},async()=>{
  while(cursor<expected.files.length){const f=expected.files[cursor++];try{
   const r=await fetch(`https://${HOST}/${f.path}`),bytes=await r.arrayBuffer();
   const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
   results.push({path:f.path,status:r.status,bytes:bytes.byteLength,sha256,match:r.status===200&&bytes.byteLength===f.bytes&&sha256===f.sha256});
  }catch(e){results.push({path:f.path,error:e.name,match:false});}}
 }));
 const entry=expected.files.find(f=>/^assets\/index-.*\.js$/.test(f.path)),routes=[];
 for(const track of ['coastal','namak','yeosu','seongsamjae']){const r=await fetch(`https://${HOST}/?track=${track}`);routes.push({track,status:r.status,entry:(await r.text()).includes('/'+entry.path)});}
 const missing=await fetch(`https://${HOST}/assets/rebuild/cutover-nonexistent.glb`);
 const dns=[];for(const [provider,url] of [['cloudflare',`https://cloudflare-dns.com/dns-query?name=${HOST}&type=A`],['google',`https://dns.google/resolve?name=${HOST}&type=A`]]){try{const r=await fetch(url,{headers:{Accept:'application/dns-json'}}),body=await r.json();dns.push({provider,status:r.status,dnsStatus:body.Status,answers:body.Answer??[]});}catch(e){dns.push({provider,error:e.name});}}
 const marker=await fetch(`https://${HOST}/release.json`);
 const old=await fetch('https://mumu-circuit.reinhardt7177.workers.dev/');
 const sourceMatch=results.filter(r=>r.match).length===expected.files.length;
 return Response.json({host:HOST,location:'Cloudflare ephemeral remote Wrangler preview, public Vercel destination',time:new Date().toISOString(),files:results.length,matched:results.filter(r=>r.match).length,totalBytes:results.reduce((n,r)=>n+(r.bytes||0),0),routes,missingAssetStatus:missing.status,sourceMatch,releaseMarkerStatus:marker.status,oldDefaultStatus:old.status,dns,results});
}};
