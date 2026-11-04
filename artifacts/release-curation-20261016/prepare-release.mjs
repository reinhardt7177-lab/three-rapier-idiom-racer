import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),task='artifacts/release-curation-20261016';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const runtime=tracked.filter(p=>/^(src\/|public\/|assets-sources\/|scripts\/|package(?:-lock)?\.json$|vite\.config)/.test(p));
const protectedFiles=[];
for(const p of runtime){try{const stat=await fs.lstat(p);if(stat.isFile())protectedFiles.push({path:p,bytes:stat.size,sha256:sha(await fs.readFile(p))});}catch(error){if(error.code!=='ENOENT')throw error;}}
await fs.writeFile(`${task}/product-before.json`,JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files:protectedFiles},null,2));
for(const p of ['README.md','.gitignore','docs/NEXT_STEPS.md']){const to=`${task}/before/${p}`;await fs.mkdir(path.dirname(to),{recursive:true});await fs.copyFile(p,to);}
const inv=JSON.parse(await fs.readFile(`${task}/inventory.json`,'utf8'));
const removable=[];
for(const f of inv.files){
 if(!f.untracked||f.image||!f.path.startsWith('artifacts/'))continue;
 const oldCopy=/(?:^|\/)(?:before(?:-[^/]+)?|[^/]*-before|baseline|qa-source|quality-baseline|rain-baseline)(?:\/)/.test(f.path)&&/\.(?:mjs|js|jsx|css|py|blend|glb|wasm)$/.test(f.path);
 const inputBundle=/\/(?:compute-input\.(?:zip|b64)|colab-(?:check-)?input\.(?:gz|b64)|check-(?:input\.gz|payload\.b64)|mumu-yeosu-patch(?:-1)?\.zip)$/.test(f.path);
 if(oldCopy||inputBundle){try{const s=await fs.lstat(f.path);if(s.isSymbolicLink()||!s.isFile())throw Error('Not a regular file');removable.push({path:f.path,bytes:s.size,sha256:sha(await fs.readFile(f.path)),reason:oldCopy?'superseded working copy':'completed compute input bundle'});}catch(e){if(e.code!=='ENOENT')throw e;}}
}
await fs.writeFile(`${task}/temp-removal-plan.json`,JSON.stringify({files:removable},null,2));
console.log(JSON.stringify({protected:protectedFiles.length,remove:removable.length,removeBytes:removable.reduce((n,f)=>n+f.bytes,0)}));
