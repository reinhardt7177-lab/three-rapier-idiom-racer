import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const repo=new URL('../../../',import.meta.url),base=new URL('./',import.meta.url),before=new URL('./before/',import.meta.url);
fs.mkdirSync(before,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const jobs=[
 {source:'namakVisuals.candidate.mjs',target:'src/rebuild/namakVisuals.js',transform:s=>s},
 {source:'namak-visuals.candidate.test.mjs',target:'scripts/namak-visuals.test.mjs',transform:s=>s.replace("from './namakVisuals.candidate.mjs'","from '../src/rebuild/namakVisuals.js'").replaceAll("from '../../../src/","from '../src/").replace("repo=new URL('../../../',import.meta.url)","repo=new URL('../',import.meta.url)")},
];
const created=new Date().toISOString(),manifest=[];
for(const job of jobs){
 const target=new URL(job.target,repo),source=new URL(job.source,base);
 if(fs.existsSync(target)){
  const b=fs.readFileSync(target),stat=fs.statSync(target);fs.writeFileSync(new URL(path.basename(job.target),before),b,{flag:'wx'});
  throw new Error(`Another editor created ${job.target}, copied it to before and stopped. Last write ${stat.mtime.toISOString()}, sha ${sha(b)}`);
 }
 manifest.push({target:job.target,before:'absent/new file',checkedAt:created,candidateSha:sha(fs.readFileSync(source)),candidateModified:fs.statSync(source).mtime.toISOString()});
}
const protectedAssets=['public/assets/rebuild/namak.glb','public/assets/rebuild/namak-route.json','assets-sources/namak/namak.blend','artifacts/namak-20261010/colliders.bin','artifacts/namak-20261010/colliders.json'];
const protectedHashes=protectedAssets.map(file=>{const p=new URL(file,repo),s=fs.statSync(p),b=fs.readFileSync(p);return {file,bytes:s.size,sha:sha(b),modified:s.mtime.toISOString()};});
fs.writeFileSync(new URL('manifest.json',before),JSON.stringify({created,manifest,protectedHashes},null,2),{flag:'wx'});
for(const job of jobs)fs.writeFileSync(new URL(job.target,repo),job.transform(fs.readFileSync(new URL(job.source,base),'utf8')),{flag:'wx'});
console.log(JSON.stringify({created,createdFiles:jobs.map(j=>j.target),protectedHashes},null,2));
