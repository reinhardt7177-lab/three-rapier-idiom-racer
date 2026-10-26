import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {applyKoreaPalette} from '../src/rebuild/koreaPresentation.js';
import {createNightPresentation} from '../src/rebuild/nightPresentation.js';

test('course colours preserve collision geometry and leave existing courses untouched',()=>{
 const root=new THREE.Group(),m=new THREE.MeshStandardMaterial({color:'red'});m.name='Leaf';
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(),m);mesh.userData.unity_collider=true;root.add(mesh);
 const before=mesh.geometry.attributes.position.array.slice(),id=mesh.geometry.uuid;
 assert.equal(applyKoreaPalette(root,'namak'),null);assert.equal(m.color.getHexString(),'ff0000');
 const stats=applyKoreaPalette(root,'seongsamjae');assert.equal(stats.materials,1);
 assert.ok(m.color.g>m.color.r&&m.color.g>m.color.b);assert.equal(mesh.geometry.uuid,id);
 assert.deepEqual(mesh.geometry.attributes.position.array,before);assert.equal(mesh.userData.unity_collider,true);
});
test('night lamps retain authored emission and shared materials are graded once',()=>{
 const root=new THREE.Group(),m=new THREE.MeshStandardMaterial({emissive:'#ff0077',emissiveIntensity:2.7});m.name='Pink';
 root.add(new THREE.Mesh(new THREE.BoxGeometry(),m),new THREE.Mesh(new THREE.BoxGeometry(),m));
 const emission=m.emissive.clone();assert.equal(applyKoreaPalette(root,'yeosu').emissiveMaterials,1);
 assert.equal(m.toneMapped,false);assert.equal(m.emissiveIntensity,2.7);assert.ok(m.emissive.equals(emission));
});
test('night sky follows camera, has no extra lights or render pass, and disposes on course exit',()=>{
 const scene=new THREE.Scene(),route={points:[{x:0,y:8,z:0,dx:1,dz:0}]};
 const night=createNightPresentation(scene,route),sky=scene.getObjectByName('Yeosu_Night_Gradient');
 let geometryDisposed=0,materialDisposed=0;sky.geometry.addEventListener('dispose',()=>geometryDisposed++);sky.material.addEventListener('dispose',()=>materialDisposed++);
 const state={position:new THREE.Vector3(),rotation:new THREE.Quaternion()},camera=new THREE.Vector3(123,45,678);
 night.update(state,0,true,camera);assert.ok(sky.position.equals(camera));assert.equal(sky.material.depthWrite,false);
 assert.equal(night.stats.lights,6);assert.equal(night.stats.reflectionPasses,0);assert.equal(night.stats.shadowMaps,0);assert.ok(night.stats.skyTriangles<600);
 night.update(state,0,false,camera);assert.equal(sky.parent.visible,false);
 night.dispose();assert.equal(geometryDisposed,1);assert.equal(materialDisposed,1);assert.equal(scene.children.length,0);
});
