import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const dir='artifacts/vehicle-polish-3pass-20261015';
const ids=['supra','slk','mustang','porsche911','gtr','rx7','m3','huracan'];
const files=['src/rebuild/surfacePolish.js','src/rebuild/vehicleStudio.js','src/rebuild/assets.js','src/rebuild/runtime.js','src/rebuild/main.jsx','package.json','docs/NEXT_STEPS.md',...ids.flatMap(id=>[`assets-sources/vehicles-v6/${id}.blend`,`public/assets/rebuild/${id}.glb`])].filter(p=>fs.existsSync(p));
const protectedFiles=['src/driving/physics.js','src/driving/activeRide.js','src/rebuild/vehicleDynamics.js','src/rebuild/fleet.js','src/rebuild/vehiclePose.js','src/rebuild/bodyMotion.js','src/rebuild/tracks.js','src/rebuild/raceRecords.js','src/rebuild/onlineProtocol.js'];
const entry=p=>({path:p,bytes:fs.statSync(p).size,mtime:fs.statSync(p).mtime.toISOString(),sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')});
if(fs.existsSync(dir+'/before-manifest.json'))throw Error('Backup already exists');
for(const p of files){const dest=path.join(dir,'before',p);fs.mkdirSync(path.dirname(dest),{recursive:true});if(fs.existsSync(dest)){if(!fs.readFileSync(p).equals(fs.readFileSync(dest)))throw Error('Existing snapshot differs: '+p);}else fs.copyFileSync(p,dest);}
fs.writeFileSync(dir+'/before-manifest.json',JSON.stringify({time:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),foreign:execFileSync('git',['status','--short','--untracked-files=no'],{encoding:'utf8'}),files:files.map(entry),protected:protectedFiles.filter(p=>fs.existsSync(p)).map(entry)},null,2));
for(const name of ['inspection.html','inspection.js']){
 let s=fs.readFileSync('artifacts/vehicle-finish-20261013/'+name,'utf8').replaceAll('vehicle-finish-20261013','vehicle-polish-3pass-20261015');
 if(name.endsWith('.js'))s=s.replace("const pmrem=new T.PMREMGenerator(renderer),room=target==='before'?new RoomEnvironment():createVehicleStudio()","const pmrem=new T.PMREMGenerator(renderer),room=target==='before'?oldStudio():createVehicleStudio()").replace("import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';","import {createVehicleStudio as oldStudio} from './baseline-studio.js';");
 fs.writeFileSync(dir+'/'+name,s);
}
fs.copyFileSync('src/rebuild/surfacePolish.js',dir+'/baseline-surface.js');fs.copyFileSync('src/rebuild/vehicleStudio.js',dir+'/baseline-studio.js');
let assets=fs.readFileSync('src/rebuild/assets.js','utf8').replace(/from '\.\/([^']+)'/g,(_m,p)=>`from '/src/rebuild/${p}'`).replace(/from '\.\.\/([^']+)'/g,(_m,p)=>`from '/src/${p}'`).replace("from '/src/rebuild/surfacePolish.js'","from './baseline-surface.js'");
fs.writeFileSync(dir+'/baseline-assets.js',assets);
console.log('Saved baseline and preserved foreign files: '+files.length);
