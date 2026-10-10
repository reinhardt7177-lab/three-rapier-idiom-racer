// Inventory the current entry point and regression suite before local cleanup.
// This file never deletes anything; cleanup uses checked native PowerShell paths.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),workspace=path.dirname(root);
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const tests=pkg.scripts['check:rebuild'].match(/scripts\/[\w-]+\.test\.mjs/g);
const keep=new Set();
function walkImports(file){
 file=path.resolve(file);if(keep.has(file))return;
 if(!fs.existsSync(file))throw new Error(`Missing dependency: ${file}`);
 keep.add(file);
 if(!/\.(js|jsx|mjs|css)$/.test(file))return;
 const source=fs.readFileSync(file,'utf8');
 for(const match of source.matchAll(/(?:from\s*|import\s*|import\s*\(\s*|@import\s*)['"]([^'"]+)['"]/g)){
  if(!match[1].startsWith('.'))continue;
  walkImports(path.resolve(path.dirname(file),match[1]));
 }
}
walkImports(path.join(root,'src/rebuild/main.jsx'));
tests.forEach(t=>walkImports(path.join(root,t)));
const removals=[];
function files(dir){
 if(!fs.existsSync(dir))return [];
 const stat=fs.lstatSync(dir);if(stat.isSymbolicLink())throw new Error(`Link rejected: ${dir}`);
 if(!stat.isDirectory())return [dir];
 return fs.readdirSync(dir).flatMap(n=>files(path.join(dir,n)));
}
function remove(file,reason){
 if(!fs.existsSync(file))return;
 if(!file.startsWith(workspace+path.sep)||file.split(path.sep).includes('.git'))throw new Error('Unsafe candidate');
 removals.push({path:file,bytes:fs.statSync(file).size,reason});
}
function prune(dir,reason,preserve=()=>false){files(dir).forEach(f=>{if(!preserve(f))remove(f,reason);});}
prune(path.join(root,'src'),'unreachable-source',f=>keep.has(f));
prune(path.join(root,'scripts'),'obsolete-tool-or-test',f=>keep.has(f)||['current-files.mjs','cleanup-current.ps1','remove-empty-folders.ps1','export_fleet_eight.py','web_meshes.py','export_environment.py','build_cockpit.py','build_namak.py','preview_namak.py'].includes(path.basename(f)));
prune(path.join(root,'assets-sources'),'obsolete-asset-source',f=>(f.includes(`${path.sep}vehicles-v6${path.sep}`)||f.includes(`${path.sep}cockpit-v1${path.sep}`)||f.includes(`${path.sep}namak${path.sep}`))&&f.endsWith('.blend')||['world.blend','garage.blend'].includes(path.basename(f))&&f.includes(`${path.sep}rebuilt-unity${path.sep}`));
prune(path.join(root,'public'),'unused-runtime-asset',f=>f.includes(`${path.sep}assets${path.sep}rebuild${path.sep}`)&&!f.endsWith(`${path.sep}routes.json`)||['seven-mile-horizon.mp3','slipstream-pursuit.mp3'].some(n=>f===path.join(root,'public/assets/audio',n)));
prune(path.join(root,'artifacts'),'obsolete-evidence-or-backup',f=>f.includes(`${path.sep}vehicle-polish-v6-20261009${path.sep}`)&&!f.includes(`${path.sep}previous-web-cars${path.sep}`)||['colliders.bin','colliders.json'].includes(path.basename(f))&&f.includes(`${path.sep}unity-recovery${path.sep}`)||f.includes(`${path.sep}cleanup-performance-20261010${path.sep}`)||f.includes(`${path.sep}race-experience-20261010${path.sep}`)||f.includes(`${path.sep}music-selection-20261010${path.sep}`)||f.includes(`${path.sep}landscape-20261010${path.sep}`)||f.includes(`${path.sep}cockpit-polish-20261010${path.sep}`)||f.includes(`${path.sep}namak-20261010${path.sep}`)||f.includes(`${path.sep}namak-polish-20261010${path.sep}`)||f.includes(`${path.sep}namak-color-20261010${path.sep}`));
// Current implementation/validation records are useful developer files.
const docs=new Set(['NEXT_STEPS.md','VEHICLE_POLISH_V6.md','BLENDER_THREE_REBUILD.md','FLEET_EIGHT_AND_STABLE_RIDE.md','RACE_CONTROLS.md','RACE_DYNAMICS.md','RENDER_POLISH.md','RIDE_QUALITY.md','RIDE_AND_VFX.md','RIDE_REPAIR.md','OPEN_SOURCE.md','CLEANUP_PERFORMANCE_20261010.md','RACE_EXPERIENCE_20261010.md','MUSIC_SELECTION_20261010.md','LANDSCAPE_20261010.md','COCKPIT_POLISH_20261010.md','NAMAK_CITY_20261010.md','NAMAK_POLISH_20261010.md']);
prune(path.join(root,'docs'),'obsolete-project-document',f=>docs.has(path.basename(f))||f.includes(`${path.sep}licenses${path.sep}`));
prune(path.join(workspace,'tools'),'obsolete-unity-and-portable-tools');
prune(path.join(workspace,'backups'),'obsolete-code-backup');
const publish=path.join(workspace,'publish/mumu-circuit-unity-web');
// Keep remote configuration and Git history; only obsolete working files go.
for(const entry of fs.readdirSync(publish))if(!['.git','README.md'].includes(entry))prune(path.join(publish,entry),'obsolete-deployment-working-copy');
remove(path.join(workspace,'RECOVERY_STATUS.md'),'obsolete-recovery-document');
const protectedFiles=[...keep,...['seven-mile-horizon.mp3','slipstream-pursuit.mp3'].map(n=>path.join(root,'public/assets/audio',n)),path.join(root,'assets-sources/cockpit-v1/cockpit.blend'),path.join(root,'assets-sources/namak/namak.blend'),...files(path.join(root,'assets-sources/vehicles-v6')).filter(f=>f.endsWith('.blend')),...['world','garage'].map(n=>path.join(root,`assets-sources/rebuilt-unity/${n}.blend`)),...files(path.join(root,'public/assets/rebuild')).filter(f=>!f.endsWith(`${path.sep}routes.json`))];
const report={date:new Date().toISOString(),plannedBytes:removals.reduce((n,f)=>n+f.bytes,0),plannedFiles:removals.length,currentSourceFiles:[...keep].filter(f=>f.includes(`${path.sep}src${path.sep}`)),removals,protectedFiles:[...new Set(protectedFiles)].map(f=>({path:f,sha256:crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')}))};
const out=path.join(root,'artifacts/cleanup-performance-20261010');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'cleanup-manifest.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({plannedMiB:report.plannedBytes/1048576,files:report.plannedFiles,keptSourceFiles:report.currentSourceFiles.length,categories:Object.fromEntries([...new Set(removals.map(f=>f.reason))].map(reason=>[reason,{files:removals.filter(f=>f.reason===reason).length,MiB:removals.filter(f=>f.reason===reason).reduce((n,f)=>n+f.bytes,0)/1048576}]))},null,2));
