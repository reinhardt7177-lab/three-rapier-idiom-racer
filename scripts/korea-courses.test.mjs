import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import RAPIER from '@dimforge/rapier3d-compat';
import {initPhysics} from '../src/driving/physics.js';
import {recoveredCollider} from '../src/rebuild/worldCollision.js';
import {createSceneDisposer} from '../src/rendering/sceneResources.js';
import {createNamakLandmarks} from '../src/rebuild/namakLandmarks.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url));
export function koreaData(id){
 const route=JSON.parse(read(`public/assets/rebuild/${id}-route.json`));
 const bin=read(`artifacts/korea-circuits-20261011/${id}/colliders.bin`),manifest=JSON.parse(read(`artifacts/korea-circuits-20261011/${id}/colliders.json`));
 const parts=manifest.map(p=>{
  const vertices=new Float32Array(p.vertices),indices=new Uint32Array(p.indices);
  for(let i=0;i<vertices.length;i++)vertices[i]=bin.readFloatLE(p.offset+i*4);
  for(let i=0;i<indices.length;i++)indices[i]=bin.readUInt32LE(p.offset+vertices.byteLength+i*4);
  return {name:p.name,vertices,indices};
 });
 return {route,track:{id,gridRowStep:6},parts};
}
for(const id of ['yeosu','seongsamjae']){
 test(`${id}: editable Blender course and exported GLB respect the 25MB budget`,async()=>{
  const bin=read(`public/assets/rebuild/${id}.glb`);
  assert.ok(bin.length>100000&&bin.length<=25_000_000);
  assert.ok(read(`assets-sources/${id}/${id}.blend`).length>100000);
  const {scene}=await new GLTFLoader().parseAsync(bin.buffer.slice(bin.byteOffset,bin.byteOffset+bin.byteLength),'');scene.updateMatrixWorld(true);
  let roads=0,signs=0;scene.traverse(o=>{if(o.name.startsWith('Road_Asphalt')){assert.ok(o.userData.unity_collider);roads++;}if(o.userData.namak_sign){signs++;assert.ok(o.getWorldPosition(new THREE.Vector3()).length()>20,'landmark culling anchor must be at its actual sign');}});
  const road=scene.getObjectByName('Road_Asphalt_0');road.castShadow=true;road.receiveShadow=true;
  const landmarks=createNamakLandmarks(scene);landmarks.update(new THREE.PerspectiveCamera(),true);
  assert.equal(road.castShadow,true,'landmark setup must not modify the whole world');assert.equal(road.receiveShadow,true);
  assert.equal(roads,1,'one connected asphalt collider, with no internal chunk boundaries');assert.ok(signs>=4);createSceneDisposer(scene)();
 });
 test(`${id}: visual buildings and roofs do not occupy the racing corridor`,async()=>{
  const bin=read(`public/assets/rebuild/${id}.glb`),{route}=koreaData(id);
  const {scene}=await new GLTFLoader().parseAsync(bin.buffer.slice(bin.byteOffset,bin.byteOffset+bin.byteLength),'');scene.updateMatrixWorld(true);
  const buildings=[];scene.traverse(o=>{if(!o.isMesh)return;const materials=Array.isArray(o.material)?o.material:[o.material];if(materials.some(m=>/^(Facade|Roof)(\.|$)/.test(m.name))){materials.forEach(m=>m.side=THREE.DoubleSide);buildings.push(o);}});
  const ray=new THREE.Raycaster();ray.far=12;
  try {for(let i=0;i<route.points.length;i++)for(const lane of [-7,0,7]){
   const p=route.points[i];ray.set(new THREE.Vector3(p.x+p.dz*lane,p.y+.05,p.z-p.dx*lane),new THREE.Vector3(0,1,0));
   assert.equal(ray.intersectObjects(buildings,false).length,0,`visual building occupies route ${i} lane ${lane}`);
  }}finally{createSceneDisposer(scene)();}
 });
 test(`${id}: all route points form a closed, finite circuit without gaps`,()=>{
  const {route}=koreaData(id);assert.equal(route.closed,true);assert.ok(route.width>=16);
  let length=0;
  for(let i=0;i<route.points.length;i++){
   const p=route.points[i],next=route.points[(i+1)%route.points.length];
   for(const k of ['x','y','z','distance','dx','dz'])assert.ok(Number.isFinite(p[k]));
   const gap=Math.hypot(next.x-p.x,next.y-p.y,next.z-p.z);assert.ok(gap>1.9&&gap<=2.01,`gap ${i}: ${gap}`);length+=gap;
   assert.ok(Math.abs(Math.hypot(p.dx,p.dz)-1)<1e-6);if(i)assert.ok(p.distance>route.points[i-1].distance);
  }
  assert.ok(Math.abs(length-route.length)<1);assert.ok(route.points[25].region);
 });
 test(`${id}: every route sample at -7,0,+7m has upward asphalt support and clear car space`,async()=>{
  await initPhysics();const {route,parts}=koreaData(id),world=new RAPIER.World({x:0,y:-9.81,z:0});
  const asphalt=new Set();
  try{
   for(const p of parts){const c=world.createCollider(recoveredCollider(p.vertices,p.indices));if(p.name.startsWith('Road_Asphalt'))asphalt.add(c.handle);}
   world.step();
   for(let i=0;i<route.points.length;i++)for(const lane of [-7,0,7]){
    const p=route.points[i],origin={x:p.x+p.dz*lane,y:p.y+2,z:p.z-p.dx*lane};
    const hit=world.castRayAndGetNormal(new RAPIER.Ray(origin,{x:0,y:-1,z:0}),3,true);
    assert.ok(hit&&asphalt.has(hit.collider.handle),`asphalt gap ${i} lane ${lane}`);
    assert.ok(hit.normal.y>.9,`inverted or overly steep road ${i}: ${hit.normal.y}`);
    assert.ok(Math.abs(hit.timeOfImpact-2)<.03,`height mismatch ${i} lane ${lane}`);
    const up=world.castRay(new RAPIER.Ray({...origin,y:p.y+.05},{x:0,y:1,z:0}),2,true);
    assert.equal(up,null,`collider blocks car clearance ${i} lane ${lane}`);
   }
  }finally{world.free();}
 });
}
