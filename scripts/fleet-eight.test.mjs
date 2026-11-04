import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {Quaternion,Vector3,Euler} from 'three';
import {VEHICLES,rivalFleet} from '../src/rebuild/fleet.js';
import {RACE_TUNING} from '../src/rebuild/vehicleDynamics.js';
import {exhaustPoints} from '../src/rebuild/exhaustVfx.js';
import {initPhysics,createVehiclePhysics,STEP,stepVehicleWorld} from '../src/driving/physics.js';
await initPhysics();

test('eight distinct authored cars, editable Blender sources, physical tuning and exhaust hardpoints',()=>{
 assert.equal(VEHICLES.length,8);assert.equal(new Set(VEHICLES.map(v=>v.id)).size,8);
 for(const v of VEHICLES){
  const binary=fs.readFileSync(new URL(`../public/assets/rebuild/${v.id}.glb`,import.meta.url));
  const json=JSON.parse(binary.subarray(20,20+binary.readUInt32LE(12)));
  const root=json.nodes.find(n=>n.extras?.vehicle_rig_version===2);
  assert.equal(root.extras.vehicle_detail_version,6);assert.equal(root.extras.wheel_radius,v.wheelRadius);
  assert.ok(fs.existsSync(new URL(`../assets-sources/vehicles-v6/${v.id}.blend`,import.meta.url)));
  assert.equal(RACE_TUNING[v.id].length,v.length);
  for(const code of ['FL','FR','RL','RR'])for(const part of ['Suspension_','Steering_','Wheel_'])assert.ok(json.nodes.some(n=>n.name===part+code));
  const points=exhaustPoints(v.id);assert.equal(points.length,v.quadExhaust?4:2);assert.ok(points.every(p=>p.toArray().every(Number.isFinite)&&p.z<-v.length/2));
  assert.equal(new Set(rivalFleet(v.id)).size,5);assert.ok(!rivalFleet(v.id).includes(v.id));
 }
});

for(const v of VEHICLES)test(`${v.name}: no grounded pitch/roll/heave at high speed, tyre distance and braking remain physical`,()=>{
 const sim=createVehiclePhysics({barriers:false,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec:v,raceTuning:RACE_TUNING[v.id],start:{x:0,y:.8,z:-600}});
 try{
  for(let i=0;i<240;i++)sim.step({brake:1});let s=sim.snapshot(),rest=s.position.y,from=s.position.z,spin=s.wheels[1].rotation;
  // A deliberate angular impulse used to excite independent spring rebound.
  sim.body.setAngvel({x:1,y:0,z:.4},true);
  for(let i=0;i<120*20;i++){
   s=sim.step({throttle:1});assert.equal(s.contacts,4);
   assert.ok(Math.abs(s.rotation.x)<1e-6&&Math.abs(s.rotation.z)<1e-6,'repeat body rocking');
   assert.ok(Math.abs(s.position.y-rest)<.0001,'repeat chassis heave');
  }
  assert.ok(s.kmh>180);const distance=s.position.z-from,rolling=Math.abs(s.wheels[1].rotation-spin)*v.wheelRadius;
  assert.ok(Math.abs(rolling-distance)<distance*.035);
  const speed=s.kmh;for(let i=0;i<120*8;i++)s=sim.step({brake:1});assert.ok(s.kmh<1&&speed>180);
  console.log({id:v.id,groundedHeave:Math.abs(s.position.y-rest),rolling,distance});
 }finally{sim.dispose();}
});

test('banked uphill support follows real road grade without releasing stability as vertical speed rises',()=>{
 const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;
 const rotation=new Quaternion().setFromEuler(new Euler(-.12,0,.06));
 const normal=new Vector3(0,1,0).applyQuaternion(rotation);
 world.createCollider(RAPIER.ColliderDesc.cuboid(50,.5,800).setTranslation(...new Vector3(0,-.5,0).applyQuaternion(rotation).toArray()).setRotation(rotation));
 const v=VEHICLES[0],sim=createVehiclePhysics({sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec:v,raceTuning:RACE_TUNING[v.id],start:{x:0,y:.54,z:0}});
 try{
  sim.reset({x:0,y:.54,z:0},0,{stepWorld:false,rotation});
  let maximumError=0,s;
  for(let i=0;i<120*12;i++){
   sim.step({throttle:1},false);stepVehicleWorld(world);s=sim.finishStep();
   if(i>120){assert.equal(s.contacts,4);const up=new Vector3(0,1,0).applyQuaternion(new Quaternion(s.rotation.x,s.rotation.y,s.rotation.z,s.rotation.w));maximumError=Math.max(maximumError,up.angleTo(normal));}
  }
  assert.ok(s.velocity.y>4,'test must cover fast upward motion on slope');assert.ok(maximumError<.001,'body must follow bank rather than world-horizontal locking');
 }finally{sim.dispose();world.free();}
});
