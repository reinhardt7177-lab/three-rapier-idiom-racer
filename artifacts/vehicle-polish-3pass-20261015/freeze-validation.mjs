import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),task=path.join(root,'artifacts/vehicle-polish-3pass-20261015');
const dest=path.join(task,'validation-source');
if(fs.existsSync(dest))throw Error('Refuse to overwrite an existing validation snapshot');
const roots=['src','scripts','public','artifacts','package.json','package-lock.json','vite.config.js','index.html','README.md','AGENTS.md'];
const names=execFileSync('git',['ls-files','--',...roots],{encoding:'utf8'}).trim().split('\n');
if(names.some(p=>/(^|\/)(\.env(?:\.|$)|\.meshy\.key$)|\.(?:pem|key)$/i.test(p)))throw Error('Sensitive-looking tracked path: archive not created');
fs.mkdirSync(dest,{recursive:true});
const archive=path.join(task,'validation-base.tar');
execFileSync('git',['archive','--format=tar',`--output=${archive}`,'HEAD',...roots],{maxBuffer:1024*1024});
execFileSync('tar',['-xf',archive,'-C',dest]);
// Some tests validate editable sources, not only browser exports. Include the
// actual checked-out files (an archived Git LFS pointer is not a Blender file).
const modelSources=['assets-sources/cockpit-v1/cockpit.blend','assets-sources/rebuilt-unity/world.blend','assets-sources/namak/namak.blend','assets-sources/namak/namak-landmarks.blend','assets-sources/seongsamjae/seongsamjae.blend','assets-sources/seongsamjae/roadscape.blend','assets-sources/yeosu/yeosu.blend','assets-sources/yeosu/map/selected-roads.json','assets-sources/yeosu/map/yeosu-osm-20261012.osm','assets-sources/yeosu/map/mapped-scenery.json',...['supra','slk','mustang','porsche911','gtr','rx7','m3','huracan'].map(id=>`assets-sources/vehicles-v6/${id}.blend`)];
const own=['src/rebuild/surfacePolish.js','src/rebuild/vehicleStudio.js','scripts/vehicle-finish.test.mjs','scripts/vehicle-rig.test.mjs','scripts/blender/polish_vehicle_reference.py',...['supra','slk','mustang','porsche911','gtr','rx7','m3','huracan'].map(id=>`public/assets/rebuild/${id}.glb`),'artifacts/vehicle-polish-3pass-20261015/pass3-blender.json','artifacts/vehicle-polish-3pass-20261015/before-manifest.json',...modelSources];
const hashes=[];
for(const p of own){const b=fs.readFileSync(p),out=path.join(dest,p);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,b);hashes.push({path:p,sha256:crypto.createHash('sha256').update(b).digest('hex')});}
fs.symlinkSync(path.join(root,'node_modules'),path.join(dest,'node_modules'),'junction');
fs.writeFileSync(path.join(task,'validation-snapshot.json'),JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),created:new Date().toISOString(),reason:'Car-only validation: concurrent driving / AI / Namak changes preserved in original folder, not rolled back or included.',files:hashes},null,2));
console.log(JSON.stringify({dest,overlays:hashes.length,trackedBaseFiles:names.length}));
