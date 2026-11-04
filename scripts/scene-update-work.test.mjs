import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createDecorationQuality} from '../src/rebuild/graphicsQuality.js';
import {createNamakVisuals} from '../src/rebuild/namakVisuals.js';

test('unlimited decoration performs no distance work and restores exact visibility each frame',()=>{
 const world=new THREE.Group(),camera=new THREE.PerspectiveCamera(),g=new THREE.BoxGeometry(20,20,20),m=new THREE.MeshStandardMaterial();
 for(let i=0;i<100;i++){const o=new THREE.Mesh(g,m);o.name='Visual_'+i;o.position.set(i*40,0,i*70);o.visible=i%7!==0;world.add(o);}
 const original=world.children.map(o=>o.visible),q=createDecorationQuality(world),distanceTo=THREE.Vector3.prototype.distanceTo;let calls=0;
 q.set(Infinity);THREE.Vector3.prototype.distanceTo=function(v){calls++;return distanceTo.call(this,v);};
 try{for(let frame=0;frame<120;frame++){camera.position.x=frame;world.children[1].visible=false;q.update(camera);assert.deepEqual(world.children.map(o=>o.visible),original);}assert.equal(calls,0);}
 finally{THREE.Vector3.prototype.distanceTo=distanceTo;q.dispose();g.dispose();m.dispose();}
});

test('finite culling, invalid camera coordinates and disposal retain original visibility policy',()=>{
 const world=new THREE.Group(),camera=new THREE.PerspectiveCamera(),g=new THREE.BoxGeometry(80,2,80),m=new THREE.MeshStandardMaterial();
 const a=new THREE.Mesh(g,m),b=new THREE.Mesh(g,m),hidden=new THREE.Mesh(g,m);a.position.z=160;b.position.z=600;hidden.visible=false;world.add(a,b,hidden);
 const q=createDecorationQuality(world);
 try{
  q.set(140);q.update(camera);assert.equal(a.visible,true);assert.equal(b.visible,false);
  q.set(Infinity);q.update(camera);assert.equal(b.visible,true);assert.equal(hidden.visible,false);
  for(const invalid of [NaN,Infinity,-Infinity]){camera.position.x=invalid;q.update(camera);assert.deepEqual(world.children.map(o=>o.visible),[!Number.isNaN(invalid),!Number.isNaN(invalid),false]);}
  camera.position.x=0;q.set(500);q.update(camera);assert.equal(b.visible,false);assert.equal(q.status().hidden,1);
 }finally{q.dispose();assert.ok(a.visible&&b.visible);assert.equal(hidden.visible,false);g.dispose();m.dispose();}
});

test('unlimited culling does not expose decorations with malformed cached bounds',()=>{
 const world=new THREE.Group(),camera=new THREE.PerspectiveCamera(),g=new THREE.BoxGeometry(),m=new THREE.MeshStandardMaterial();
 g.boundingSphere=new THREE.Sphere(new THREE.Vector3(NaN,0,0),1);g.computeBoundingSphere=()=>{};
 const mesh=new THREE.Mesh(g,m);world.add(mesh);const q=createDecorationQuality(world);
 try{q.set(Infinity);q.update(camera);assert.equal(mesh.visible,false);}finally{q.dispose();g.dispose();m.dispose();}
});

test('Namak reuses one scratch sphere through moving world and quality changes',()=>{
 const route=JSON.parse(fs.readFileSync(new URL('../public/assets/rebuild/namak-route.json',import.meta.url))),scene=new THREE.Scene(),world=new THREE.Group();scene.add(world);
 const visual=createNamakVisuals(scene,world,route),camera=new THREE.PerspectiveCamera();camera.position.set(150,5,0);
 const copy=THREE.Sphere.prototype.copy,receivers=new Set();THREE.Sphere.prototype.copy=function(v){receivers.add(this);return copy.call(this,v);};
 try{for(let i=0;i<20;i++){if(i===10)visual.setQuality('medium');world.position.x=i*5;visual.update(camera,1/60,i*.25,true);}assert.equal(receivers.size,1);assert.ok(visual.stats.visibleDrawCalls>0);}
 finally{THREE.Sphere.prototype.copy=copy;visual.dispose();}
});
