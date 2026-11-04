import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {initPhysics,createVehiclePhysics,STEP,stepVehicleWorld} from '../src/driving/physics.js';
import {PLAYER_STEERING_SENSITIVITY,steeringLimit,wheelSteering} from '../src/driving/steering.js';
import {VEHICLES} from '../src/rebuild/fleet.js';
import {RACE_TUNING,playerRaceTuning} from '../src/rebuild/vehicleDynamics.js';
import {routePose,nearestRoute,forwardProgress,aiInput} from '../src/rebuild/course.js';
import {recoveredCollider} from '../src/rebuild/worldCollision.js';
await initPhysics();
const yaw=q=>Math.atan2(2*(q.x*q.z+q.w*q.y),1-2*(q.x*q.x+q.y*q.y));

function measure(spec,kmh,sensitivity,direction=1,tuning=RACE_TUNING[spec.id]){
 const sim=createVehiclePhysics({barriers:false,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec,raceTuning:tuning,steeringSensitivity:sensitivity,start:{x:0,y:1,z:-500}});
 try{
  let state;for(let i=0;i<180;i++)state=sim.step({brake:1});
  // Reach the entry speed through the real gearbox, so a stationary first
  // gear cannot distort the speed comparison after an artificial velocity jump.
  for(let i=0;i<2400&&state.kmh<kmh;i++)state=sim.step({throttle:1});
  assert.ok(state.kmh>=kmh,`reach ${kmh} through the drivetrain`);
  let distance=0,turn=0,minUp=1,minContacts=4,samples=0,speedSum=0;
  for(let i=0;i<240;i++){
   const before=state;
   state=sim.step({steer:direction,throttle:state.kmh<kmh?1:0,brake:state.kmh>kmh+1?.2:0});
   minContacts=Math.min(minContacts,state.contacts);
   minUp=Math.min(minUp,1-2*(state.rotation.x**2+state.rotation.z**2));
   // Measure only the same 87..93 km/h speed band, after the rack settles.
   // Full-lock tyre scrub can slow a production car despite full throttle.
   if(i>30&&Math.abs(state.kmh-kmh)<3&&Math.abs(before.kmh-kmh)<3){
    const delta=yaw(state.rotation)-yaw(before.rotation);
    turn+=Math.atan2(Math.sin(delta),Math.cos(delta));
    distance+=Math.hypot(state.position.x-before.position.x,state.position.z-before.position.z);
    speedSum+=state.kmh;samples++;
   }
  }
  wheelSteering(state.steer,spec).forEach((angle,i)=>assert.ok(Math.abs(angle-state.wheels[i].steering)<1e-8));
  assert.ok(samples>15,'enough supported measurements at the target speed');
  return {radius:Math.abs(distance/turn),turn,minUp,minContacts,kmh:speedSum/samples,endKmh:state.kmh,samples,steer:state.steer};
 }finally{sim.dispose();}
}

test('player steering reaches the physical rack with useful-speed lock, bounded stop and highway taper',()=>{
 assert.ok(Math.abs(PLAYER_STEERING_SENSITIVITY/1.3-1.3)<1e-12);
 for(const spec of VEHICLES){
  const tuning={...spec,steeringAcceleration:RACE_TUNING[spec.id].steeringAcceleration};
  for(const kmh of [60,90,130,180,230]){
   const previous=steeringLimit(kmh/3.6,true,tuning,1.3);
   const current=steeringLimit(kmh/3.6,true,tuning,PLAYER_STEERING_SENSITIVITY);
   assert.ok(current/previous>=1.3-1e-12&&current/previous<1.45);
   assert.equal(current,steeringLimit(-kmh/3.6,true,tuning,PLAYER_STEERING_SENSITIVITY));
   assert.equal(current,steeringLimit(kmh/3.6,true,tuning,99));
  }
  assert.equal(steeringLimit(0,true,tuning,PLAYER_STEERING_SENSITIVITY),.56);
  assert.ok(steeringLimit(230/3.6,true,tuning,PLAYER_STEERING_SENSITIVITY)<.02);
 }
});

test('all eight cars actually turn tighter at 90km/h in both directions and keep four-wheel support',()=>{
 for(const spec of VEHICLES){
  const old=measure(spec,90,1.3);
  const left=measure(spec,90,PLAYER_STEERING_SENSITIVITY,1,playerRaceTuning(spec.id));
  const right=measure(spec,90,PLAYER_STEERING_SENSITIVITY,-1,playerRaceTuning(spec.id));
  console.log(JSON.stringify({id:spec.id,previous:old,left,right}));
  assert.ok(left.radius<old.radius*.85,`${spec.id}: radius ${old.radius} -> ${left.radius}`);
  assert.ok(Math.abs(left.kmh-old.kmh)<1,'radius comparison must use matching measured speeds');
  assert.ok(Math.abs(left.radius-right.radius)<.1,`${spec.id}: symmetric turns`);
  for(const result of [left,right]){
   assert.equal(result.minContacts,4);assert.ok(result.minUp>.97);
   assert.ok(Math.abs(result.kmh-90)<3,`compare at matching road speed: ${result.kmh}`);
  }
  assert.ok(left.turn<0&&right.turn>0);
  console.log(JSON.stringify({id:spec.id,previousRadius:old.radius,currentRadius:left.radius,reduction:1-left.radius/old.radius}));
 }
});

test('additional steering stays upright at highway speed and releasing input recentres the wheels',()=>{
 for(const spec of VEHICLES){
  const result=measure(spec,180,PLAYER_STEERING_SENSITIVITY,1,playerRaceTuning(spec.id));
  assert.equal(result.minContacts,4);assert.ok(result.minUp>.97);assert.ok(result.turn<0);
 }
 const spec=VEHICLES[0],sim=createVehiclePhysics({barriers:false,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec,raceTuning:playerRaceTuning(spec.id),steeringSensitivity:PLAYER_STEERING_SENSITIVITY});
 try{
  for(let i=0;i<180;i++)sim.step({brake:1});
  for(let i=0;i<60;i++)sim.step({steer:1});
  let state;for(let i=0;i<60;i++)state=sim.step({});
  assert.ok(Math.abs(state.steer)<.001);assert.ok(state.wheels.every(w=>Math.abs(w.steering)<.001));
 }finally{sim.dispose();}
});

test('the player GT-R completes actual Namak road corners with the new grip and rack without recovery teleports',()=>{
 const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url));
 const route=JSON.parse(read('public/assets/rebuild/namak-route.json'));
 const binary=read('artifacts/namak-20261010/colliders.bin'),manifest=JSON.parse(read('artifacts/namak-20261010/colliders.json'));
 const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;world.numSolverIterations=8;
 for(const part of manifest){
  const vertices=new Float32Array(part.vertices),indices=new Uint32Array(part.indices);
  for(let i=0;i<vertices.length;i++)vertices[i]=binary.readFloatLE(part.offset+i*4);
  for(let i=0;i<indices.length;i++)indices[i]=binary.readUInt32LE(part.offset+vertices.byteLength+i*4);
  world.createCollider(recoveredCollider(vertices,indices));
 }
 const spec=VEHICLES.find(v=>v.id==='gtr'),pose=routePose(route,25,-2.2);
 const sim=createVehiclePhysics({sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec,raceTuning:playerRaceTuning(spec.id),steeringSensitivity:PLAYER_STEERING_SENSITIVITY,start:pose.position});
 try{
  sim.reset(pose.position,pose.yaw,{stepWorld:false});
  let state=sim.snapshot(),index=25,distance=route.points[index].distance,progress=0,maxDeviation=0,minContacts=4,steps=0;
  for(let i=0;i<180;i++){sim.step({brake:1},false);stepVehicleWorld(world);state=sim.finishStep();}
  for(;steps<120*200&&progress<route.length;steps++){
   sim.step(aiInput(route,state,index,-2.2,1,[],{speedLimit:100}),false);stepVehicleWorld(world);state=sim.finishStep();
   const near=nearestRoute(route,state.position,index);index=near.index;
   progress+=forwardProgress(distance,near.point.distance,route.length);distance=near.point.distance;
   maxDeviation=Math.max(maxDeviation,near.distance);minContacts=Math.min(minContacts,state.contacts);
   assert.ok(state.position.y>-.3,'stay above the road');
  }
  const result={progress,length:route.length,seconds:steps*STEP,maxDeviation,minContacts,sensitivity:state.steeringSensitivity};
  fs.writeFileSync(new URL('../artifacts/steering-turn-20261010/namak-player-lap.json',import.meta.url),JSON.stringify(result,null,2));
  console.log('Namak player steering lap',result);
  assert.ok(progress>=route.length,'finish a lap using only steering and pedals');
  assert.ok(maxDeviation<9,'remain inside the 22m-wide road');
  assert.ok(minContacts>=3,'retain support through the city corners');
 }finally{sim.dispose();world.free();}
});
