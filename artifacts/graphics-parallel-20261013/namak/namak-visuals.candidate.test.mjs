import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createNamakVisuals,namakTreeDetails,NAMAK_VISUAL_BUDGETS} from './namakVisuals.candidate.mjs';
import {polishWorldSurfaces} from '../../../src/rebuild/surfacePolish.js';
import {applyNamakColors} from '../../../src/rebuild/namakColors.js';
import {createSceneDisposer} from '../../../src/rendering/sceneResources.js';
import {batchWorldScenery} from '../../../src/rebuild/worldRendering.js';
const repo=new URL('../../../',import.meta.url),read=p=>fs.readFileSync(new URL(p,repo));
const route=JSON.parse(read('public/assets/rebuild/namak-route.json'));
const parse=async()=>{const b=read('public/assets/rebuild/namak.glb');return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;};
const checksum=a=>crypto.createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');

test('Namak visual details preserve every authored road/collider/vertex and own no physics',async()=>{
 const world=await parse(),scene=new THREE.Scene();scene.add(world);world.updateMatrixWorld(true);
 const before=[];world.traverse(o=>{if(o.isMesh)before.push({o,geometry:o.geometry,positions:checksum(o.geometry.attributes.position.array),index:o.geometry.index?checksum(o.geometry.index.array):null,transform:o.matrixWorld.toArray(),extras:JSON.stringify(o.userData)});});
 const visual=createNamakVisuals(scene,world,route);
 for(const b of before){assert.equal(b.o.geometry,b.geometry);assert.equal(checksum(b.o.geometry.attributes.position.array),b.positions);assert.equal(b.o.geometry.index?checksum(b.o.geometry.index.array):null,b.index);assert.deepEqual(b.o.matrixWorld.toArray(),b.transform);assert.equal(JSON.stringify(b.o.userData),b.extras);}
 visual.root.traverse(o=>{assert.ok(!o.userData.unity_collider);assert.ok(!/Road_Asphalt|Terrain|RaceBarrier/.test(o.name));});
 assert.ok(visual.stats.materials>=10);assert.equal(visual.stats.textureBytes,0);assert.equal(visual.stats.shadowDrawCalls,0);
 visual.dispose();createSceneDisposer(scene)();
});

test('tree silhouette additions stay behind race walls and retain deterministic medium coverage',()=>{
 const a=namakTreeDetails(route),b=namakTreeDetails(route);assert.deepEqual(a,b);
 const details=a.flatMap(c=>c.records);assert.equal(details.length,558);
 for(const p of details){
  const near=Math.min(...route.points.map(q=>Math.hypot(p.x-q.x,p.z-q.z)))-Math.max(p.sx,p.sz);
  assert.ok(near>11.85,`leaf ${p.index}/${p.side}/${p.lobe} at ${near} m`);
  assert.ok(p.y-p.sy>3.5);
 }
 assert.equal(a.reduce((n,c)=>n+c.mediumCount,0),310);
});

test('quality budgets bound leaf draw submissions, distance visibility and low mode cost',()=>{
 const world=new THREE.Group(),scene=new THREE.Scene();scene.add(world);
 const visual=createNamakVisuals(scene,world,route),camera=new THREE.PerspectiveCamera();camera.position.set(150,5,0);
 visual.update(camera,1/60,0,true);assert.ok(visual.stats.visibleDrawCalls>0&&visual.stats.visibleDrawCalls<=NAMAK_VISUAL_BUDGETS.high.chunks);assert.ok(visual.stats.visibleTriangles>0);
 const high=visual.stats.visibleInstances;
 visual.setQuality('medium');visual.update(camera,1/60,.1,true);assert.ok(visual.stats.visibleDrawCalls<=NAMAK_VISUAL_BUDGETS.medium.chunks);assert.ok(visual.stats.visibleInstances<high);
 visual.setQuality({id:'low'});visual.update(camera,1/60,.2,true);assert.equal(visual.root.visible,false);assert.equal(visual.stats.visibleDrawCalls,0);assert.equal(visual.stats.visibleTriangles,0);
 visual.setQuality('high');camera.position.set(10000,5,10000);visual.update(camera,1/60,.3,true);assert.equal(visual.stats.visibleInstances,0);
 camera.position.set(150,5,0);world.visible=false;visual.update(camera,1/60,.4,true);assert.equal(visual.root.visible,false);assert.equal(visual.stats.visibleTriangles,0);
 visual.dispose();
});

test('surface shaders compose with original relief/colour, fade sub-pixel joints and restore ownership',()=>{
 const world=new THREE.Group(),scene=new THREE.Scene();scene.add(world);
 const names=['Paving','Concrete','Namak_White','Namak_Glass','Namak_Leaf','Grass','Asphalt'];
 const geometry=new THREE.BoxGeometry(),materials=names.map(name=>new THREE.MeshStandardMaterial({name}));
 for(const material of materials)world.add(new THREE.Mesh(geometry,material));
 polishWorldSurfaces(world,{namak:true});applyNamakColors(world);
 const original=materials.map(m=>({m,color:m.color.clone(),roughness:m.roughness,metalness:m.metalness,compile:m.onBeforeCompile,key:m.customProgramCacheKey}));
 const visual=createNamakVisuals(scene,world,route),shaders=[];
 for(let i=0;i<materials.length-1;i++){
  const shader={uniforms:{},vertexShader:'#include <defaultnormal_vertex>\n#include <begin_vertex>',fragmentShader:'#include <color_fragment>\n#include <normal_fragment_maps>\n#include <tonemapping_fragment>'};
  materials[i].onBeforeCompile(shader);shaders.push(shader);assert.equal(shader.uniforms.namakCityDetail.value,1);
  assert.ok(shader.fragmentShader.includes('float cityLuma'));assert.ok(!shader.vertexShader.includes('displacement'));
 }
 assert.ok(shaders[0].fragmentShader.includes('fwidth(namakSlab)'));assert.ok(shaders[0].fragmentShader.includes('namakSlabDistance'));
 assert.ok(shaders[0].fragmentShader.includes('normal=namakRelief'));assert.ok(shaders[1].fragmentShader.includes('namakPanelFade'));
 assert.equal(materials.at(-1).onBeforeCompile,original.at(-1).compile);assert.equal(materials.at(-1).color.getHex(),original.at(-1).color.getHex());
 visual.setQuality('medium');for(const shader of shaders)assert.equal(shader.uniforms.namakCityDetail.value,.65);
 visual.setQuality('low');for(const shader of shaders)assert.equal(shader.uniforms.namakCityDetail.value,0);
 visual.dispose();for(const old of original){assert.ok(old.m.color.equals(old.color));assert.equal(old.m.roughness,old.roughness);assert.equal(old.m.metalness,old.metalness);assert.equal(old.m.onBeforeCompile,old.compile);assert.equal(old.m.customProgramCacheKey,old.key);}
 createSceneDisposer(scene)();
});

test('terminal cleanup frees only owned instance buffers once, then scene assets once',()=>{
 const world=new THREE.Group(),scene=new THREE.Scene();scene.add(world);
 const geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial({name:'Namak_White'});world.add(new THREE.Mesh(geometry,material));
 const visual=createNamakVisuals(scene,world,route),counts=new Map(),track=o=>{counts.set(o,0);o.addEventListener('dispose',()=>counts.set(o,counts.get(o)+1));};
 const owned=new Set();visual.root.traverse(o=>{if(o.isInstancedMesh)owned.add(o);if(o.geometry)owned.add(o.geometry);if(o.material)owned.add(o.material);});
 for(const o of owned)track(o);track(geometry);track(material);
 const count=world.children.length;batchWorldScenery(world);assert.equal(world.children.length,count);
 visual.dispose();visual.dispose();assert.equal(visual.root.parent,null);
 for(const o of owned)assert.equal(counts.get(o),1);assert.equal(counts.get(geometry),0);assert.equal(counts.get(material),0);
 createSceneDisposer(scene)();for(const o of owned)assert.equal(counts.get(o),1);assert.equal(counts.get(geometry),1);assert.equal(counts.get(material),1);
});
