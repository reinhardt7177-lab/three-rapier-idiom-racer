import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCoastalVisuals} from '../src/rebuild/coastalVisuals.js';
import {freezeStaticWorld} from '../src/rebuild/staticWorld.js';
import {Sky} from 'three/addons/objects/Sky.js';
import {createDaylightSky} from '../src/rebuild/daylightSky.js';

test('coastal material detail retains geometry/colliders, composes existing hooks and restores shared owners',()=>{
 const scene=new THREE.Scene(),world=new THREE.Group();scene.add(world);
 const geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial({name:'Water'});let calls=0;
 material.onBeforeCompile=s=>{calls++;s.uniforms.original={value:7};};material.customProgramCacheKey=()=> 'original';
 const mesh=new THREE.Mesh(geometry,material);mesh.userData.unity_collider=true;world.add(mesh);world.add(new THREE.Mesh(geometry,material));
 const vertices=geometry.attributes.position.array.slice(),matrix=mesh.matrix.clone(),v=createCoastalVisuals(scene,world,{},{});
 assert.notEqual(mesh.material,material);assert.equal(world.children[1].material,mesh.material);assert.deepEqual(geometry.attributes.position.array,vertices);assert.ok(mesh.matrix.equals(matrix));assert.equal(mesh.userData.unity_collider,true);
 const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>\n#include <normal_fragment_maps>'};mesh.material.onBeforeCompile(shader);
 assert.equal(calls,1);assert.equal(shader.uniforms.original.value,7);assert.match(shader.fragmentShader,/coastalRelief/);assert.match(mesh.material.customProgramCacheKey(),/original-coastal-water/);
 v.update(null,.1,5,true);assert.equal(shader.uniforms.coastalTime.value,5);v.update(null,0,6,true);assert.equal(shader.uniforms.coastalTime.value,5);v.setQuality({id:'low'});assert.equal(shader.uniforms.coastalDetail.value,0);
 let disposed=0;mesh.material.addEventListener('dispose',()=>disposed++);v.dispose();v.dispose();assert.equal(disposed,1);assert.equal(mesh.material,material);assert.equal(v.stats.addedDraws,0);assert.equal(v.stats.addedTriangles,0);
 geometry.dispose();material.dispose();
});

test('static world avoids repeated transform composition while moving children keep updating',()=>{
 const scene=new THREE.Scene(),world=new THREE.Group();world.position.set(5,2,3);scene.add(world);
 const geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial(),fixed=new THREE.Mesh(geometry,material),moving=new THREE.Group(),wheel=new THREE.Mesh(geometry,material);
 fixed.position.set(4,1,2);moving.userData.dynamic=true;moving.add(wheel);world.add(fixed,moving);scene.updateMatrixWorld(true);const before=fixed.matrixWorld.clone(),vertices=geometry.attributes.position.array.slice();
 const frozen=freezeStaticWorld(world);let fixedCalls=0,movingCalls=0;const a=fixed.updateMatrix,b=wheel.updateMatrix;
 fixed.updateMatrix=function(){fixedCalls++;return a.call(this);};wheel.updateMatrix=function(){movingCalls++;return b.call(this);};wheel.position.x=3;
 for(let i=0;i<120;i++)scene.updateMatrixWorld(true);
 assert.equal(fixedCalls,0);assert.equal(movingCalls,120);assert.ok(fixed.matrixWorld.equals(before));assert.equal(wheel.getWorldPosition(new THREE.Vector3()).x,8);assert.deepEqual(geometry.attributes.position.array,vertices);
 frozen.dispose();frozen.dispose();assert.equal(fixed.matrixAutoUpdate,true);assert.equal(fixed.matrixWorldAutoUpdate,true);scene.updateMatrixWorld(true);assert.equal(fixedCalls,1);
 geometry.dispose();material.dispose();
});

test('static disposal restores pre-existing manual flags without turning the world into a movable shortcut',()=>{
 const root=new THREE.Group(),manual=new THREE.Object3D();manual.matrixAutoUpdate=false;manual.matrixWorldAutoUpdate=false;root.add(manual);
 const f=freezeStaticWorld(root);assert.equal(f.stats.frozenObjects,2);f.dispose();assert.equal(manual.matrixAutoUpdate,false);assert.equal(manual.matrixWorldAutoUpdate,false);assert.equal(root.matrixAutoUpdate,true);
});

test('daylight cloud quality skips the expensive default branch at low quality and pauses/reset time correctly',()=>{
 const sky=new Sky(),u=sky.material.uniforms,old=u.cloudCoverage.value,v=createDaylightSky(sky,'coastal');
 assert.ok(u.cloudCoverage.value>old);v.update(.016,4);assert.equal(u.time.value,4);v.update(0,5);assert.equal(u.time.value,4);v.update(.016,0);assert.equal(u.time.value,0);
 v.setQuality({id:'low'});assert.equal(u.cloudCoverage.value,0);assert.equal(v.stats.addedDraws,0);v.setQuality({id:'high'});assert.ok(u.cloudCoverage.value>old);
 v.dispose();v.dispose();assert.equal(u.cloudCoverage.value,old);sky.geometry.dispose();sky.material.dispose();
});
