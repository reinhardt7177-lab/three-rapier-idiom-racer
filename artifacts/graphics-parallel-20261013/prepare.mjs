import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const dir='artifacts/graphics-parallel-20261013';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const files=['src/rebuild/runtime.js','src/rebuild/worldRendering.js','src/rebuild/surfacePolish.js','src/rebuild/graphicsQuality.js','src/rebuild/namakColors.js','src/rebuild/koreaPresentation.js','src/rebuild/nightPresentation.js','src/driving/physics.js','src/rebuild/activeRide.js','src/rebuild/vehicleDynamics.js','src/driving/steering.js','package.json','scripts/world-rendering.test.mjs'];
const entries=[];
for(const file of files){const bytes=fs.readFileSync(file),target=path.join(dir,'before',file);fs.mkdirSync(path.dirname(target),{recursive:true});if(fs.existsSync(target))throw Error(`Refusing to replace backup ${target}`);fs.writeFileSync(target,bytes);entries.push({path:file,sha256:sha(bytes),bytes:bytes.length,mtime:fs.statSync(file).mtime.toISOString()});}
const assets=[];
for(const name of fs.readdirSync('public/assets/rebuild')){const p=`public/assets/rebuild/${name}`;if(fs.statSync(p).isFile())assets.push({path:p,sha256:sha(fs.readFileSync(p)),bytes:fs.statSync(p).size});}
const branch=execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim();
fs.writeFileSync(path.join(dir,'start.json'),JSON.stringify({started:new Date().toISOString(),branch,files:entries,assets,scope:'Map visual modules, static rendering cost; preserve physics, route, collision, saved progress. Parallel agents have separate files. No publication.'},null,2));
console.log(JSON.stringify({branch,backups:entries.length,assets:assets.length},null,2));
