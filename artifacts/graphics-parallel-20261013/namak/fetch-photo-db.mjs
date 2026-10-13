import fs from 'node:fs';
const base=new URL('./',import.meta.url),url='https://www.muan.go.kr/photo';
try{
 const r=await fetch(url,{signal:AbortSignal.timeout(15000)}),html=await r.text();
 fs.writeFileSync(new URL('muan-photo-db.html',base),html);
 const matches=[...html.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/g)].map(m=>new URL(m[1].replaceAll('&amp;','&'),url).href);
 const report={url,status:r.status,bytes:Buffer.byteLength(html),links:[...new Set(matches.filter(u=>u.startsWith('https://www.muan.go.kr/photo')&&!u.endsWith('#')&&!u.endsWith('css')))]};
 fs.writeFileSync(new URL('muan-photo-db.json',base),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){fs.writeFileSync(new URL('muan-photo-db.json',base),JSON.stringify({url,error:String(error)},null,2));console.log(String(error));}
