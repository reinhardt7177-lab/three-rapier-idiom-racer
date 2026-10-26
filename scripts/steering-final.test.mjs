import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PerspectiveCamera} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {initPhysics,createVehiclePhysics,STEP} from '../src/driving/physics.js';
import {steeringLimit,updateSteering,wheelSteering,PLAYER_STEERING_SENSITIVITY} from '../src/driving/steering.js';
import {VEHICLES} from '../src/rebuild/fleet.js';
import {playerRaceTuning} from '../src/rebuild/vehicleDynamics.js';
import {createCockpit} from '../src/rebuild/cockpit.js';
import {createSceneDisposer} from '../src/rendering/sceneResources.js';
await initPhysics();
const deg=x=>x*180/Math.PI;
const options=spec=>({barriers:false,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec,raceTuning:playerRaceTuning(spec.id),steeringSensitivity:PLAYER_STEERING_SENSITIVITY,start:{x:0,y:1,z:-600}});

test('pass 1: all eight player racks reach useful low-speed lock through actual front tyres only',()=>{
 for(const spec of VEHICLES){
  const sim=createVehiclePhysics(options(spec));
  try{
   for(let i=0;i<180;i++)sim.step({brake:1});
   for(let i=0;i<90;i++)sim.step({steer:1});
   const s=sim.snapshot();assert.ok(deg(Math.abs(s.steer))>31&&deg(Math.abs(s.steer))<33);
   assert.equal(s.wheels[0].steering,0);assert.equal(s.wheels[2].steering,0);
   assert.ok(Math.max(...s.wheels.map(w=>deg(Math.abs(w.steering))))<40,'bounded inner tyre package');
   const expected=wheelSteering(s.steer,spec);s.wheels.forEach((w,i)=>assert.equal(w.steering,Math.fround(expected[i])));
   assert.equal(s.contacts,4);
  }finally{sim.dispose();}
 }
});

test('pass 2: useful-speed player lock is stronger, monotone and continuous; AI and highway limits retain their calibration',()=>{
 for(const spec of VEHICLES){
  const tuning={...spec,...playerRaceTuning(spec.id)};
  assert.ok(deg(steeringLimit(90/3.6,true,tuning,PLAYER_STEERING_SENSITIVITY))>7.5);
  let previous=Infinity;
  for(let kmh=0;kmh<=280;kmh+=.25){
   const current=steeringLimit(kmh/3.6,true,tuning,PLAYER_STEERING_SENSITIVITY);
   assert.ok(current<=previous+1e-12);if(Number.isFinite(previous))assert.ok(deg(previous-current)<.5,'no abrupt rack drop');previous=current;
   assert.equal(current,steeringLimit(-kmh/3.6,true,tuning,PLAYER_STEERING_SENSITIVITY));
  }
  for(const kmh of [0,30,60,90,140,180,230]){
   const speed=kmh/3.6,responsive=1+.4*Math.max(0,1-Math.max(0,speed-25)/30);
   const prior=Math.min(.52,Math.atan(spec.wheelbase*tuning.steeringAcceleration*responsive/Math.max(25,speed**2)));
   assert.ok(Math.abs(steeringLimit(speed,true,tuning,1)-prior)<1e-12,'AI keeps old rack');
   if(kmh>=180)assert.ok(Math.abs(steeringLimit(speed,true,tuning,PLAYER_STEERING_SENSITIVITY)-prior*PLAYER_STEERING_SENSITIVITY)<1e-12,'highway rack unchanged');
  }
 }
});

test('pass 3: short player taps engage promptly, opposite input crosses centre, and release is frame independent',()=>{
 for(const side of [-1,1])for(const hz of [30,60,120]){
  let s=0;for(let i=0;i<hz/10;i++)s=updateSteering(s,side,1/hz,true,PLAYER_STEERING_SENSITIVITY);
  assert.ok(-s*side>.88);
  const reversed=updateSteering(-side,-side,1/48,true,PLAYER_STEERING_SENSITIVITY);assert.ok(reversed*side>0,'countersteer crosses centre within 21ms');
  for(let i=0;i<hz/4;i++)s=updateSteering(s,0,1/hz,true,PLAYER_STEERING_SENSITIVITY);
  assert.ok(Math.abs(s)<.003);
 }
 assert.equal(updateSteering(.3,1,0,true,PLAYER_STEERING_SENSITIVITY),.3,'pause freezes rack');
 assert.ok(Math.abs(updateSteering(0,1,.1,true)-(-1+Math.exp(-19.6*.1)))<1e-12,'AI response unchanged');
});

test('pass 4: actual Blender steering wheel has a readable symmetric rack ratio, bounded full lock and no input-only fakery',async()=>{
 const bytes=fs.readFileSync(new URL('../public/assets/rebuild/cockpit.glb',import.meta.url));
 const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const camera=new PerspectiveCamera(),cockpit=createCockpit(scene,camera);
 try{
  const read=angle=>{cockpit.update({steer:angle,wheels:wheelSteering(angle,VEHICLES[0]).map(steering=>({steering}))},true);return cockpit.status().steeringAngle;};
  const left=read(.12),right=read(-.12);assert.ok(left>1&&left<1.5);assert.equal(left,-right);
  assert.ok(Math.abs(read(.56))<=Math.PI&&Math.abs(read(.56))>2.5);
  cockpit.update({steer:0,steerInput:1},true);assert.equal(cockpit.status().steeringAngle,0);
 }finally{createSceneDisposer(camera)();}
});

test('pass 5: all eight cars support quick turn/countersteer/drift/release sequences without spinning or leaving the ground',()=>{
 for(const spec of VEHICLES)for(const side of [-1,1]){
  const sim=createVehiclePhysics(options(spec));
  try{
   let s;for(let i=0;i<180;i++)s=sim.step({brake:1});
   for(let i=0;i<1800&&s.kmh<90;i++)s=sim.step({throttle:1});assert.ok(s.kmh>=90);
   let minUp=1,minContacts=4,maxSlip=0;
   for(let i=0;i<180;i++){
    s=sim.step({throttle:.4,steer:i<24?side:i<48?-side:0,handbrake:i<24});
    minUp=Math.min(minUp,1-2*(s.rotation.x**2+s.rotation.z**2));minContacts=Math.min(minContacts,s.contacts);maxSlip=Math.max(maxSlip,s.action.slip);
    assert.ok(s.wheels.every(w=>Number.isFinite(w.steering)));
   }
   assert.equal(minContacts,4);assert.ok(minUp>.97);assert.ok(maxSlip<.65,'no uncontrolled spin');
   assert.ok(Math.abs(s.steer)<.001);assert.ok(s.kmh>45,'brief steering must not erase momentum');
  }finally{sim.dispose();}
 }
});

test('pass 5: physical 60/90 kmh turning radius improves against the original baseline at matched road speeds',()=>{
 const baseline=JSON.parse(fs.readFileSync(new URL('./fixtures/steering-baseline-20261015.json',import.meta.url))).rows;
 const yaw=q=>Math.atan2(2*(q.x*q.z+q.w*q.y),1-2*(q.x*q.x+q.y*q.y));
 for(const before of baseline){
  const spec=VEHICLES.find(v=>v.id===before.id),sim=createVehiclePhysics(options(spec));
  try{
   let s;for(let i=0;i<180;i++)s=sim.step({brake:1});
   for(let i=0;i<2400&&s.kmh<before.kmh;i++)s=sim.step({throttle:1});assert.ok(s.kmh>=before.kmh);
   let distance=0,turn=0,speed=0,samples=0;
   for(let i=0;i<180;i++){
    const prev=s;s=sim.step({steer:before.side,throttle:s.kmh<before.kmh?1:0,brake:s.kmh>before.kmh+1?.2:0});
    assert.equal(s.contacts,4);assert.ok(1-2*(s.rotation.x**2+s.rotation.z**2)>.97);
    if(i>30&&Math.abs(s.kmh-before.kmh)<3&&Math.abs(prev.kmh-before.kmh)<3){
     const delta=yaw(s.rotation)-yaw(prev.rotation);turn+=Math.atan2(Math.sin(delta),Math.cos(delta));
     distance+=Math.hypot(s.position.x-prev.position.x,s.position.z-prev.position.z);speed+=s.kmh;samples++;
    }
   }
   assert.ok(samples>70,'enough steady road-speed samples');assert.ok(Math.abs(speed/samples-before.measuredKmh)<.75,'compare matching measured speeds');
   const radius=Math.abs(distance/turn);
   assert.ok(radius<before.radius*.95,`${spec.id} ${before.kmh}km/h side ${before.side}: radius ${before.radius} -> ${radius} must actually tighten`);
  }finally{sim.dispose();}
 }
});
