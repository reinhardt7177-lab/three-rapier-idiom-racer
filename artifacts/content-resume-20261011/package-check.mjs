import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import zlib from 'node:zlib';
const root=process.cwd(),out='artifacts/content-resume-20261011',sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const previous=JSON.parse(fs.readFileSync('artifacts/ghost-pass-20261011/check-input-hashes.json','utf8').replace(/^\uFEFF/,''));
const names=new Set(Object.keys(previous));
for(const dir of ['src','scripts'])for(const item of fs.readdirSync(dir,{recursive:true}))if(/\.(js|jsx|css|mjs|py)$/.test(item))names.add((dir+'/'+item).replaceAll('\\','/'));
for(const p of ['package.json','package-lock.json','vite.config.js','index.html','vercel.json'])names.add(p);
const hashes={},patch=[];
for(const p of names){const b=fs.readFileSync(path.join(root,p));hashes[p]=sha(b);if(previous[p]!==hashes[p])patch.push({path:p,data:b.toString('base64'),sha:hashes[p]});}
fs.writeFileSync(out+'/input-hashes.json',JSON.stringify(hashes,null,2));
const payload=zlib.gzipSync(Buffer.from(JSON.stringify({hashes,patch})));fs.writeFileSync(out+'/check-payload.b64',payload.toString('base64'));console.log(JSON.stringify({files:names.size,patch:patch.length,payloadBytes:payload.length,sha:sha(payload)}));
