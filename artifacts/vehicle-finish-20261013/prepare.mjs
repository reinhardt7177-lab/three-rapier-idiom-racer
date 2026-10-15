import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),dir=path.join(root,'artifacts/vehicle-finish-20261013');
const ids=['supra','slk','mustang','porsche911','gtr','rx7','m3','huracan'];
const paths=['src/rebuild/surfacePolish.js','src/rebuild/assets.js','src/rebuild/runtime.js','package.json','docs/NEXT_STEPS.md',...ids.flatMap(id=>[`assets-sources/vehicles-v6/${id}.blend`,`public/assets/rebuild/${id}.glb`])];
const protectedFiles=['src/driving/physics.js','src/driving/activeRide.js','src/rebuild/vehicleDynamics.js','src/rebuild/fleet.js','src/rebuild/vehiclePose.js','src/rebuild/bodyMotion.js','src/rebuild/tracks.js','src/rebuild/raceRecords.js','src/rebuild/onlineProtocol.js'];
const entry=p=>{const f=path.join(root,p),s=fs.statSync(f);return {path:p,bytes:s.size,modified:s.mtime.toISOString(),hash:crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')};};
fs.mkdirSync(dir,{recursive:true});
for(const p of paths){const dest=path.join(dir,'before',p);if(fs.existsSync(dest))throw Error(`Backup exists: ${p}`);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,p),dest);}
fs.writeFileSync(path.join(dir,'before-manifest.json'),JSON.stringify({time:new Date().toISOString(),branch:execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files:paths.map(entry),protected:protectedFiles.filter(p=>fs.existsSync(p)).map(entry),foreign:execFileSync('git',['status','--short','--untracked-files=no'],{encoding:'utf8'})},null,2));
// Frozen material module and independent local game entry for A/B/A.
fs.copyFileSync(path.join(root,'src/rebuild/surfacePolish.js'),path.join(dir,'baseline-surface.js'));
let assets=fs.readFileSync(path.join(root,'src/rebuild/assets.js'),'utf8').replace(/from '\.\/([^']+)'/g,(_m,p)=>`from '/src/rebuild/${p}'`).replace(/from '\.\.\/([^']+)'/g,(_m,p)=>`from '/src/${p}'`).replace("from '/src/rebuild/surfacePolish.js'","from './baseline-surface.js'");
assets=assets.replace('`${import.meta.env.BASE_URL}assets/rebuild/${id}.glb`','`${import.meta.env.BASE_URL}artifacts/vehicle-finish-20261013/before/public/assets/rebuild/${id}.glb`');
fs.writeFileSync(path.join(dir,'baseline-assets.js'),assets);
let runtime=fs.readFileSync(path.join(root,'src/rebuild/runtime.js'),'utf8').replace(/from '\.\/([^']+)'/g,(_m,p)=>`from '/src/rebuild/${p}'`).replace(/from '\.\.\/([^']+)'/g,(_m,p)=>`from '/src/${p}'`).replace("from '/src/rebuild/assets.js'","from './baseline-assets.js'");
fs.writeFileSync(path.join(dir,'baseline-runtime.js'),runtime);
for(const version of ['baseline','current']){
 let main=fs.readFileSync(path.join(root,'artifacts/roadscape-20261013/current-main.jsx'),'utf8');
 if(version==='baseline')main=main.replace("from '/src/rebuild/runtime.js'","from './baseline-runtime.js'");
 fs.writeFileSync(path.join(dir,`${version}-main.jsx`),main);
 fs.writeFileSync(path.join(dir,`${version}-game.html`),`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><div id="root"></div><script type="module" src="./${version}-main.jsx"></script><script type="module" src="./qa-monitor.js"></script></html>`);
}
fs.copyFileSync(path.join(root,'artifacts/roadscape-20261013/qa-monitor.js'),path.join(dir,'qa-monitor.js'));
console.log('Backups and frozen baseline saved',paths.length);
