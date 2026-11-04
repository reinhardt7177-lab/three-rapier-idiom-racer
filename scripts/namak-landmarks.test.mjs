import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createNamakLandmarks} from '../src/rebuild/namakLandmarks.js';
import {batchWorldScenery} from '../src/rebuild/worldRendering.js';
import {createSceneDisposer} from '../src/rendering/sceneResources.js';
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url));
const parse=async()=>{
 const b=read('public/assets/rebuild/namak-landmarks.glb');
 return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;
};
const report=JSON.parse(read('public/assets/rebuild/namak-landmarks.json'));
const route=JSON.parse(read('public/assets/rebuild/namak-route.json'));

test('exported Blender signs contain readable place labels on their outward board face',async()=>{
 const scene=await parse();scene.updateMatrixWorld(true);
 assert.equal(report.count,22);assert.ok(report.bytes<2_000_000);
 assert.ok(read('assets-sources/namak/namak-landmarks.blend').length>10000);
 for(const record of report.signs){
  let root;scene.traverse(o=>{if(o.userData.namak_sign===record.id)root=o;});assert.ok(root,record.id);
  const labels=[];root.traverse(o=>{if(o.userData.namak_label)labels.push(o);});
  assert.ok(labels.some(o=>o.userData.namak_label===record.title),record.title);
  const direction=new THREE.Vector3(Math.sin(record.yaw),0,Math.cos(record.yaw));
  const center=new THREE.Vector3(record.x,record.y+.37,record.z);
  // A view from in front of the real exported panel must hit the letters,
  // rather than the solid backing hiding inward-facing text.
  const title=labels.find(o=>o.userData.namak_label===record.title);
  // Aim inside a real glyph triangle. The bounding-box centre may be empty
  // space between Korean letters, which is not evidence of reversed text.
  const glyph=title.geometry,glyphPosition=glyph.attributes.position;
  const vertices=[0,1,2].map(i=>new THREE.Vector3().fromBufferAttribute(glyphPosition,glyph.index?glyph.index.getX(i):i).applyMatrix4(title.matrixWorld));
  const target=vertices.reduce((sum,v)=>sum.add(v),new THREE.Vector3()).multiplyScalar(1/3);
  const normal=vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).normalize();
  assert.ok(normal.dot(direction)>.99,`inward text triangle: ${record.id}`);
  const ray=new THREE.Raycaster(target.clone().addScaledVector(direction,4),direction.clone().negate(),0,5);
  const hits=ray.intersectObject(root,true);assert.ok(hits.length,record.id);
  assert.equal(hits[0].object.userData.namak_label,record.title,`hidden/backwards title: ${record.id}`);
  // Text width fits the plaque, including long Korean place names.
  const inverse=root.matrixWorld.clone().invert(),positions=title.geometry.attributes.position,local=new THREE.Box3(),v=new THREE.Vector3();
  for(let i=0;i<positions.count;i++)local.expandByPoint(v.fromBufferAttribute(positions,i).applyMatrix4(title.matrixWorld).applyMatrix4(inverse));
  assert.ok(local.max.x-local.min.x<record.width*.90,record.title);
  assert.ok(Math.abs(target.y-center.y)<record.height,record.title);
 }
 createSceneDisposer(scene)();
});

test('all actual sign geometry stays out of the drivable corridor and adds no hidden colliders',async()=>{
 const scene=await parse();scene.updateMatrixWorld(true);let colliders=0;
 scene.traverse(o=>{if(o.userData.unity_collider)colliders++;});assert.equal(colliders,0);
 const ray=new THREE.Raycaster();
 for(let i=0;i<route.points.length;i+=4){
  const p=route.points[i];
  for(const lane of [-9,-2.2,2.2,9]){
   ray.set(new THREE.Vector3(p.x+p.dz*lane,.06,p.z-p.dx*lane),new THREE.Vector3(0,1,0));ray.far=4;
   assert.equal(ray.intersectObject(scene,true).length,0,`sign in driver clearance: ${i}/${lane}`);
  }
 }
 createSceneDisposer(scene)();
});

test('sign groups survive batching, cull outside the current district and release resources once',async()=>{
 const scene=await parse();scene.updateMatrixWorld(true);
 const view=createNamakLandmarks(scene);assert.equal(view.stats.signs,report.count);
 batchWorldScenery(scene);assert.equal(scene.children.filter(o=>o.userData.namak_sign).length,report.count);
 const first=report.signs[0];view.update({position:new THREE.Vector3(first.x,3,first.z)},true);assert.ok(view.stats.visibleSigns>0);
 view.update({position:new THREE.Vector3(20000,3,20000)},true);assert.equal(view.stats.visibleSigns,0);
 view.update({position:new THREE.Vector3(first.x,3,first.z)},false);assert.equal(view.stats.visibleSigns,0);
 const materials=new Set();scene.traverse(o=>{if(o.isMesh)materials.add(o.material);});
 let disposed=0;materials.forEach(m=>m.addEventListener('dispose',()=>disposed++));
 const dispose=createSceneDisposer(scene);dispose();dispose();assert.equal(disposed,materials.size);
});
