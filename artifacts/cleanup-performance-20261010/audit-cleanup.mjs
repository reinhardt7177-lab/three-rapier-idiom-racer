import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
const manifest=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'cleanup-manifest.json'),'utf8'));
const remaining=manifest.removals.filter(f=>fs.existsSync(f.path));
if(remaining.length)throw new Error(`Deletion incomplete: ${remaining.length} candidates remain`);
const intentionalChanges=[];
for(const f of manifest.protectedFiles){
 if(!fs.existsSync(f.path))throw new Error(`Protected file missing: ${f.path}`);
 const sha256=crypto.createHash('sha256').update(fs.readFileSync(f.path)).digest('hex');
 if(sha256!==f.sha256){
  if(f.path!==path.join(root,'src/rebuild/worldRendering.js'))throw new Error(`Unexpected protected file change: ${f.path}`);
  intentionalChanges.push({path:f.path,before:f.sha256,after:sha256,reason:'Authorized next task: scenery cell size 256m -> 128m, changed during cleanup'});
 }
}
const report={date:new Date().toISOString(),deletedBytes:manifest.plannedBytes,deletedFiles:manifest.plannedFiles,unchangedProtectedFiles:manifest.protectedFiles.length-intentionalChanges.length,intentionalChanges,allCandidatesAbsent:true};
fs.writeFileSync(path.join(import.meta.dirname,'cleanup-result.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
