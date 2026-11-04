import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const dir='artifacts/roadscape-20261013';
const files=['src/rebuild/assets.js','src/rebuild/runtime.js','src/rebuild/tracks.js','package.json','docs/NEXT_STEPS.md'];
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const rows=[];
for(const file of files){const data=fs.readFileSync(file),out=path.join(dir,'before',file);fs.mkdirSync(path.dirname(out),{recursive:true});if(!fs.existsSync(out))fs.writeFileSync(out,data);rows.push({file,sha256:sha(data),bytes:data.length,mtime:fs.statSync(file).mtime.toISOString()});}
const prior=JSON.parse(fs.readFileSync('artifacts/release-repair-20261012/graphics-check-inputs.json'));
const unchanged=prior.filter(f=>sha(fs.readFileSync(f.path))!==f.sha256);
fs.writeFileSync(dir+'/start.json',JSON.stringify({time:new Date().toISOString(),files:rows,priorCheckInputs:prior,changedSincePrior:unchanged,scope:'Blender roadscape extensions from documented map/photo references; preserve validated asphalt, route, collision, dynamics and saved progression.'},null,2));
console.log({backups:rows.length,priorInputs:prior.length,externalChanges:unchanged.map(f=>f.path)});
