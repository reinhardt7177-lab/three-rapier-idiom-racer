import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngineResponse} from '../src/driving/drivingAudio.js';
import {createRaceInput,handleRaceKeyDown} from '../src/rebuild/raceInput.js';
import {initPhysics,createVehiclePhysics,STEP} from '../src/driving/physics.js';
import {VEHICLES} from '../src/rebuild/fleet.js';
import {playerRaceTuning} from '../src/rebuild/vehicleDynamics.js';
import {PLAYER_STEERING_SENSITIVITY} from '../src/driving/steering.js';
import {createTireSmoke} from '../src/driving/tireSmoke.js';
import {createExhaustVfx,exhaustPoints} from '../src/rebuild/exhaustVfx.js';
import {PerspectiveCamera,Vector3} from 'three';
import {createChaseCamera} from '../src/driving/chaseCamera.js';
import {createFirstPersonCamera} from '../src/rebuild/firstPersonCamera.js';
import {createDrivingSignals} from '../src/driving/drivingSignals.js';
import {Quaternion} from 'three';

test('pass 1: actual transmission shift is audible promptly and does not advance on pause',()=>{
 const response=createEngineResponse('supra');let mix;
 for(let i=0;i<=120;i++)mix=response.update({elapsed:i/120,gear:'2',powertrain:{rpm:6000,load:1,shifting:false}});
 const start=mix.rpm;
 for(let i=1;i<=14;i++)mix=response.update({elapsed:1+i/120,gear:'3',powertrain:{rpm:3500,load:1,shifting:true}});
 assert.ok(start-mix.rpm>1500,'gear change needs a clear RPM drop within 117 ms');
 const paused=mix.rpm;assert.equal(response.update({elapsed:1+14/120,gear:'3',powertrain:{rpm:850}}).rpm,paused);
 response.reset('supra');assert.equal(response.update({elapsed:0,powertrain:{rpm:850}}).rpm,850);
});

test('pass 2: focused touch pedal accepts keyboard steering, menu buttons retain normal keyboard semantics',()=>{
 const input=createRaceInput();let paused=false;
 const actions={input,inRace:()=>true,canDrive:()=>!paused,pause(){paused=!paused;input.clear();}};
 const key=(code,pedal)=>handleRaceKeyDown({code,preventDefault(){},target:{closest:s=>s==='button'||s==='[data-race-control]'&&pedal?{}:null}},actions);
 input.press('ArrowUp','pointer-1');key('KeyA',true);
 assert.equal(input.read().steer,-1);assert.equal(input.read().throttle,1);
 input.release('ArrowUp','pointer-1');assert.equal(input.read().steer,-1);
 key('Escape',true);assert.equal(input.read().steer,0);assert.equal(input.read().throttle,0);
 paused=false;key('KeyD',false);assert.equal(input.read().steer,0);
});

await initPhysics();
test('pass 2: short steering taps physically mirror, rear wheels stay straight and rack recentres',()=>{
 const spec=VEHICLES.find(v=>v.id==='supra'),results=[];
 for(const side of [-1,1]){
  const sim=createVehiclePhysics({barriers:false,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec,raceTuning:playerRaceTuning('supra'),steeringSensitivity:PLAYER_STEERING_SENSITIVITY});
  try{
   for(let i=0;i<120;i++)sim.step({brake:1});while(sim.snapshot().kmh<60)sim.step({throttle:1});
   const start=sim.snapshot().position;let s;
   for(let i=0;i<15;i++)s=sim.step({steer:side});
   assert.ok(Math.abs(s.steerInput)>.8);assert.equal(s.wheels[0].steering,0);assert.equal(s.wheels[2].steering,0);
   for(let i=0;i<90;i++)s=sim.step();
   assert.ok(Math.abs(s.steer)<.001);assert.equal(s.contacts,4);
   const displacement=s.position.x-start.x;assert.ok(displacement*side<-.3);results.push(Math.abs(displacement));
  }finally{sim.dispose();}
 }
 assert.ok(Math.abs(results[0]-results[1])<.05);
});

test('pass 3: small scrub stays translucent, full drift grows dense, airborne tyres stop emitting',()=>{
 const fixture={position:{x:0,y:.6,z:0},rotation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:20},speed:20,brake:0,wheels:[0,1,2,3].map(i=>({contact:true,point:{x:i<2?-.8:.8,y:0,z:i%2?1.2:-1.2},normal:{x:0,y:1,z:0}}))};
 const light=createTireSmoke({billboards:true,strong:true}),heavy=createTireSmoke({billboards:true,strong:true});
 try{
  for(let i=0;i<60;i++){light.update(fixture,{grounded:true,wheelSlip:[.25,0,0,0]},STEP);heavy.update(fixture,{grounded:true,wheelSlip:[1,0,0,0]},STEP);}
  const peak=o=>Math.max(...o.root.geometry.attributes.aAlpha.array);
  assert.ok(peak(heavy)>peak(light)*1.5);assert.ok(heavy.stats().live>light.stats().live);
  for(let i=0;i<200;i++)heavy.update(fixture,{grounded:false,wheelSlip:[1,1,1,1]},STEP);
  assert.equal(heavy.stats().live,0);assert.ok(light.stats().live<=160);
 }finally{light.dispose();heavy.dispose();}
});

test('pass 3: exhaust thins at speed without moving old particles with the car',()=>{
 const idle=createExhaustVfx(),fast=createExhaustVfx(),emitters=exhaustPoints('supra');
 const s={position:{x:0,y:.6,z:0},rotation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:0},speed:0,drive:0};
 try{for(let i=0;i<180;i++){idle.update(s,emitters,STEP);fast.update({...s,speed:55,velocity:{x:0,y:0,z:55}},emitters,STEP);}
  assert.ok(fast.stats().live<idle.stats().live*.4);fast.clear();assert.equal(fast.stats().live,0);
 }finally{idle.dispose();fast.dispose();}
});

test('pass 4: race camera communicates sustained acceleration/braking, freezes and respects reduced motion',()=>{
 for(const fps of [30,60,120]){
  const camera=new PerspectiveCamera(),chase=createChaseCamera(camera),p=new Vector3(0,1,0),f=new Vector3(0,0,1);
  const base={stableRide:true,pedalResponse:true};chase.update(p,f,100,1/fps,{...base,snap:true});
  for(let i=0;i<fps*3;i++)chase.update(p,f,100,1/fps,{...base,push:1,drive:1});
  const accel={z:camera.position.z,fov:camera.fov};assert.ok(accel.z<-7.7);assert.ok(accel.fov>57);
  for(let i=0;i<fps;i++)chase.update(p,f,100,1/fps,{...base,braking:1});
  assert.ok(camera.position.z>accel.z+.6);assert.ok(camera.fov<accel.fov-1.5);
  const held=camera.position.clone(),fov=camera.fov;chase.update(p,f,100,0,{...base,push:1,drive:1});
  assert.ok(camera.position.distanceTo(held)<1e-9);assert.equal(camera.fov,fov);
  chase.update(p,f,230,1/fps,{...base,motion:false,push:1,drive:1});assert.equal(camera.fov,54);
 }
});

test('pass 4: gear cuts cannot cause large camera pumping and high-speed tracking stays bounded',()=>{
 const camera=new PerspectiveCamera(),chase=createChaseCamera(camera),p=new Vector3(0,1,0),f=new Vector3(0,0,1),z=[];
 for(let i=0;i<600;i++){
  p.z+=230/3.6/60;
  const cue=chase.update(p,f,230,1/60,{stableRide:true,pedalResponse:true,drive:1,push:i%120<14?0:1,snap:i===0});
  if(i>240)z.push(p.z-camera.position.z);
  assert.ok(cue.distance<8.6);assert.ok(cue.fov<61);
 }
 assert.ok(Math.max(...z)-Math.min(...z)<.1);
});

test('pass 5: driver camera adds a small pedal lens cue without moving the eyes or cockpit',()=>{
 const camera=new PerspectiveCamera(),reference=new PerspectiveCamera(),view=createFirstPersonCamera(camera),still=createFirstPersonCamera(reference),p=new Vector3(0,1,0),q=new Quaternion();
 for(let i=0;i<180;i++){
  const args={snap:i===0,pedalResponse:true,push:1,drive:1,kmh:180};view.update(p,q,1/60,args);still.update(p,q,1/60,{snap:i===0});
  assert.ok(camera.position.distanceTo(reference.position)<1e-10);
 }
 assert.ok(camera.fov>73.5&&camera.fov<74.4);const fov=camera.fov;
 view.update(p,q,0,{pedalResponse:true,braking:1,kmh:180});assert.equal(camera.fov,fov);
 view.update(p,q,1/60,{pedalResponse:true,motion:false,push:1,drive:1,kmh:230});assert.equal(camera.fov,72);
});

test('pass 5: real race physics, signal reader, smoke, audio and chase camera share one acceleration/brake timeline',()=>{
 const spec=VEHICLES[0],sim=createVehiclePhysics({barriers:false,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec,raceTuning:playerRaceTuning(spec.id)});
 const reader=createDrivingSignals(),smoke=createTireSmoke({billboards:true,strong:true}),audio=createEngineResponse(spec.id),camera=new PerspectiveCamera(),chase=createChaseCamera(camera);
 let previous=sim.snapshot(),maxPush=0,maxBrake=0,peakSmoke=0,gearDrops=0,lastRpm=850,lastGear='N',braking=false;
 try{
  for(let i=0;i<1200;i++){
   if(previous.kmh>=100)braking=true;
   const s=sim.step(i<120||braking?{brake:1}:{throttle:1}),feedback=reader.update(previous,s,STEP);previous=s;
   smoke.update(s,feedback,STEP);const mix=audio.update(s,feedback);
   const f=new Vector3(0,0,1).applyQuaternion(new Quaternion(s.rotation.x,s.rotation.y,s.rotation.z,s.rotation.w));
   chase.update(new Vector3(s.position.x,s.position.y,s.position.z),f,s.kmh,STEP,{snap:i===0,stableRide:true,pedalResponse:true,drive:s.drive,push:feedback.push,braking:feedback.braking,grounded:feedback.grounded,velocity:s.velocity});
   if(s.gear!==lastGear&&lastGear!=='N')gearDrops++;lastGear=s.gear;lastRpm=mix.rpm;
   maxPush=Math.max(maxPush,feedback.push);maxBrake=Math.max(maxBrake,feedback.braking);peakSmoke=Math.max(peakSmoke,smoke.stats().live);
   assert.ok(Number.isFinite(lastRpm)&&Number.isFinite(camera.fov));assert.ok(smoke.stats().live<=160);
  }
  assert.ok(maxPush>.7&&maxBrake>.7&&peakSmoke>30&&gearDrops>=2);assert.ok(sim.snapshot().kmh<1);
  reader.reset();smoke.clear();audio.reset(spec.id);assert.equal(reader.snapshot().scrub,0);assert.equal(smoke.stats().live,0);
 }finally{sim.dispose();smoke.dispose();}
});
