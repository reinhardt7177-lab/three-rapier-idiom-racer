import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const task=path.resolve('artifacts/vehicle-polish-3pass-20261015'),root=path.join(task,'validation-source');
const vite=path.resolve('node_modules/vite/bin/vite.js');
const results=[];
for(const [label,args] of [['before',['build','--config','artifacts/vehicle-polish-3pass-20261015/baseline-build.config.js']],['after',['build','--manifest']]]){
 const started=performance.now(),fd=fs.openSync(path.join(task,`${label}-payload-build.log`),'w');
 const r=spawnSync(process.execPath,[vite,...args],{cwd:root,stdio:['ignore',fd,fd],windowsHide:true});fs.closeSync(fd);
 results.push({label,exitCode:r.status,seconds:(performance.now()-started)/1000});if(r.status!==0)throw Error(`${label} build failed`);
}
const payload=[];
for(const label of ['before','after']){
 const dir=label==='before'?path.join(root,'artifacts/vehicle-polish-3pass-20261015/baseline-dist'):path.join(root,'dist');
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'.vite/manifest.json'),'utf8')),entry=Object.keys(manifest).find(k=>manifest[k].isEntry),seen=new Set(),files=new Set();
 function visit(key){if(seen.has(key))return;seen.add(key);const m=manifest[key];files.add(m.file);for(const css of m.css||[])files.add(css);for(const dep of m.imports||[])visit(dep);}
 visit(entry);const bundle=[...files].map(f=>({path:f,bytes:fs.statSync(path.join(dir,f)).size}));
 const assets=['supra','slk','mustang','porsche911','gtr','rx7','m3','huracan','garage','namak','cockpit','namak-landmarks'].map(id=>{const p=`public/assets/rebuild/${id}.glb`,car=['supra','slk','mustang','porsche911','gtr','rx7','m3','huracan'].includes(id);return {path:p,bytes:fs.statSync(label==='before'&&car?path.join(task,'before',p):path.join(root,p)).size};});
 for(const p of ['namak-route.json','draco/draco_wasm_wrapper.js','draco/draco_decoder.wasm'])assets.push({path:`public/assets/rebuild/${p}`,bytes:fs.statSync(path.join(root,'public/assets/rebuild',p)).size});
 payload.push({label,htmlBytes:fs.statSync(path.join(dir,'index.html')).size,bundle,assets,decodedRequiredBytes:[...bundle,...assets].reduce((s,r)=>s+r.bytes,0)+fs.statSync(path.join(dir,'index.html')).size,note:'Static uncompressed bytes needed for the Namak garage; excludes optional audio, online dynamic chunk, HTTP headers/compression/cache and browser loading time.'});
}
fs.writeFileSync(path.join(task,'initial-payload.json'),JSON.stringify({builds:results,payload},null,2));console.log(JSON.stringify({builds:results,bytes:payload.map(p=>({label:p.label,bytes:p.decodedRequiredBytes}))}));
