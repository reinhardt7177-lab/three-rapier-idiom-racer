import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=process.cwd(),task=path.join(root,'artifacts/lag-fix-20261016');
const backup=path.resolve(root,'../.work/lag-fix-20261016/test-outputs-before');
const sha=b=>createHash('sha256').update(b).digest('hex');
const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const reports=tracked.filter(p=>p.startsWith('artifacts/')&&/\.(json|txt|log|md|csv)$/.test(p));
const prior=JSON.parse(fs.readFileSync('artifacts/ai-impact-20261016/final-inputs.json'));
const inputs=[...new Set([...prior.map(x=>x.path),'scripts/physics-sampling.test.mjs'])];
const mode=process.argv[2];
if(mode==='before'){
 for(const rel of reports){const dst=path.join(backup,rel);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(rel,dst);}
 const manifest=inputs.map(p=>({path:p,sha256:sha(fs.readFileSync(p))}));
 fs.writeFileSync(path.join(task,'check-inputs.json'),JSON.stringify(manifest,null,2));
 fs.writeFileSync(path.join(task,'check-reports.json'),JSON.stringify(reports,null,2));
 console.log(JSON.stringify({inputs:manifest.length,savedReports:reports.length}));
}else if(mode==='after'){
 const manifest=JSON.parse(fs.readFileSync(path.join(task,'check-inputs.json'))),changedInputs=manifest.filter(p=>sha(fs.readFileSync(p.path))!==p.sha256);
 const saved=JSON.parse(fs.readFileSync(path.join(task,'check-reports.json'))),changed=[];
 for(const rel of saved){const before=fs.readFileSync(path.join(backup,rel)),after=fs.readFileSync(rel);
  if(sha(before)===sha(after))continue;
  const dst=path.join(task,'generated-results',rel);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.writeFileSync(dst,after);fs.writeFileSync(rel,before);
  changed.push({path:rel,bytes:after.length,sha256:sha(after),restoredSha256:sha(fs.readFileSync(rel))});
 }
 const report={executedAt:new Date().toISOString(),execution:'Local Windows Node CPU / Rapier WASM. No Colab.',inputCount:manifest.length,changedInputs,changedReports:changed};
 fs.writeFileSync(path.join(task,'check-preservation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 if(changedInputs.length)process.exitCode=1;
}else throw Error('Specify before or after');
