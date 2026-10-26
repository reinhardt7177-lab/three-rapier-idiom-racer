import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createNamakArchitecture,NAMAK_ARCHITECTURE_BUDGETS} from '../src/rebuild/namakArchitecture.js';
import {batchWorldScenery} from '../src/rebuild/worldRendering.js';
import {createSceneDisposer} from '../src/rendering/sceneResources.js';

const repo=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,repo));
const report=JSON.parse(read('artifacts/namak-highdetail-20261013/architecture-report.json'));
const route=JSON.parse(read('public/assets/rebuild/namak-route.json'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const parse=async()=>{
 const b=read('public/assets/rebuild/namak-architecture.glb');
 const root=(await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;
 root.name='Namak_Architecture';root.userData.dynamic=true;
 root.updateMatrixWorld(true);return root;
};

test('separate architecture export preserves original Blender, world, route and physical fixtures byte for byte',()=>{
 const originals={
  'assets-sources/namak/namak.blend':'6aa1a71b617a9eaa81fac4ec00a2be313f3fe24cf8141ce17b285196f8af81e5',
  'public/assets/rebuild/namak.glb':'b4bd07b1afc937e4262fde2164c7f5fd27c39d5809e7a9e47880cf40b154cbd3',
  'public/assets/rebuild/namak-route.json':'81bbf6bc62696d12b6592aa49c8f9cc902d73b43c651b3c2d974cbbb74fbbe5f',
  'artifacts/namak-20261010/colliders.bin':'44dbbefc79cc5c7f76d47404f04bbfdbc6e7fd814c933322b49f3809627db001',
  'artifacts/namak-20261010/colliders.json':'3ca0940c9735d2d9e0f996dfc48dd458e17bceca16de9c587f57110cc15489cf',
 };
 for(const [p,expected] of Object.entries(originals))assert.equal(sha(read(p)),expected,p);
 assert.equal(report.sourceSha256,originals['assets-sources/namak/namak.blend']);
 assert.ok(read('assets-sources/namak/namak-highdetail.blend').length>read('assets-sources/namak/namak.blend').length);
});

test('actual visual asset matches its output report, remains bounded and contains no hidden physics',async()=>{
 const root=await parse();
 try{
  let meshes=0,triangles=0;const zones=new Set(),materials=new Set();
  root.traverse(o=>{
   assert.ok(!o.userData.unity_collider&&!o.userData.namak_collision,`unexpected collider ${o.name}`);
   if(!o.isMesh)return;
   assert.equal(o.userData.visualOnly,true,o.name);assert.equal(o.userData.namak_architecture,true,o.name);
   assert.ok(!/Road_Asphalt|Terrain|RaceBarrier/.test(o.name));
   meshes++;zones.add(o.userData.zone);materials.add(o.material);
   const p=o.geometry.attributes.position;assert.ok(p?.count>0);
   for(const n of p.array)assert.ok(Number.isFinite(n),`nonfinite ${o.name}`);
   const index=o.geometry.index;assert.ok(index);assert.equal(index.count%3,0);triangles+=index.count/3;
  });
  assert.equal(meshes,report.meshes);assert.equal(triangles,report.triangles);
  assert.equal(read('public/assets/rebuild/namak-architecture.glb').length,report.bytes);
  assert.ok(report.bytes<2_000_000,'separate detail download budget');assert.ok(triangles<30_000,'authored architecture triangle budget');
  assert.deepEqual([...zones].sort(),report.zones);assert.equal(materials.size,6);
  const bounds=new THREE.Box3().setFromObject(root);assert.ok(bounds.max.y>80&&bounds.max.y<90,'tower crown uses game Y up');
  assert.ok(bounds.min.y>-.3&&bounds.min.y<0,'low riverbank remains near ground rather than being axis-rotated');
 }finally{createSceneDisposer(root)();}
});

test('exported crown and basin use Y up and reservoir walkway faces point outward from the closed solid',async()=>{
 const root=await parse();
 try{
  const ray=new THREE.Raycaster(),samples=[
   {name:'civic tower crown',x:365,z:-112,y:87.4,material:'Namak_Arch_Ivory'},
   {name:'forecourt reflecting basin',x:440,z:-33,y:.055,material:'Namak_Arch_Glass'},
   {name:'reservoir timber ring',x:725,z:-154,y:.125,material:'Namak_Arch_Timber'},
  ];
  for(const s of samples){
   ray.set(new THREE.Vector3(s.x,100,s.z),new THREE.Vector3(0,-1,0));ray.far=110;
   const hit=ray.intersectObject(root,true)[0];assert.ok(hit,`${s.name}: inverted/missing face`);
   assert.ok(Math.abs(hit.point.y-s.y)<1e-4,`${s.name} Y=${hit.point.y}`);
   assert.equal(hit.object.material.name,s.material,s.name);
   const normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
   assert.ok(normal.y>.99,`${s.name}: upward normal ${normal.y}`);
  }
  for(const s of [
   {name:'reservoir bottom',origin:[725,-.5,-153],direction:[0,1,0],normal:[0,-1,0]},
   {name:'reservoir inner wall',origin:[720,.09,-153],direction:[1,0,0],normal:[-1,0,0]},
   {name:'reservoir outer wall',origin:[735,.09,-153],direction:[-1,0,0],normal:[1,0,0]},
  ]){
   ray.set(new THREE.Vector3(...s.origin),new THREE.Vector3(...s.direction));ray.far=20;
   const hit=ray.intersectObject(root,true)[0];assert.ok(hit,`${s.name}: missing face`);
   assert.equal(hit.object.material.name,'Namak_Arch_Timber',s.name);
   const normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
   assert.ok(normal.dot(new THREE.Vector3(...s.normal))>.99,`${s.name}: inward normal ${normal.toArray()}`);
  }
 }finally{createSceneDisposer(root)();}
});

test('architecture occupies none of the sampled vehicle height space across every route point and eight lanes',async()=>{
 const root=await parse();
 try{
  const materials=new Set();root.traverse(o=>{if(o.isMesh)materials.add(o.material);});
  // Geometry clearance matters even if a wrongly wound face would be invisible.
  for(const m of materials)m.side=THREE.DoubleSide;
  const ray=new THREE.Raycaster();ray.near=0;ray.far=2.5;
  for(let i=0;i<route.points.length;i++){
   const p=route.points[i];
   for(const lane of [-9,-7,-5,-2.2,2.2,5,7,9]){
    const x=p.x+p.dz*lane,z=p.z-p.dx*lane;
    ray.set(new THREE.Vector3(x,.06,z),new THREE.Vector3(0,1,0));
    const hit=ray.intersectObject(root,true)[0];
    assert.ok(!hit,`new detail blocks vehicle height at route ${i}, lane ${lane}: ${hit?.object.name}`);
   }
  }
 }finally{createSceneDisposer(root)();}
});

test('real architecture keeps its bounded layer through batching, hides by world/quality/distance and restores visibility',async()=>{
 const root=await parse(),world=new THREE.Group();world.add(root);
 const before=[];root.traverse(o=>{if(o.isMesh)before.push({o,g:o.geometry,visible:o.visible});});
 const view=createNamakArchitecture(world,'high'),camera=new THREE.PerspectiveCamera();
 try{
  assert.equal(view.stats.objects,report.meshes);assert.equal(view.stats.distance,NAMAK_ARCHITECTURE_BUDGETS.high);
  batchWorldScenery(world);assert.equal(root.parent,world);for(const b of before)assert.equal(b.o.geometry,b.g);
  camera.position.set(150,5,0);view.update(camera);assert.ok(view.stats.visible>0);const high=view.stats.visible;
  view.setQuality({id:'medium'});assert.equal(view.stats.distance,NAMAK_ARCHITECTURE_BUDGETS.medium);view.update(camera);assert.ok(view.stats.visible>0&&view.stats.visible<=high);
  view.setQuality('low');view.update(camera);assert.equal(root.visible,false);assert.equal(view.stats.visible,0);
  view.setQuality('high');camera.position.set(10000,5,10000);view.update(camera);assert.equal(view.stats.visible,0);
  camera.position.set(150,5,0);view.update(camera,false);assert.equal(root.visible,false);assert.equal(view.stats.visible,0);
  world.visible=false;view.update(camera,true);assert.equal(root.visible,false);assert.equal(view.stats.visible,0);
  world.visible=true;view.update(camera,true);assert.ok(view.stats.visible>0);
  view.dispose();assert.equal(root.visible,true);for(const b of before)assert.equal(b.o.visible,b.visible);
 }finally{view.dispose();createSceneDisposer(world)();}
});

test('quality uses the object boundary distance, including switching back after low mode',()=>{
 const world=new THREE.Group(),root=new THREE.Group();root.name='Namak_Architecture';root.userData.dynamic=true;world.add(root);
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshStandardMaterial());root.add(mesh);
 const view=createNamakArchitecture(world,'high'),camera={position:new THREE.Vector3(250,0,0)};
 try{
  view.update(camera);assert.equal(view.stats.visible,1);
  view.setQuality('medium');view.update(camera);assert.equal(view.stats.visible,0);
  camera.position.set(100,0,0);view.update(camera);assert.equal(view.stats.visible,1);
  view.setQuality('low');view.update(camera);assert.equal(view.stats.visible,0);
  view.setQuality('high');view.update(camera);assert.equal(view.stats.visible,1);
 }finally{view.dispose();createSceneDisposer(world)();}
});

test('controller owns no asset resources; terminal scene cleanup releases every shared material and geometry exactly once',async()=>{
 const root=await parse(),world=new THREE.Group();world.add(root);
 const resources=new Set(),counts=new Map();root.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);});
 for(const r of resources){counts.set(r,0);r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));}
 const view=createNamakArchitecture(world,'high');view.update({position:new THREE.Vector3(150,5,0)});
 view.dispose();view.dispose();for(const count of counts.values())assert.equal(count,0);
 const cleanup=createSceneDisposer(world);cleanup();cleanup();for(const count of counts.values())assert.equal(count,1);
});
