import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createVehicleView,poseVehicle} from '../../src/rebuild/assets.js';
import {applyBodyMotion} from '../../src/rebuild/bodyMotion.js';
import {VEHICLES} from '../../src/rebuild/fleet.js';
import {batchStaticMeshes} from '../../src/garage/batchStatic.js';
function authoredTemplate(id){
 const buffer=fs.readFileSync(new URL(`../../public/assets/rebuild/${id}.glb`,import.meta.url));
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

const results=[];
for(const {id} of VEHICLES){
 const {root}=authoredTemplate(id),view=createVehicleView(root,id);
 const state={position:{x:4,y:.6,z:-2},rotation:{x:0,y:Math.sin(.3),z:0,w:Math.cos(.3)},velocity:{x:0,y:0,z:0},wheels:[0,1,2,3].map(i=>({y:.34,rotation:i,steering:i%2?.22:0}))};
 poseVehicle(view,state);view.root.updateMatrixWorld(true);
 const tyres=view.wheels.map(w=>new THREE.Box3().setFromObject(w.spin));
 const centres=view.wheels.map(w=>w.spin.getWorldPosition(new THREE.Vector3()));
 const rootMatrix=view.root.matrixWorld.clone();let maximumCentreDelta=0,maximumTyreBoundsDelta=0;const poses=[];
 for(const velocity of [{x:0,y:0,z:100},{x:0,y:0,z:-100},{x:100,y:0,z:0},{x:-100,y:0,z:0},{x:100,y:0,z:100},{x:-100,y:0,z:-100}]){
  view.motion.reset();const next={...state,velocity};
  for(let i=0;i<180;i++)applyBodyMotion(view,state,next,1/60,{sampleSeconds:.1});
  view.root.updateMatrixWorld(true);assert.ok(view.root.matrixWorld.equals(rootMatrix));
  view.wheels.forEach((w,i)=>{
   const delta=w.spin.getWorldPosition(new THREE.Vector3()).distanceTo(centres[i]);
   const bounds=new THREE.Box3().setFromObject(w.spin);
   const boundsDelta=Math.max(bounds.min.distanceTo(tyres[i].min),bounds.max.distanceTo(tyres[i].max));
   maximumCentreDelta=Math.max(maximumCentreDelta,delta);maximumTyreBoundsDelta=Math.max(maximumTyreBoundsDelta,boundsDelta);
   assert.ok(delta<1e-8&&boundsDelta<1e-8,`${id}: visual chassis changed a tyre/contact bound`);
  });
  poses.push({pitchDegrees:view.body.rotation.x*180/Math.PI,rollDegrees:view.body.rotation.z*180/Math.PI});
 }
 results.push({id,source:'actual Blender-exported GLB node transforms and geometry bounds; box proxies instead of decoded Draco vertices',scenarios:poses.length,maximumCentreDelta,maximumTyreBoundsDelta,rootMatrixUnchanged:true,poses});view.dispose();
}
fs.writeFileSync(new URL('fleet-motion-clearance.json',import.meta.url),JSON.stringify({device:'Local Node CPU',results},null,2));console.log(results.map(({id,maximumCentreDelta,maximumTyreBoundsDelta})=>({id,maximumCentreDelta,maximumTyreBoundsDelta})));
