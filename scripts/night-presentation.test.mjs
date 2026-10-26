import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createNightPresentation,NIGHT_LIGHTING} from '../src/rebuild/nightPresentation.js';
import {polishWorldSurfaces} from '../src/rebuild/surfacePolish.js';

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

// Opt-in illumination must not brighten every map or alter the collision mesh.
test('night asphalt stays separate from daylight with unchanged geometry and surface texture budget',()=>{
 const setup=()=>{const root=new THREE.Group(),road=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshStandardMaterial({name:'Asphalt'})),kerb=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({name:'Concrete',color:'#536171'}));root.add(road,kerb);return {root,road,kerb};};
 const day=setup(),night=setup(),geometry=night.road.geometry,positions=geometry.attributes.position.array.slice(),kerb=night.kerb.material.color.clone();
 const a=polishWorldSurfaces(day.root),b=polishWorldSurfaces(night.root,{night:true});
 assert.equal(a.textureBytes,b.textureBytes);assert.equal(a.surfaces,b.surfaces);
 assert.deepEqual(day.road.material.color.toArray(),[.018,.022,.027],'daylight calibration retained');
 assert.ok(night.road.material.color.r>day.road.material.color.r&&night.road.material.color.b>night.road.material.color.r,'readable cool asphalt');
 assert.ok(night.road.material.color.b<.08,'asphalt stays dark enough for white/yellow line contrast');
 assert.equal(night.road.geometry,geometry);assert.deepEqual(geometry.attributes.position.array,positions);assert.ok(night.kerb.material.color.equals(kerb));
 const resources=new Set();for(const x of [day,night])x.root.traverse(o=>{if(o.isMesh){resources.add(o.geometry);resources.add(o.material);resources.add(o.material.surfaceGrain);}});for(const r of resources)r?.dispose();
});
