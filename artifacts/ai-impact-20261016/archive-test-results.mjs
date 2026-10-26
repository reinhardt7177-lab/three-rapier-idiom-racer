import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=process.cwd(),backup=path.resolve(root,'../.work/ai-impact-20261016/test-outputs-before');
const task=path.join(root,'artifacts/ai-impact-20261016');
const sha=b=>createHash('sha256').update(b).digest('hex');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const changed=[];
for(const oldPath of files(backup)){
 const rel=path.relative(backup,oldPath),target=path.resolve(root,rel);
 if(!target.startsWith(root+path.sep)||!rel.startsWith('artifacts'+path.sep))throw Error(`outside saved reports: ${rel}`);
 const before=fs.readFileSync(oldPath),after=fs.readFileSync(target);
 if(sha(before)!==sha(after)){
  const output=path.join(task,'generated-results',rel);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,after);
  fs.writeFileSync(target,before);if(sha(fs.readFileSync(target))!==sha(before))throw Error(`restore mismatch: ${rel}`);
  changed.push({path:rel.replaceAll('\\','/'),previousSha:sha(before),newSha:sha(after),bytes:after.length});
 }
}
const report={executedAt:new Date().toISOString(),execution:'Local Windows CPU / Node 24.12.0 / Rapier WASM. Legacy device labels in raw tests are not runtime detection; no Colab was used.',checked:files(backup).length,changed};
fs.writeFileSync(path.join(task,'generated-results-manifest.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checked:report.checked,preservedNewAndRestoredOld:changed.length}));
