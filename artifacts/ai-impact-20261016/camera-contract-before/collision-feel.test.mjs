import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3,Quaternion} from 'three';
import {createCollisionResponse} from '../src/driving/collisionResponse.js';
import {createChaseCamera} from '../src/driving/chaseCamera.js';
import {createFirstPersonCamera} from '../src/rebuild/firstPersonCamera.js';
import {contactFeedback} from '../src/rebuild/raceContacts.js';
import {audioMix,impactMix} from '../src/driving/drivingAudio.js';
test('solver collision recovery ignores vertical support, stays bounded, expires and resets',()=>{
 const r=createCollisionResponse(),v={x:0,y:-20,z:25};r.observe(v,{...v,y:0});assert.equal(r.snapshot().severity,0);
 r.observe(v,{...v,z:24});assert.equal(r.snapshot().powerScale,1);
 const before={...v};r.observe(v,{x:8,y:0,z:0});assert.deepEqual(v,before);assert.equal(r.snapshot().severity,1);
 assert.ok(r.snapshot().powerScale>=.52);assert.ok(r.snapshot().rearGripScale>=.86);
 const frozen=r.snapshot();r.update(0);assert.deepEqual(r.snapshot(),frozen);
 for(let i=0;i<120;i++)r.update(1/120);assert.equal(r.snapshot().powerScale,1);assert.equal(r.snapshot().rearGripScale,1);
 r.reset();assert.equal(r.snapshot().peakDeltaV,0);
});
test('floor contact and tiny touches cannot look like crashes; grazing and car impacts differ',()=>{
 assert.equal(contactFeedback(10,{x:0,y:1,z:0},{x:0,z:30}),null);
 assert.equal(contactFeedback(.1,{x:1,y:0,z:0},{x:.1,z:0}),null);
 const scrape=contactFeedback(.1,{x:1,y:0,z:0},{x:1,z:30});assert.equal(scrape.kind,'scrape');
 assert.equal(contactFeedback(3,{x:1,y:0,z:0},{x:10,z:30},true).kind,'impact');
 const body=impactMix(1,{otherVehicle:true}),wall=impactMix(1),graze=impactMix(.3,scrape);
 assert.ok(body.body>wall.body);assert.ok(wall.metal>body.metal);assert.ok(graze.body<body.body);
 assert.ok(audioMix({kmh:100,surface:{scrape:1}}).scrape>0);assert.equal(audioMix({kmh:0,surface:{scrape:1}}).scrape,0);
});
test('stable chase has a brief contact-only kick and no steady wobble, pause/reduced motion respected',()=>{
 const camera=new PerspectiveCamera(),chase=createChaseCamera(camera),p=new Vector3(0,1,0),f=new Vector3(0,0,1),base={stableRide:true,pedalResponse:true};
 chase.update(p,f,80,1/60,{...base,snap:true});const rest=camera.position.y;
 chase.update(p,f,80,1/60,{...base,impact:1});assert.ok(Math.abs(camera.position.y-rest)>.03);assert.ok(Math.abs(camera.position.y-rest)<.13);
 const held=camera.position.clone();chase.update(p,f,80,0,base);assert.ok(camera.position.distanceTo(held)<1e-9);
 for(let i=0;i<90;i++)chase.update(p,f,80,1/60,base);assert.ok(Math.abs(camera.position.y-rest)<.0001);
 chase.update(p,f,80,1/60,{...base,motion:false,impact:1});assert.equal(camera.position.y,rest);
});
test('cockpit impact never shifts the driver eye, freezes and rolls less than one degree',()=>{
 const camera=new PerspectiveCamera(),rig=createFirstPersonCamera(camera),p=new Vector3(0,0,0),q=new Quaternion(),base={pedalResponse:true,motion:true,kmh:80};
 rig.update(p,q,1/60,{...base,snap:true});const eye=camera.position.clone(),rest=camera.quaternion.clone();
 rig.update(p,q,1/60,{...base,impact:1});assert.equal(camera.position.distanceTo(eye),0);assert.ok(camera.quaternion.angleTo(rest)>0);assert.ok(camera.quaternion.angleTo(rest)<Math.PI/180);
 const held=camera.quaternion.clone();rig.update(p,q,0,base);assert.ok(camera.quaternion.angleTo(held)<1e-7);
 rig.update(p,q,1/60,{...base,motion:false,impact:1});assert.ok(camera.quaternion.angleTo(rest)<1e-7);
});
