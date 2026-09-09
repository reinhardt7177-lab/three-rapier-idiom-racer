import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBodyGeometry,deckHeight } from '../src/garage/gtBody.js';
import { createGT,GT_SPEC } from '../src/garage/gt.js';
import { applyWheelPose } from '../src/driving/steering.js';

test('body shell is watertight, finite and has outward front/rear/deck faces',()=>{
  const g=createBodyGeometry(),p=g.attributes.position,ids=g.index.array,edges=new Map();
  for(const value of p.array)assert.ok(Number.isFinite(value));
  for(let i=0;i<ids.length;i+=3)for(const [a,b] of [[ids[i],ids[i+1]],[ids[i+1],ids[i+2]],[ids[i+2],ids[i]]]){
    const key=[Math.min(a,b),Math.max(a,b)].join(':');edges.set(key,(edges.get(key)||0)+1);
  }
  assert.ok([...edges.values()].every(n=>n===2),'all indexed edges have two faces');
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial());m.updateMatrixWorld();
  for(const [origin,direction] of [[[0,.7,4],[0,0,-1]],[[0,.7,-4],[0,0,1]],[[0,3,1.42],[0,-1,0]]]) {
    assert.ok(new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(...direction)).intersectObject(m).length>0);
  }
  const floor=new THREE.Raycaster(new THREE.Vector3(0,-1,1.42),new THREE.Vector3(0,1,0)).intersectObject(m)[0];
  assert.ok(Math.abs(floor.point.y-.3)<.001,'wheel arch does not lift the central floor');
  const hood=new THREE.Raycaster(new THREE.Vector3(0,3,1.42),new THREE.Vector3(0,-1,0)).intersectObject(m)[0];
  assert.ok(Math.abs(hood.point.y-deckHeight(1.42))<.001);
  g.dispose();m.material.dispose();
});

test('car batching preserves wheels, paint, brake lamps and a bounded mesh count',()=>{
  const gt=createGT();let count=0;gt.root.traverse(o=>{if(o.isMesh)count++;});
  assert.ok(count<40,`mesh count ${count}`);
  const expected=[[-1,-1],[-1,1],[1,-1],[1,1]];
  gt.wheels.forEach((w,i)=>{assert.equal(w.pivot.position.x,expected[i][0]*GT_SPEC.track/2);assert.equal(w.pivot.position.z,expected[i][1]*GT_SPEC.wheelbase/2);assert.ok(w.spin.parent===w.pivot);});
  const pose=gt.wheels.map((_,i)=>({y:.45,steering:i%2?.3:0,rotation:2}));
  applyWheelPose(gt.wheels,pose,pose,1);
  assert.equal(gt.wheels[1].pivot.rotation.y,.3);assert.equal(gt.wheels[0].pivot.rotation.y,0);
  gt.setColor('#b34d31');assert.equal(gt.paint.color.getHexString(),'b34d31');
  assert.ok(gt.wheels.every(w=>w.spin.children.length>0));
  const materials=new Set(),geometries=new Set();gt.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
});
