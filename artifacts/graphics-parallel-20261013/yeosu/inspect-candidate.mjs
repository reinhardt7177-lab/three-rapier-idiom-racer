import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createYeosuVisuals,yeosuLightSources} from './yeosuVisuals.candidate.js';
const bytes=fs.readFileSync(new URL('../../../public/assets/rebuild/yeosu.glb',import.meta.url));
const world=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
const route=JSON.parse(fs.readFileSync(new URL('../../../public/assets/rebuild/yeosu-route.json',import.meta.url)));
const scene=new THREE.Scene();scene.add(world);scene.fog=new THREE.Fog('#09182d',900,2500);
const start=performance.now(),lights=yeosuLightSources(world),extractionMs=performance.now()-start;
const constructionStart=performance.now(),overlay=createYeosuVisuals(scene,world,route),constructionMs=performance.now()-constructionStart;
const camera=new THREE.PerspectiveCamera();camera.position.set(-290,30,900);
overlay.update(camera,1/60,1,true);
const sea=scene.getObjectByName('Yeosu_Sea_Ripples');
const summary={extractionMs,constructionMs,lights:{bridge:lights.bridge.length,road:lights.road.length,water:lights.water.length},stats:{...overlay.stats},selectedSources:sea?.material.uniforms.sourceCount.value,
 bridge:lights.bridge.map(o=>({position:o.position.toArray(),kind:o.kind})),qualities:{}};
for(const quality of ['high','medium','low']){overlay.setQuality(quality);overlay.update(camera,1/60,2,true);summary.qualities[quality]={...overlay.stats};}
const label=process.argv[2]??'next',output=new URL(`./candidate-cost-${label}.json`,import.meta.url);
if(fs.existsSync(output))throw new Error(`Preserve the earlier sample: ${output.pathname}`);
fs.writeFileSync(output,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));overlay.dispose();
