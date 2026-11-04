import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {Quaternion,Vector3} from 'three';
import {initPhysics,createVehiclePhysics,STEP,stepVehicleWorld} from '../src/driving/physics.js';
import {createRaceClock} from '../src/rebuild/raceClock.js';
import {RACE_TUNING} from '../src/rebuild/vehicleDynamics.js';
import {VEHICLES} from '../src/rebuild/fleet.js';
import {nearestRoute,routePose,forwardProgress,aiInput} from '../src/rebuild/course.js';
import {recoveredCollider} from '../src/rebuild/worldCollision.js';
await initPhysics();
const create=(tuning={},options={})=>createVehiclePhysics({barriers:false,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec:VEHICLES[0],raceTuning:{...RACE_TUNING.supra,...tuning},start:{x:0,y:.85,z:-600},...options});
const settle=sim=>{for(let i=0;i<240;i++)sim.step({brake:1});};

test('real-map mountain seams do not restore the previous large vertical and orientation impulses',()=>{
 const route=JSON.parse(fs.readFileSync(new URL('../public/assets/rebuild/world-route.json',import.meta.url)));
 const binary=fs.readFileSync(new URL('../artifacts/unity-recovery/colliders.bin',import.meta.url));
 const manifest=JSON.parse(fs.readFileSync(new URL('../artifacts/unity-recovery/colliders.json',import.meta.url)));
 const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;world.numSolverIterations=8;
 for(const part of manifest){
  const vertices=new Float32Array(part.vertices),indices=new Uint32Array(part.indices);
  for(let i=0;i<vertices.length;i++)vertices[i]=binary.readFloatLE(part.offset+i*4);
  for(let i=0;i<indices.length;i++)indices[i]=binary.readUInt32LE(part.offset+vertices.byteLength+i*4);
  world.createCollider(recoveredCollider(vertices,indices));
 }
 const pose=routePose(route,25,-2.2),sim=create({}, {sharedWorld:world,start:pose.position});
 try{
  sim.reset(pose.position,pose.yaw,{stepWorld:false});
  for(let i=0;i<240;i++){sim.step({brake:1},false);stepVehicleWorld(world);sim.finishStep();}
  let previous=sim.snapshot(),index=25,distance=route.points[index].distance,progress=0;
  const up=s=>new Vector3(0,1,0).applyQuaternion(new Quaternion().copy(s.rotation));
  let lastUp=up(previous),maximumAcceleration=0,maximumTilt=0,sumTilt=0,samples=0,releaseSteps=0;
  for(let tick=0;tick<120*450&&progress<route.length;tick++){
   sim.step(aiInput(route,previous,index,-2.2,1),false);stepVehicleWorld(world);const state=sim.finishStep();
   const near=nearestRoute(route,state.position,index);index=near.index;
   progress+=forwardProgress(distance,near.point.distance,route.length);distance=near.point.distance;
   assert.ok(state.position.y>near.point.y-5,'car fell through recovered road');
   const currentUp=up(state),tilt=currentUp.angleTo(lastUp)/STEP;
   if(near.point.region==='Mountain'){
    samples++;maximumAcceleration=Math.max(maximumAcceleration,Math.abs(state.velocity.y-previous.velocity.y)/STEP);
    maximumTilt=Math.max(maximumTilt,tilt);sumTilt+=tilt*tilt;
   }
   if(state.contacts<2){assert.equal(state.ride.locked,false,'no tyre support must release the chassis');releaseSteps++;}
   previous=state;lastUp=currentUp;
  }
  assert.ok(progress>=route.length,'complete the entire course without recovery teleports');
  // Pre-change recorded maxima: 392.66 m/s² and 12.39 rad/s. Landings remain
  // physical; this test rejects the former repeated support/solver conflict.
  assert.ok(maximumAcceleration<60,`mountain vertical impulse ${maximumAcceleration}`);
  assert.ok(maximumTilt<3,`mountain orientation impulse ${maximumTilt}`);
  assert.ok(Math.sqrt(sumTilt/samples)<.15,'repeated mountain rocking');
  assert.ok(releaseSteps>0,'the course must exercise support release, not just a flat pad');
  console.log({progress,maximumAcceleration,maximumTilt,rmsTilt:Math.sqrt(sumTilt/samples),releaseSteps});
 }finally{sim.dispose();world.free();}
});

test('unsupported inverted chassis still lands on its physical roof collider',()=>{
 const sim=create({}, {start:{x:0,y:6,z:0}});
 try{
  sim.reset({x:0,y:6,z:0},0,{rotation:{x:0,y:0,z:1,w:0}});
  let state;for(let i=0;i<360;i++){state=sim.step({});assert.equal(state.ride.locked,false);}
  assert.equal(state.contacts,0);assert.ok(state.position.y>.3&&state.position.y<1.5,'roof collision must prevent falling through the floor');
  assert.ok(Math.abs(state.velocity.y)<.05,'roof must settle after landing');
 }finally{sim.dispose();}
});

test('grip changes the actual constant-input corner trajectory',()=>{
 const traces=[];
 for(const grip of [.4,2.3]){
  const sim=create({grip});try{
   settle(sim);sim.body.setLinvel({x:0,y:0,z:22},true);let state;
   for(let i=0;i<360;i++)state=sim.step({steer:.6,throttle:.4});
   assert.equal(state.contacts,4);traces.push(state);
  }finally{sim.dispose();}
 }
 assert.ok(Math.abs(traces[0].position.x)<Math.abs(traces[1].position.x)*.6,'low grip must actually run wider');
 assert.ok(Math.hypot(traces[0].position.x-traces[1].position.x,traces[0].position.z-traces[1].position.z)>15,'configuration must change motion, not just labels');
});

test('AWD allocates measured forward impulses to front tyres; RWD does not',()=>{
 for(const bias of [0,.4]){
  const sim=create({frontDriveBias:bias});try{
   settle(sim);for(let i=0;i<120;i++)sim.step({throttle:1});
   const impulses=Array.from({length:4},(_,i)=>sim.controller.wheelForwardImpulse(i));
   const total=impulses.reduce((a,b)=>a+b,0),front=impulses[1]+impulses[3];
   assert.ok(total>50&&sim.snapshot().kmh>20,'measure loaded tyres while actually accelerating');
   assert.ok(Math.abs(front/total-bias)<1e-5,`measured front drive fraction ${front/total}`);
  }finally{sim.dispose();}
 }
});

test('brake balance redistributes real tyre impulses while physically slowing the car',()=>{
 for(const bias of [.4,.8]){
  const sim=create({frontBrakeBias:bias});try{
   settle(sim);sim.body.setLinvel({x:0,y:0,z:25},true);const state=sim.step({brake:.4});
   const impulses=Array.from({length:4},(_,i)=>sim.controller.wheelForwardImpulse(i));
   const total=impulses.reduce((a,b)=>a+b,0),front=impulses[1]+impulses[3];
   assert.ok(total<-40&&state.speed<25,'brakes must apply an opposing impulse and reduce speed');
   assert.ok(Math.abs(front/total-bias)<1e-5,`measured front brake fraction ${front/total}`);
  }finally{sim.dispose();}
 }
});

test('fixed physics produces identical motion at 30/60/120 FPS and a normal 100 ms frame',()=>{
 const schedules=[Array(60).fill(1/30),Array(120).fill(1/60),Array(240).fill(1/120),[.1,...Array(114).fill(1/60)]];
 const snapshots=[];
 for(const frames of schedules){
  const sim=create(),clock=createRaceClock(STEP);try{
   settle(sim);let ticks=0;
   for(const seconds of frames)clock.advance(seconds,()=>{sim.step({throttle:1,steer:.12});ticks++;});
   assert.equal(ticks,240);assert.equal(clock.snapshot().droppedSeconds,0);snapshots.push(sim.snapshot());
  }finally{sim.dispose();}
 }
 for(const s of snapshots.slice(1)){assert.deepEqual(s.position,snapshots[0].position);assert.deepEqual(s.rotation,snapshots[0].rotation);assert.deepEqual(s.velocity,snapshots[0].velocity);}
});

test('excessive stalls bound work, expose discarded time, catch up and clear debt on pause',()=>{
 const clock=createRaceClock(STEP);let ticks=0;
 assert.equal(clock.advance(.5,()=>ticks++),12);
 assert.equal(clock.snapshot().droppedSeconds,.25);assert.ok(clock.snapshot().pendingSeconds>.14);
 clock.advance(0,()=>ticks++);clock.advance(0,()=>ticks++);
 assert.equal(ticks,30);assert.ok(clock.snapshot().pendingSeconds<1e-9);
 clock.reset();clock.advance(NaN,()=>ticks++);assert.equal(ticks,30);
 assert.equal(clock.snapshot().simulatedSeconds,0);assert.equal(clock.snapshot().droppedSeconds,0);assert.equal(clock.alpha(),0);
});
