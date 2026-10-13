import fs from 'node:fs';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {polishWorldSurfaces} from '../../../src/rebuild/surfacePolish.js';
import {applyKoreaPalette} from '../../../src/rebuild/koreaPresentation.js';
import {batchWorldScenery} from '../../../src/rebuild/worldRendering.js';
import {createSeongsamjaeVisuals} from './seongsamjaeVisuals.candidate.js';
const base=new URL('../../../',import.meta.url),data=fs.readFileSync(new URL('public/assets/rebuild/seongsamjae.glb',base)),route=JSON.parse(fs.readFileSync(new URL('public/assets/rebuild/seongsamjae-route.json',base)));
const {scene:world}=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
const scene=new THREE.Scene();scene.add(world);polishWorldSurfaces(world);applyKoreaPalette(world,'seongsamjae');const batching=batchWorldScenery(world);
const before=[];world.traverse(o=>{if(o.isMesh&&o.userData.unity_collider)before.push({o,material:o.material,position:o.geometry.attributes.position.array.slice(),matrix:o.matrixWorld.elements.slice(),visible:o.visible});});
const start=performance.now(),v=createSeongsamjaeVisuals(scene,world,route),setupMs=performance.now()-start,camera=new THREE.PerspectiveCamera();
const samples=[];
for(const quality of ['high','medium','low']){
 v.setQuality(quality);const items=[];
 for(let i=0;i<route.points.length;i+=100){const p=route.points[i];camera.position.set(p.x,p.y+2,p.z);const started=performance.now();v.update(camera,1/60,0,true);items.push({index:i,updateMs:performance.now()-started,draws:v.stats.visibleDraws,newDraws:v.stats.newDecorationDraws??0,triangles:v.stats.visibleTriangles,instances:v.stats.visibleInstances});}
 samples.push({quality,maxDraws:Math.max(...items.map(s=>s.draws)),maxNewDraws:Math.max(...items.map(s=>s.newDraws)),maxTriangles:Math.max(...items.map(s=>s.triangles)),updateAverageMs:items.reduce((n,s)=>n+s.updateMs,0)/items.length,items});
}
const stat={...v.stats};v.dispose();
const protectedUnchanged=before.every(({o,material,position,matrix,visible})=>o.material===material&&o.visible===visible&&matrix.every((n,i)=>o.matrixWorld.elements[i]===n)&&position.every((n,i)=>o.geometry.attributes.position.array[i]===n));
const record={at:new Date().toISOString(),runtime:process.platform,node:process.version,glbSha256:crypto.createHash('sha256').update(data).digest('hex'),setupMs,batching,stat,samples,protectedUnchanged,renderedFrames:false,notFrameBenchmark:'CPU module construction/update only; no WebGL submission or GPU execution'};
fs.writeFileSync(new URL('visual-probe.json',import.meta.url),JSON.stringify(record,null,2));
console.log(JSON.stringify({...record,samples:samples.map(({items,...rest})=>rest)},null,2));
