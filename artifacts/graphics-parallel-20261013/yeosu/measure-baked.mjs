import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createYeosuVisuals,yeosuLightSources} from '../../../src/rebuild/yeosuVisuals.js';
const bytes=fs.readFileSync(new URL('../../../public/assets/rebuild/yeosu.glb',import.meta.url)),route=JSON.parse(fs.readFileSync(new URL('../../../public/assets/rebuild/yeosu-route.json',import.meta.url)));
const world=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene,scene=new THREE.Scene();scene.add(world);
const sourceStart=performance.now(),sources=yeosuLightSources(world,route),sourceMs=performance.now()-sourceStart;
const start=performance.now(),overlay=createYeosuVisuals(scene,world,route),constructionMs=performance.now()-start;
const camera=new THREE.PerspectiveCamera();camera.position.set(-290,30,900);const updates=[];
for(let i=0;i<120;i++){const start=performance.now();overlay.update(camera,1/60,i/60,true);updates.push(performance.now()-start);}
const sorted=updates.slice().sort((a,b)=>a-b),result={sourceMs,constructionMs,layoutMode:sources.layoutMode,stats:overlay.stats,updateCpu:{samples:updates.length,meanMs:updates.reduce((n,v)=>n+v,0)/updates.length,p95Ms:sorted[Math.ceil(sorted.length*.95)-1],maxMs:sorted.at(-1)},rawUpdateCpuMs:updates,runtime:'local Node CPU object update, not GPU or browser frame timing',createdUtc:new Date().toISOString()};
const name=process.argv[2]??'first',file=new URL(`./baked-cost-${name}.json`,import.meta.url);if(fs.existsSync(file))throw new Error('Keep previous timing samples');fs.writeFileSync(file,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,rawUpdateCpuMs:undefined},null,2));overlay.dispose();
