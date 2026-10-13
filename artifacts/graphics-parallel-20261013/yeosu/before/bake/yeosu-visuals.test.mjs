import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createYeosuVisuals,yeosuLightSources,YEOSU_VISUAL_BUDGETS} from '../src/rebuild/yeosuVisuals.js';
const bytes=fs.readFileSync(new URL('../public/assets/rebuild/yeosu.glb',import.meta.url));
const load=async()=>{const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');return scene;};
const route=JSON.parse(fs.readFileSync(new URL('../public/assets/rebuild/yeosu-route.json',import.meta.url)));
const world=await load();
function setup(source=world){const scene=new THREE.Scene();scene.add(source);scene.fog=new THREE.Fog('#09182d',900,2500);const overlay=createYeosuVisuals(scene,source,route);return {scene,overlay};}
function camera(x=-290,y=30,z=900){const camera=new THREE.PerspectiveCamera();camera.position.set(x,y,z);return camera;}

test('actual batched Blender geometry supplies all eight bridge lamps and independently sampled shore lights',()=>{
 const sources=yeosuLightSources(world);
 assert.equal(sources.bridge.length,8);assert.equal(sources.bridge.filter(o=>o.kind==='Pink').length,4);assert.equal(sources.bridge.filter(o=>o.kind==='Cyan').length,4);
 assert.ok(sources.road.length>250);assert.ok(sources.water.length>50);
 for(const source of sources.bridge){assert.ok(source.position.y>50&&source.position.y<72);assert.ok(source.kind==='Pink'||source.kind==='Cyan');}
 const cells=new Set();for(const source of sources.water.filter(o=>o.kind==='harbor')){const cell=`${Math.floor(source.position.x/65)},${Math.floor(source.position.z/65)}`;assert.ok(!cells.has(cell));cells.add(cell);}
});
test('visual replacement leaves every authored vertex, material, collider annotation and transform unchanged',()=>{
 const snapshots=[];world.traverse(o=>{if(o.isMesh)snapshots.push({o,position:o.geometry.attributes.position.array.slice(),matrix:o.matrix.clone(),material:o.material,data:JSON.stringify(o.userData)});});
 const {overlay}=setup();overlay.update(camera(),1/60,1,true);
 for(const s of snapshots){assert.deepEqual(s.o.geometry.attributes.position.array,s.position);assert.ok(s.o.matrix.equals(s.matrix));assert.equal(s.o.material,s.material);assert.equal(JSON.stringify(s.o.userData),s.data);}
 overlay.dispose();
});
test('reflection mask covers the complete +/-7m road corridor and the new sea remains far below the asphalt',()=>{
 const {scene,overlay}=setup(),sea=scene.getObjectByName('Yeosu_Sea_Ripples'),uniform=sea.material.uniforms;
 const texture=uniform.roadMask.value,bounds=uniform.roadBounds.value,{data,width,height}=texture.image;
 for(const p of route.points)for(const side of [-7,0,7]){const x=p.x+p.dz*side,z=p.z-p.dx*side,ix=Math.floor((x-bounds.x)/bounds.z*width),iz=Math.floor((z-bounds.y)/bounds.w*height);assert.equal(data[iz*width+ix],255);}
 assert.ok(sea.geometry.boundingSphere.center.y<Math.min(...route.points.map(p=>p.y))-10);
 assert.equal(sea.geometry.index.count/3,2);assert.equal(texture.generateMipmaps,false);assert.ok(uniform.fogColor&&uniform.fogNear&&uniform.fogFar,'standard scene fog has real uniforms');overlay.dispose();
});
test('quality budgets bound extra calls, geometry and light sources without adding lights or a render pass',()=>{
 const {scene,overlay}=setup();
 for(const quality of ['high','medium','low']){overlay.setQuality(quality);overlay.update(camera(),1/60,1,true);const s=overlay.stats,b=YEOSU_VISUAL_BUDGETS[quality];
  assert.ok(s.addedDraws<=2);assert.ok(s.haloInstances<=b.roadHalos+b.bridgeHalos);assert.ok(s.addedTriangles<=2*(b.roadHalos+b.bridgeHalos));assert.ok(s.reflectionSources<=b.reflections);assert.equal(s.reflectionPasses,0);assert.equal(s.lights,0);assert.equal(s.skyDraws,0);assert.equal(s.seaTriangles,2);
 }
 assert.equal(overlay.stats.addedDraws,1);assert.equal(scene.getObjectByName('Yeosu_Road_Halos').visible,false);
 let lights=0;scene.getObjectByName('Yeosu_Visuals').traverse(o=>{if(o.isLight)lights++;});assert.equal(lights,0);overlay.dispose();
});
test('pause holds the ripple clock, visibility restores the old sea, and distance removes inactive reflection sources',()=>{
 const {scene,overlay}=setup(),sea=scene.getObjectByName('Yeosu_Sea_Ripples');let source;world.traverse(o=>{if(o.material?.name==='Water')source=o;});const prior=source.visible;
 overlay.update(camera(),1/60,2,true);assert.equal(source.visible,false);assert.ok(sea.material.uniforms.sourceCount.value>0);
 overlay.update(camera(),0,2,true);assert.equal(sea.material.uniforms.visualTime.value,2);
 overlay.update(camera(),1/60,3,false);assert.equal(source.visible,prior);assert.equal(scene.getObjectByName('Yeosu_Visuals').visible,false);
 overlay.setQuality('low');overlay.update(camera(100000,1000,100000),1/60,4,true);assert.equal(sea.material.uniforms.sourceCount.value,0);overlay.dispose();assert.equal(source.visible,prior);
});
test('owned GPU resources dispose once and authored geometry/material resources are retained',()=>{
 const {scene,overlay}=setup(),group=scene.getObjectByName('Yeosu_Visuals'),owned=new Set();
 group.traverse(o=>{if(o.geometry)owned.add(o.geometry);if(o.material)owned.add(o.material);for(const uniform of Object.values(o.material?.uniforms??{}))if(uniform.value?.isTexture)owned.add(uniform.value);});
 const counters=new Map([...owned].map(o=>[o,0]));for(const o of owned)o.addEventListener('dispose',()=>counters.set(o,counters.get(o)+1));
 let originalDisposals=0;world.traverse(o=>{if(o.geometry)o.geometry.addEventListener('dispose',()=>originalDisposals++);if(o.material)o.material.addEventListener('dispose',()=>originalDisposals++);});
 overlay.update(camera(),1/60,1,true);overlay.dispose();overlay.dispose();assert.equal(scene.getObjectByName('Yeosu_Visuals'),undefined);assert.equal(originalDisposals,0);assert.ok([...counters.values()].every(n=>n===1));
});
test('a restarted race reselects nearby reflections when the elapsed clock returns to zero',()=>{
 const {scene,overlay}=setup(),sea=scene.getObjectByName('Yeosu_Sea_Ripples');
 overlay.update(camera(),1/60,300,true);assert.ok(sea.material.uniforms.sourceCount.value>0);
 overlay.setQuality('low');assert.ok(sea.material.uniforms.sourceCount.value<=4,'a quality change immediately enforces its shader budget');
 overlay.update(camera(100000,1000,100000),1/60,0,true);assert.equal(sea.material.uniforms.visualTime.value,0);assert.equal(sea.material.uniforms.sourceCount.value,0,'old reflected lights are not carried through a restarted race');overlay.dispose();
});
test('an unrelated empty world receives no visual lights, sea geometry or additional draws',()=>{
 const empty=new THREE.Group(),{scene,overlay}=setup(empty);overlay.update(camera(),1/60,1,true);assert.equal(overlay.stats.seaReplacements,0);assert.equal(overlay.stats.addedDraws,0);assert.equal(overlay.stats.reflectionSources,0);assert.equal(scene.getObjectByName('Yeosu_Sea_Ripples'),undefined);overlay.dispose();
});
