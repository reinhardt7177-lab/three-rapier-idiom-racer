import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const read=p=>fs.readFileSync(path.join(root,p));
const json=p=>JSON.parse(read(p));
const sha=p=>crypto.createHash('sha256').update(read(p)).digest('hex');
const evidence=json('artifacts/visual-polish-20261011/frozen-check-evidence.json');
const summary=json('artifacts/visual-polish-20261011/frozen-comparison-summary.json');
const matrix=json('artifacts/korea-circuits-20261011/matrix.json');
const models=['supra','slk','mustang','porsche911','gtr','rx7','m3','huracan'].map(id=>{
 const p=`public/assets/rebuild/${id}.glb`,b=read(p);
 if(b.readUInt32LE(0)!==0x46546c67||b.readUInt32LE(16)!==0x4e4f534a)throw Error('Invalid GLB '+id);
 const g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString('utf8'));
 let primitives=0,triangles=0,doubleSidedPrimitives=0,doubleSidedTriangles=0;
 for(const n of g.nodes??[])if(n.mesh!==undefined)for(const m of g.meshes[n.mesh].primitives){
  if((m.mode??4)!==4)throw Error('Non-triangle primitive '+id);
  const t=g.accessors[m.indices??m.attributes.POSITION].count/3;
  primitives++;triangles+=t;
  if(g.materials?.[m.material]?.doubleSided){doubleSidedPrimitives++;doubleSidedTriangles+=t;}
 }
 return {id,path:p,sha256:sha(p),bytes:b.length,primitives,triangles,doubleSidedPrimitives,doubleSidedTriangles};
});
const phases=summary.phases.map(p=>{
 const records=p.profiles??[];
 const mean=values=>values.reduce((a,b)=>a+b,0)/values.length;
 const other=records.map(r=>r.buckets.filter(b=>b.category==='other').reduce((a,b)=>({calls:a.calls+b.calls,triangles:a.triangles+b.triangles,cpuMs:a.cpuMs+b.cpuMs}),{calls:0,triangles:0,cpuMs:0}));
 return {phase:p.phase,samples:p.frames.samples,meanMs:p.frames.meanMs,p95Ms:p.frames.p95Ms,maxMs:p.frames.maxMs,over50Ms:p.frames.over50Ms,physicsMeanMs:p.cpu.physicsMs.mean,renderMeanMs:p.cpu.renderMs.mean,gpuMeanMs:p.gpuMean,gpuSamples:p.gpu.length,drawSamples:records.length,other:other.length?{calls:other.map(x=>x.calls),triangles:other.map(x=>x.triangles),meanCpuMs:mean(other.map(x=>x.cpuMs))}:null,slowIntervals:p.frames.evidence.spikes.map(x=>({gapMs:x.gapMs,previousWorkMs:x.previous.cpu.workMs,previousRenderMs:x.previous.cpu.renderMs,previousCallbackDelayMs:x.previous.context.callbackDelayMs,currentCallbackDelayMs:x.current.context.callbackDelayMs,visibleBoth:x.previous.context.visible&&x.current.context.visible,focusedBoth:x.previous.context.focused&&x.current.context.focused}))};
});
const courses=['yeosu','seongsamjae'].map(id=>{
 const files=[`scripts/blender/build_${id}.py`,`assets-sources/${id}/${id}.blend`,`public/assets/rebuild/${id}.glb`,`public/assets/rebuild/${id}-route.json`];
 const runs=matrix.results.filter(r=>r.track===id);
 return {id,files:files.map(p=>({path:p,bytes:read(p).length,sha256:sha(p)})),recordedRuns:runs.map(r=>({difficulty:r.difficulty,laps:r.laps,finished:r.cars.filter(c=>Number.isFinite(c.finish)).length,cars:r.cars.length,minimumUp:r.minimumUp,median:r.median,lowestY:Math.min(...r.cars.map(c=>c.lowest))}))};
});
const mismatches=Object.entries(evidence.hashes).filter(([p,h])=>!fs.existsSync(path.join(root,p))||sha(p)!==h).map(([p])=>p);
const result={generatedAt:new Date().toISOString(),scope:'Read-only current-file and preserved-evidence audit; no new browser benchmark, no new physics run',inputEvidence:['artifacts/visual-polish-20261011/frozen-check-evidence.json','artifacts/visual-polish-20261011/frozen-comparison-summary.json','artifacts/korea-circuits-20261011/matrix.json'].map(p=>({path:p,sha256:sha(p)})),currentInputs:{checked:Object.keys(evidence.hashes).length,mismatches},courses,models,phases};
fs.writeFileSync(path.join(root,'artifacts/goal-audit-20261011/inspection.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({currentInputs:result.currentInputs,courses:courses.map(c=>({id:c.id,runs:c.recordedRuns,glbBytes:c.files[2].bytes})),models,phases},null,2));
if(mismatches.length)process.exitCode=1;
