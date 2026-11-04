import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion,PerspectiveCamera} from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {createExhaustVfx,exhaustPoints} from '../src/rebuild/exhaustVfx.js';
import {createTireSmoke,SMOKE_LIMIT} from '../src/driving/tireSmoke.js';
import {createTireFeedback} from '../src/driving/tireFeedback.js';
import {createDrivingSignals} from '../src/driving/drivingSignals.js';
import {createChaseCamera} from '../src/driving/chaseCamera.js';
import {createVehiclePhysics,initPhysics,STEP} from '../src/driving/physics.js';
import {RACE_TUNING} from '../src/rebuild/vehicleDynamics.js';
await initPhysics();
const specs={supra:{track:1.59,wheelbase:2.47,wheelRadius:.35},slk:{track:1.55,wheelbase:2.43,wheelRadius:.34},mustang:{track:1.62,wheelbase:2.72,wheelRadius:.365}};
const fixture=(speed=15,fields={})=>({position:{x:0,y:.6,z:0},rotation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:speed},speed,contacts:4,drive:0,brake:0,handbrake:false,wheels:[0,1,2,3].map(i=>({contact:true,point:{x:i<2?-.8:.8,y:0,z:i%2?-1.2:1.2},normal:{x:0,y:1,z:0},steering:0})),...fields});

test('dual exhaust emits at each authored car outlet under translation and heading, not body centre',()=>{
 const q=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI/2);
 for(const id of Object.keys(specs)){
  const exhaust=createExhaustVfx(),emitters=exhaustPoints(id),state=fixture(0,{position:{x:10,y:4,z:20},rotation:{x:q.x,y:q.y,z:q.z,w:q.w}});
  exhaust.update(state,emitters,1/18);
  assert.equal(exhaust.stats().live,2);assert.ok(exhaust.root.geometry.isInstancedBufferGeometry);
  for(let i=0;i<2;i++){
   const expected=emitters[i].clone().applyQuaternion(q).add(new Vector3(10,3.4,20));
   const actual=new Vector3().fromBufferAttribute(exhaust.root.geometry.attributes.aCenter,i);assert.ok(actual.distanceTo(expected)<1e-5);
   assert.ok(Math.abs(emitters[i].x)>.6&&emitters[i].z<-2&&emitters[i].y<.4);
  }
  exhaust.dispose();
 }
});

test('exhaust remains in world space, freezes with pause, fades when disabled and clears at recovery',()=>{
 const exhaust=createExhaustVfx(),s=fixture(0),emitters=exhaustPoints('supra');
 for(let i=0;i<300;i++)exhaust.update(s,emitters,STEP);
 assert.ok(exhaust.stats().live>15&&exhaust.stats().live<=96);
 const attribute=exhaust.root.geometry.attributes.aCenter,first=attribute.array.slice(0,3),frozen=attribute.array.slice();
 exhaust.update(fixture(0,{position:{x:500,y:.6,z:0}}),emitters,0);assert.deepEqual(attribute.array,frozen);
 exhaust.update(fixture(0,{position:{x:500,y:.6,z:0}}),emitters,STEP,{enabled:false});assert.ok(Math.abs(attribute.array[0]-first[0])<.1,'old vapour must not follow a teleport');
 for(let i=0;i<160;i++)exhaust.update(s,emitters,STEP,{enabled:false});assert.equal(exhaust.stats().live,0);
 exhaust.update(s,emitters,.1);assert.ok(exhaust.stats().live>0);exhaust.clear();assert.equal(exhaust.stats().live,0);assert.equal(exhaust.root.visible,false);exhaust.dispose();
});

test('straight handbrake creates rear scrub in either direction, never stationary or airborne smoke',()=>{
 const reader=createDrivingSignals(),smoke=createTireSmoke({billboards:true,strong:true}),trails=createTireFeedback();
 for(const speed of [15,-15]){
  const s=fixture(speed,{handbrake:true});reader.reset();const signals=reader.update(s,s,STEP);
  assert.ok(signals.wheelSlip[0]>.8&&signals.wheelSlip[2]>.8);assert.equal(signals.wheelSlip[1],0);assert.equal(signals.wheelSlip[3],0);
  smoke.clear();trails.clear();for(let i=0;i<80;i++){
   const moving=fixture(speed,{handbrake:true,position:{x:0,y:.6,z:i*.15},wheels:s.wheels.map(w=>({...w,point:{...w.point,z:w.point.z+i*.15}}))});
   smoke.update(moving,signals,STEP);trails.update(moving,signals,STEP);
  }
  assert.ok(smoke.stats().live>30&&smoke.stats().live<=SMOKE_LIMIT);assert.ok(trails.stats().used>20);
 }
 const air=fixture(15,{contacts:0,handbrake:true,brake:1,wheels:fixture().wheels.map(w=>({...w,contact:false}))});
 for(let i=0;i<200;i++)smoke.update(air,reader.update(air,air,STEP),STEP);assert.equal(smoke.stats().live,0);
 smoke.clear();const stopped=fixture(0,{handbrake:true,brake:1,drive:1});for(let i=0;i<100;i++)smoke.update(stopped,reader.update(stopped,stopped,STEP),STEP);assert.equal(smoke.stats().live,0);
 assert.equal(smoke.root.geometry.index.count,6,'one instanced quad, not hardware-limited points');smoke.dispose();trails.dispose();
});

test('all three real race cars produce braking smoke and marks without VFX changing physics',()=>{
 for(const id of Object.keys(specs)){
  const options={barriers:false,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec:specs[id],raceTuning:RACE_TUNING[id],start:{x:0,y:.85,z:-600}};
  const sim=createVehiclePhysics(options),control=createVehiclePhysics(options),reader=createDrivingSignals(),smoke=createTireSmoke({billboards:true,strong:true}),trails=createTireFeedback();let previous=sim.snapshot(),peak=0,marks=0;
  try{
   for(let i=0;i<900;i++){
    const input=i<120?{brake:1}:i<700?{throttle:1}:{brake:1},s=sim.step(input),baseline=control.step(input),signals=reader.update(previous,s,STEP);previous=s;
    smoke.update(s,signals,STEP);trails.update(s,signals,STEP);if(i>=700){peak=Math.max(peak,smoke.stats().live);marks=Math.max(marks,trails.stats().used);}
    assert.deepEqual(s.position,baseline.position);assert.deepEqual(s.rotation,baseline.rotation);
   }
   assert.ok(peak>30,`${id}: braking smoke ${peak}`);assert.ok(marks>20,`${id}: skid marks ${marks}`);console.log({id,brakingParticles:peak,skidSegments:marks});
  }finally{sim.dispose();control.dispose();smoke.dispose();trails.dispose();}
 }
});

test('stable race camera does not surge or pump FOV on repeated transmission torque cuts',()=>{
 const camera=new PerspectiveCamera(),reference=new PerspectiveCamera(),chase=createChaseCamera(camera),still=createChaseCamera(reference),forward=new Vector3(0,0,1);
 for(let i=0;i<240;i++){
  const position=new Vector3(0,2,i/60*100/3.6),options={stableRide:true,snap:i===0};
  chase.update(position,forward,100,1/60,{...options,push:i%24<12?1:0,braking:i%24>=12?1:0});still.update(position,forward,100,1/60,options);
  assert.ok(camera.position.distanceTo(reference.position)<1e-8);assert.ok(Math.abs(camera.fov-reference.fov)<1e-8);
 }
});

test('another car is a body collision, never a road surface for wheel suspension rays',()=>{
 const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;
 const lower=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,0,0).setGravityScale(0));world.createCollider(RAPIER.ColliderDesc.cuboid(4,.1,4),lower);
 const sim=createVehiclePhysics({sharedWorld:world,spec:specs.supra,raceTuning:RACE_TUNING.supra,start:{x:0,y:.65,z:0}});
 try{
  world.step();sim.controller.updateVehicle(STEP);assert.equal(sim.snapshot().contacts,4,'fixture reproduces rays resting on another dynamic body without a filter');
  sim.step({},false);assert.equal(sim.snapshot().contacts,0,'bumper/roof support creates unstable suspension');
  world.createCollider(RAPIER.ColliderDesc.cuboid(4,.1,4));world.step();sim.step({},false);assert.equal(sim.snapshot().contacts,4,'static road must still support the tyres');
 }finally{sim.dispose();world.free();}
});
