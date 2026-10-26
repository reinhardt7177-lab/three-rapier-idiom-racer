import fs from 'node:fs';
import zlib from 'node:zlib';
const folder='artifacts/ghost-pass-20261011/';
const files=['comparison-1.json','comparison-2.json'].filter(p=>fs.existsSync(folder+p));
const reports=files.map(file=>{
 const s=JSON.parse(fs.readFileSync(folder+file,'utf8')),f=s.rendering.frozen;
 const poses=f.results.map(r=>JSON.stringify({camera:r.measurement.camera,cars:r.measurement.cars,ghost:r.measurement.ghost,elapsed:r.measurement.elapsed}));
 const phases=f.results.map(r=>{
  const m=r.measurement,p=m.profile,g=p.gpu.samples.filter(g=>g.label===r.phase);
  return {phase:r.phase,elapsed:m.elapsed,frames:m.frames,cpu:m.frames.cpu,gpuMeanMs:g.reduce((n,x)=>n+x.ms,0)/g.length,gpuSamples:g.length,gpuPending:p.gpu.pending,gpuInvalid:p.gpu.invalid,profile:p.records.filter(x=>x.label===r.phase)};
 });
 return {file,status:f.status,detail:f.detail,posesFixed:poses.every(p=>p===poses[0]),phases,intervals:f.intervals,transitions:f.transitions,setupMs:f.setupMs};
});
const bundle=fs.readdirSync('dist/assets').filter(p=>/\.(js|css)$/.test(p)).map(name=>{const b=fs.readFileSync('dist/assets/'+name);return {name,bytes:b.length,gzipBytes:zlib.gzipSync(b).length,diagnosticPresent:/qaFrozenGhost|ghost-single-pass|eligibleMaterials/.test(b.toString())};});
const result={reports,bundle,bundleBytes:bundle.reduce((n,b)=>n+b.bytes,0),bundleGzipBytes:bundle.reduce((n,b)=>n+b.gzipBytes,0)};
fs.writeFileSync(folder+'comparison-summary.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({reports:reports.map(r=>({file:r.file,status:r.status,posesFixed:r.posesFixed,detail:r.detail,phases:r.phases.map(p=>({phase:p.phase,calls:p.frames.calls,triangles:p.frames.triangles,meanMs:p.frames.meanMs,p95Ms:p.frames.p95Ms,maxMs:p.frames.maxMs,over50Ms:p.frames.over50Ms,renderMeanMs:p.cpu.renderMs.mean,physicsMeanMs:p.cpu.physicsMs.mean,gpuMeanMs:p.gpuMeanMs,gpuSamples:p.gpuSamples}))})),bundleBytes:result.bundleBytes,bundleGzipBytes:result.bundleGzipBytes,diagnosticPresent:bundle.some(b=>b.diagnosticPresent)},null,2));
