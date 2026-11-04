import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createRoadscape} from '../src/rebuild/roadscape.js';
const fixture=()=>{
 const root=new THREE.Group(),geometry=new THREE.BoxGeometry(40,10,40),material=new THREE.MeshStandardMaterial();
 const near=new THREE.Mesh(geometry,material),edge=new THREE.Mesh(geometry,material),far=new THREE.Mesh(geometry,material),detail=new THREE.Mesh(geometry,material);
 edge.position.x=310;far.position.x=500;detail.userData.roadscapeTier=3;root.add(near,edge,far,detail);
 return {root,near,edge,far,detail,geometry,material,camera:new THREE.PerspectiveCamera()};
};
test('roadside cells retain near bounds, respect tiers, and low quality adds no draws',()=>{
 const f=fixture(),view=createRoadscape(f.root);
 view.update(f.camera,0,0,true);assert.equal(f.edge.visible,true,'cell intersects the display distance');assert.equal(f.far.visible,false);assert.equal(view.stats.calls,3);
 view.setQuality('medium');view.update(f.camera,0,0,true);assert.equal(f.detail.visible,false);assert.equal(f.edge.visible,false);assert.equal(view.stats.calls,1);
 view.setQuality('low');view.update(f.camera,0,0,true);assert.equal(f.root.visible,false);assert.equal(view.stats.calls,0);
 view.setQuality('high');view.update(f.camera,0,0,true);assert.equal(f.root.visible,true);assert.equal(view.stats.calls,3);
 view.dispose();f.geometry.dispose();f.material.dispose();
});
test('garage hides the extension and visibility changes do not alter transforms or shared resources',()=>{
 const f=fixture();f.root.position.set(40,12,-30);f.root.updateMatrixWorld(true);
 const entries=f.root.children.map(o=>({o,matrix:o.matrixWorld.toArray(),geometry:o.geometry,material:o.material}));
 let disposed=0;f.geometry.addEventListener('dispose',()=>disposed++);f.material.addEventListener('dispose',()=>disposed++);
 const view=createRoadscape(f.root);view.update(f.camera,1,20,true);view.update(f.camera,0,20,false);assert.equal(f.root.visible,false);
 view.dispose();view.dispose();assert.equal(disposed,0);assert.equal(f.root.visible,true);assert.ok(f.root.children.every(o=>o.visible));
 for(const e of entries){assert.deepEqual(e.o.matrixWorld.toArray(),e.matrix);assert.equal(e.o.geometry,e.geometry);assert.equal(e.o.material,e.material);assert.equal(e.o.userData.unity_collider,undefined);}
 view.update(f.camera,0,0,false);assert.equal(f.root.visible,true,'disposed controller no longer touches visibility');
 f.geometry.dispose();f.material.dispose();
});
test('absent extensions and originally hidden art stay hidden',()=>{
 assert.equal(createRoadscape(null),null);const f=fixture();f.near.visible=false;
 const view=createRoadscape(f.root);view.update(f.camera,0,0,true);assert.equal(f.near.visible,false);view.dispose();assert.equal(f.near.visible,false);
 f.geometry.dispose();f.material.dispose();
});

test('ground supporting distant buildings survives decoration culling and low quality',()=>{
 const f=fixture();f.far.userData.roadscapeFoundation=true;
 const view=createRoadscape(f.root);view.update(f.camera,0,0,true);
 assert.equal(f.far.visible,true);assert.equal(view.stats.foundations,1);
 view.setQuality('low');f.camera.position.x=400;view.update(f.camera,0,0,true);
 assert.equal(f.far.visible,true);assert.equal(f.near.visible,false);assert.equal(view.stats.calls,1);
 view.update(f.camera,0,0,false);assert.equal(f.root.visible,false);
 view.dispose();f.geometry.dispose();f.material.dispose();
});
