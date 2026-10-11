import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createNightPresentation,NIGHT_LIGHTING} from '../src/rebuild/nightPresentation.js';

test('night headlights follow vehicle yaw, illuminate ahead and hide outside a race',()=>{
 const scene=new THREE.Scene(),route={points:Array.from({length:90},(_,i)=>({x:i*2,y:8,z:0,dx:1,dz:0}))};
 const night=createNightPresentation(scene,route),group=scene.getObjectByName('Night_Road_Lights');
 assert.equal(group.visible,false);
 const lights=group.children.filter(o=>o.isLight),heads=lights.filter(o=>o.isSpotLight);
 assert.equal(lights.length,6);assert.ok(lights.every(o=>!o.castShadow));
 const state={position:new THREE.Vector3(40,9,0),rotation:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2)};
 night.update(state,20,true);
 assert.equal(group.visible,true);
 for(const head of heads){
  const direction=head.target.position.clone().sub(head.position).normalize();
  assert.ok(direction.x>.99&&direction.y<0&&Math.abs(direction.z)<1e-6,'beam follows the rotated car, not world north');
  assert.ok(head.position.distanceTo(state.position)<2.2);
 }
 assert.ok(NIGHT_LIGHTING.ambient>0&&NIGHT_LIGHTING.exposure>0);
 night.update(state,20,false);assert.equal(group.visible,false);
 night.dispose();assert.equal(scene.children.length,0);
});
