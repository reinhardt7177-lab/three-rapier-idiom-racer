import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createVehicleView,poseVehicle} from '../src/rebuild/assets.js';
import {VEHICLES} from '../src/rebuild/fleet.js';
import {batchStaticMeshes} from '../src/garage/batchStatic.js';

// Use actual exported node transforms/material identities. Bounding-box proxies
// avoid a browser Draco decoder here; visual mesh quality is checked in browser.
function authoredTemplate(id){
 const buffer=fs.readFileSync(new URL(`../public/assets/rebuild/${id}.glb`,import.meta.url));
 const gltf=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)));
 const materials=gltf.materials.map(m=>{const p=m.pbrMetallicRoughness||{},coat=m.extensions?.KHR_materials_clearcoat;const material=new THREE.MeshPhysicalMaterial({metalness:p.metallicFactor??1,roughness:p.roughnessFactor??1,clearcoat:coat?.clearcoatFactor??0,clearcoatRoughness:coat?.clearcoatRoughnessFactor??0});material.color.fromArray(p.baseColorFactor||[1,1,1]);material.name=m.name;return material;});
 function node(index){
  const data=gltf.nodes[index],o=new THREE.Group();o.name=data.name||'';o.userData={...data.extras};
  if(data.matrix){o.matrix.fromArray(data.matrix);o.matrix.decompose(o.position,o.quaternion,o.scale);}
  else {o.position.fromArray(data.translation||[0,0,0]);o.quaternion.fromArray(data.rotation||[0,0,0,1]);o.scale.fromArray(data.scale||[1,1,1]);}
  if(data.mesh!==undefined)for(const p of gltf.meshes[data.mesh].primitives){
   const a=gltf.accessors[p.attributes.POSITION],min=new THREE.Vector3(...a.min),max=new THREE.Vector3(...a.max),size=max.clone().sub(min),geometry=new THREE.BoxGeometry(size.x,size.y,size.z);
   geometry.translate(...min.add(max).multiplyScalar(.5).toArray());o.add(new THREE.Mesh(geometry,materials[p.material]));
  }
  for(const child of data.children||[])o.add(node(child));return o;
 }
 const root=new THREE.Group();for(const n of gltf.scenes[gltf.scene||0].nodes)root.add(node(n));
 for(const code of ['FL','FR','RL','RR']){const wheel=root.getObjectByName('Wheel_'+code);batchStaticMeshes(wheel);wheel.userData.dynamic=true;const steering=root.getObjectByName('Steering_'+code);batchStaticMeshes(steering);steering.userData.dynamic=true;root.getObjectByName('Suspension_'+code).userData.dynamic=true;}
 batchStaticMeshes(root);return {root,gltf};
}
for(const {id} of VEHICLES)test(`${id}: authored pivots survive batching, wheel roll leaves calipers fixed`,()=>{
 const {root,gltf}=authoredTemplate(id),view=createVehicleView(root,id),other=createVehicleView(root,id);
 assert.equal(gltf.images?.length||0,0,'No recovered AI texture in newly authored fleet');
 assert.ok(gltf.nodes.some(n=>n.extras?.vehicle_rig_version===2));
 const detail=gltf.nodes.find(n=>n.extras?.vehicle_detail_version>=3);
 if(detail){
  const parents=new Map();gltf.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>parents.set(c,i)));
  const rotors=gltf.nodes.map((n,i)=>({n,i})).filter(({n})=>n.name?.startsWith('Brake_rotor')||n.name?.startsWith('Brake rotor'));
  assert.equal(rotors.length,4);
  for(const {i} of rotors)assert.match(gltf.nodes[parents.get(i)].name,/^Wheel_[FR][LR]$/,'Rotor belongs to the rotating hub, not the caliper mount');
  const authored=gltf.materials.find(m=>m.name.includes('NewPaint'));
  const paint=[];view.root.traverse(o=>{if(o.isMesh&&o.material.name?.includes('NewPaint'))paint.push(o.material);});
  assert.ok(paint.length>0);
  paint.forEach(m=>{
   assert.equal(m.metalness,.34);assert.equal(m.roughness,.26);assert.equal(m.clearcoat,.8);assert.equal(m.clearcoatRoughness,.16);
   assert.ok(m.color.equals(new THREE.Color().fromArray(authored.pbrMetallicRoughness.baseColorFactor)),'Polish preserves each authored vehicle colour');
  });
  root.traverse(o=>{if(o.isMesh&&o.material.name?.includes('NewPaint')){
   assert.equal(o.material.metalness,authored.pbrMetallicRoughness.metallicFactor);assert.equal(o.material.roughness,authored.pbrMetallicRoughness.roughnessFactor);
  }});
 }
 assert.ok(view.spec.wheelRadius>.3&&view.spec.wheelRadius<.4);
 const state={position:{x:12,y:3,z:-8},rotation:{x:0,y:Math.sin(.3),z:0,w:Math.cos(.3)},wheels:[0,1,2,3].map(i=>({y:.31+i*.01,rotation:2.5,steering:i%2===1?.23:0}))};
 const calipers=view.wheels.map(w=>w.steering.getObjectByName('Fixed_brake_caliper')||w.steering.getObjectByName('Fixed brake caliper')||w.steering.children.find(c=>c!==w.spin));
 // Select actual brake-rotor/caliper geometry's node: it must stay out of spin.
 assert.ok(calipers.every(Boolean));
 poseVehicle(view,state);view.root.updateMatrixWorld(true);
 view.wheels.forEach((w,i)=>{
  assert.equal(w.steering.rotation.y,state.wheels[i].steering);
  assert.equal(w.spin.rotation.x,2.5);
  assert.equal(w.pivot.position.y,state.wheels[i].y);
  assert.ok(Math.abs(other.wheels[i].spin.rotation.x)<1e-12,'Instances must not animate each other');
  const center=w.spin.getWorldPosition(new THREE.Vector3()),expected=new THREE.Vector3(w.center.x,state.wheels[i].y,w.center.z).applyQuaternion(view.root.quaternion).add(view.root.position);
  assert.ok(center.distanceTo(expected)<1e-6,'Suspension and visual contact centre share the chassis frame');
 });
 const before=calipers.map(c=>c.getWorldQuaternion(new THREE.Quaternion()));
 poseVehicle(view,{...state,wheels:state.wheels.map(w=>({...w,rotation:-8}))});view.root.updateMatrixWorld(true);
 calipers.forEach((c,i)=>assert.ok(c.getWorldQuaternion(new THREE.Quaternion()).angleTo(before[i])<1e-7,'Brake caliper must not roll with the tyre'));
 const next={...state,position:{x:16,y:4,z:-6},wheels:state.wheels.map(w=>({...w,y:w.y+.08,rotation:4.5,steering:w.steering+.04}))};
 poseVehicle(view,next,.6,state,.5);
 assert.ok(Math.abs(view.root.position.x-14)<1e-9);
 assert.ok(Math.abs(view.wheels[0].pivot.position.y-(state.wheels[0].y+.04))<1e-9);
 assert.equal(view.wheels[0].spin.rotation.x,3.5,'Unwrapped rotation must interpolate without reversing a spinning wheel');
 view.dispose();other.dispose();
});

for(const {id} of VEHICLES)test(`${id}: visible hubs match physical suspension centres at pitch/roll and full inversion`,()=>{
 const {root}=authoredTemplate(id),view=createVehicleView(root,id);
 for(const [axis,angle] of [[new THREE.Vector3(1,0,0),.3],[new THREE.Vector3(0,0,1),.5],[new THREE.Vector3(0,0,1),Math.PI]]){
  const q=new THREE.Quaternion().setFromAxisAngle(axis,angle),p=new THREE.Vector3(4,3,-2);
  const s={position:p,rotation:q,wheels:[0,1,2,3].map(i=>({y:.7-(.27+i*.01),rotation:1,steering:0}))};
  poseVehicle(view,s);view.root.updateMatrixWorld(true);
  view.wheels.forEach((w,i)=>{
   const actual=w.spin.getWorldPosition(new THREE.Vector3());
   const expected=new THREE.Vector3(w.center.x,.1-(.27+i*.01),w.center.z).applyQuaternion(q).add(p);
   assert.ok(actual.distanceTo(expected)<1e-6,`${id}: visual hub detaches from physical suspension when tilted`);
  });
 }
 view.dispose();
});
