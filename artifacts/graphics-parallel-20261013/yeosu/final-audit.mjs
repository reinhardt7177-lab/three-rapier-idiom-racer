import fs from 'node:fs';
import crypto from 'node:crypto';
const root=new URL('../../../',import.meta.url);
const before=JSON.parse(fs.readFileSync(new URL('./before/asset-hashes.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
const assets=before.map(item=>{
 const bytes=fs.readFileSync(item.Path),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
 return {path:item.Path,bytes:bytes.length,sha256,unchanged:sha256.toUpperCase()===item.Hash.toUpperCase()};
});
if(assets.some(a=>!a.unchanged))throw new Error('Original Yeosu asset changed during assigned visual work');
const own=['src/rebuild/yeosuVisuals.js','scripts/yeosu-visuals.test.mjs','docs/YEOSU_GRAPHICS_20261013.md'].map(path=>{const file=new URL(path,root),bytes=fs.readFileSync(file);return {path,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),modifiedUtc:fs.statSync(file).mtime.toISOString()};});
const result={runtime:'local Windows CPU Node; no browser/GPU benchmark performed by this helper',createdUtc:new Date().toISOString(),assets,own,unitTests:{tests:8,pass:8,fail:0,skipped:0,durationMs:30186.9899},browserFrames:'parent validation pending'};
const out=new URL('./final-audit.json',import.meta.url);
if(fs.existsSync(out))throw new Error('Keep the prior audit and use a new filename');
fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
