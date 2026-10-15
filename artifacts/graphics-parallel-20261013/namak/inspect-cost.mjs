import fs from 'node:fs';
import * as THREE from 'three';
import {createNamakVisuals} from './namakVisuals.candidate.mjs';
const route=JSON.parse(fs.readFileSync(new URL('../../../public/assets/rebuild/namak-route.json',import.meta.url)));
const scene=new THREE.Scene(),world=new THREE.Group();scene.add(world);
const begin=performance.now(),visual=createNamakVisuals(scene,world,route),createMs=performance.now()-begin;
const camera=new THREE.PerspectiveCamera();const samples=[];
for(const quality of ['high','medium','low']){
 visual.setQuality(quality);let maxCalls=0,maxTriangles=0;const times=[];
 for(let i=0;i<3600;i++){
  const p=route.points[Math.floor(i/3600*route.points.length)];camera.position.set(p.x,3.5,p.z);
  const t=performance.now();visual.update(camera,1/60,i/60,true);times.push(performance.now()-t);
  maxCalls=Math.max(maxCalls,visual.stats.visibleDrawCalls);maxTriangles=Math.max(maxTriangles,visual.stats.visibleTriangles);
 }
 const sorted=[...times].sort((a,b)=>a-b);
 samples.push({quality,samples:times.length,meanMs:times.reduce((a,b)=>a+b,0)/times.length,p95Ms:sorted[Math.ceil(sorted.length*.95)-1],maxMs:sorted.at(-1),over50:times.filter(t=>t>50).length,maxCalls,maxTriangles});
}
const report={created:new Date().toISOString(),runtime:`local ${process.platform} Node ${process.version}`,scope:'CPU update only; no renderer, browser frame, GPU or race benchmark',concurrentJobs:'parent full regression and map workers were active',createMs,stats:visual.stats,samples};
fs.writeFileSync(new URL('./cost-candidate.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));visual.dispose();
