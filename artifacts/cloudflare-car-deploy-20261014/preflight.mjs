import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),dir=path.join(root,'artifacts/cloudflare-car-deploy-20261014'),source=path.join(dir,'build-source');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const inputs=JSON.parse(fs.readFileSync('artifacts/vehicle-finish-20261013/vertex-check-inputs.json'));
const liveChanges=inputs.filter(i=>hash(fs.readFileSync(i.path))!==i.sha256);
assert.equal(liveChanges.length,0,'Full-check input changed since validation');
const text=p=>/\.(js|jsx|mjs|json|css|html|py|ps1)$/.test(p);
const canonical=(p,b)=>text(p)?Buffer.from(b.toString('utf8').replace(/\r\n/g,'\n')):b;
const differences=[],nonRuntimeLocalInputs=[];
const tracked=new Set(execFileSync('git',['ls-tree','-r','--name-only','4359d7dee328e94b6dc2c11d2e278bbaf6167043']).toString().trim().split('\n'));
for(const i of inputs){const normalized=i.path.replaceAll('\\','/'),target=path.join(source,i.path);if(!fs.existsSync(target)){
 if(!tracked.has(normalized)&&!normalized.startsWith('src/')&&!normalized.startsWith('public/')){nonRuntimeLocalInputs.push({path:i.path,reason:'Untracked local authoring/helper/cache file, not a product input or source commit file.'});continue;}
 differences.push({path:i.path,kind:'not in committed source'});continue;
}if(hash(canonical(i.path,fs.readFileSync(target)))!==hash(canonical(i.path,fs.readFileSync(i.path))))differences.push({path:i.path,kind:'different from shared validation tree'});}
const allowed=new Set(['package.json','src/rebuild/assets.js','src/rebuild/namakVisuals.js','src/rebuild/namakArchitecture.js','scripts/namak-architecture.test.mjs','public/assets/rebuild/namak-architecture.glb']);
assert.ok(differences.every(d=>allowed.has(d.path.replaceAll('\\','/'))),'Unexpected source difference: '+JSON.stringify(differences));
const commit=JSON.parse(fs.readFileSync(path.join(dir,'source-snapshot.json'))).commit;
const release={sourceCommit:commit,vehicleCommit:'8a79d5d',roadscapeCommit:'437b2c2',builtAt:new Date().toISOString(),host:'racing.mumuworld.com'};
const dist=path.join(source,'dist');fs.writeFileSync(path.join(dist,'release.json'),JSON.stringify(release,null,2));
function scan(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>{const f=path.join(p,e.name);if(e.isDirectory())return scan(f);assert.ok(e.isFile(),'No deployment symlinks');const relative=path.relative(dist,f).replaceAll('\\','/');assert.ok(!/(^|\/)(\.|artifacts|node_modules)|\.(key|blend|map)$|\.env/i.test(relative),'Private/development file in dist');const b=fs.readFileSync(f);assert.ok(b.length<=25*1024*1024,'Cloudflare asset limit: '+relative);return [{path:relative,bytes:b.length,sha256:hash(b)}];});}
const files=scan(dist);assert.equal(files.filter(f=>f.path.endsWith('.glb')).length>=14,true);
const report={release,fullCheck:{tests:428,inputs:inputs.length,liveChanges,execution:'Prior local Windows CPU / Rapier WASM'},committedDifferences:differences,nonRuntimeLocalInputs,explanation:'Only separately authored uncommitted Namak architecture layer and its test registration excluded. Vehicle/runtime/physics/route/balance inputs match the validated tree, normalizing text line endings for archive comparison. Untracked non-product helpers/caches are enumerated, not deployed. Fresh focused visual tests and production build run in this committed snapshot.',files,totalBytes:files.reduce((s,f)=>s+f.bytes,0),largest:files.reduce((a,b)=>a.bytes>b.bytes?a:b)};
fs.writeFileSync(path.join(dir,'preflight.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({commit,inputs:inputs.length,differences,files:files.length,totalBytes:report.totalBytes,largest:report.largest},null,2));
