import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {initPhysics,createVehiclePhysics,STEP,stepVehicleWorld} from '../src/driving/physics.js';
import {createNamakBarriers} from '../src/rebuild/namakBarriers.js';
import {recoveredCollider} from '../src/rebuild/worldCollision.js';
import {createRecoveryWatch,roadRecoveryPose,recoveryProgressChange,findRecoveryPose} from '../src/rebuild/vehiclePose.js';
import {routePose,nearestRoute,forwardProgress,aiInput} from '../src/rebuild/course.js';
import {handleRaceKeyDown} from '../src/rebuild/raceInput.js';
import {VEHICLES} from '../src/rebuild/fleet.js';
import {playerRaceTuning} from '../src/rebuild/vehicleDynamics.js';
import {PLAYER_STEERING_SENSITIVITY} from '../src/driving/steering.js';
await initPhysics();
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url));
const route=JSON.parse(read('public/assets/rebuild/namak-route.json'));
function scene(){
 const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;world.numSolverIterations=8;
 const binary=read('artifacts/namak-20261010/colliders.bin'),manifest=JSON.parse(read('artifacts/namak-20261010/colliders.json'));
 for(const part of manifest){
  if(part.name.startsWith('RaceBarrier_'))continue;
  const v=new Float32Array(part.vertices),ix=new Uint32Array(part.indices);
  for(let i=0;i<v.length;i++)v[i]=binary.readFloatLE(part.offset+i*4);
  for(let i=0;i<ix.length;i++)ix[i]=binary.readUInt32LE(part.offset+v.byteLength+i*4);
  world.createCollider(recoveredCollider(v,ix));
 }
 const barriers=createNamakBarriers(world,route);
 world.step(); // Publish newly created static geometry to Rapier's ray queries.
 return {world,barriers};
}
const create=(world,spec,index=25,lane=0)=>{
 const pose=routePose(route,index,lane);
 const sim=createVehiclePhysics({sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec,raceTuning:playerRaceTuning(spec.id),steeringSensitivity:PLAYER_STEERING_SENSITIVITY,start:pose.position});
 sim.reset(pose.position,pose.yaw,{stepWorld:false});return sim;
};
const tick=(sim,input={})=>{sim.step(input,false);stepVehicleWorld(sim.world);return sim.finishStep();};

test('sealed Namak wall shells block both directions and every route seam without filling the asphalt',()=>{
 const {world,barriers}=scene();
 try{
  assert.equal(barriers.length,2*Math.ceil(route.points.length/128));
  for(const p of route.points)for(const side of [-1,1]){
   const origin={x:p.x,y:.4,z:p.z},direction={x:p.dz*side,y:0,z:-p.dx*side};
   const hit=world.castRay(new RAPIER.Ray(origin,direction),14,true);
   assert.ok(hit,`missing barrier at ${p.distance}, side ${side}`);
   assert.ok(hit.timeOfImpact>11.1&&hit.timeOfImpact<12.2,`barrier intrusion/gap: ${hit.timeOfImpact}`);
  }
 }finally{world.free();}
});

test('eight physical cars remain inside either wall after a 230km/h lateral impact',()=>{
 const {world}=scene();
 try{
  for(const spec of VEHICLES)for(const side of [-1,1]){
   const sim=create(world,spec);
   try{
    for(let i=0;i<180;i++)tick(sim,{brake:1});
    const p=route.points[25];sim.body.setLinvel({x:p.dz*side*230/3.6,y:0,z:-p.dx*side*230/3.6},true);
    let maxOffset=0;
    for(let i=0;i<180;i++){
     const state=tick(sim),offset=((state.position.x-p.x)*p.dz-(state.position.z-p.z)*p.dx)*side;
     maxOffset=Math.max(maxOffset,offset);
     assert.ok(Number.isFinite(state.position.y)&&state.position.y>-.3);
    }
    assert.ok(maxOffset<11.85,`${spec.id} side ${side} crossed the wall at ${maxOffset}`);
    console.log({id:spec.id,side,maxOffset});
   }finally{sim.dispose();}
  }
 }finally{world.free();}
});

test('an upright car stranded on the sidewalk triggers recovery; brief edge contact and pause do not',()=>{
 const watch=createRecoveryWatch({roadHalfWidth:11});
 const state={position:{x:0,y:.55,z:20},rotation:{x:0,y:0,z:0,w:1}};
 for(let i=0;i<180;i++)assert.equal(watch.update(state,.025,STEP,11.9),null);
 for(let i=0;i<80;i++)assert.equal(watch.update(state,.025,STEP,20),null);
 for(let i=0;i<400;i++)assert.equal(watch.update(state,.025,0,20),null);
 assert.equal(watch.update(state,.025,STEP,2),null,'returning inside clears the timer');
 let reason;for(let i=0;i<125;i++)reason=watch.update(state,.025,STEP,20)||reason;
 assert.equal(reason,'offtrack');watch.reset();
 const coastal=createRecoveryWatch();for(let i=0;i<180;i++)assert.equal(coastal.update(state,.025,STEP,20),null,'open coastal roadside remains allowed');
});

test('sidewalk recovery settles onto real asphalt with spent nitro preserved and no forward progress reward',()=>{
 const {world}=scene(),spec=VEHICLES[0],sim=create(world,spec,25,20);
 try{
  let state;for(let i=0;i<180;i++)state=tick(sim,{brake:1});
  assert.ok(nearestRoute(route,state.position).distance>13);
  sim.addCharge(-55);const charge=sim.snapshot().action.charge;
  assert.ok(charge<100);
  const point=route.points[23],pose=roadRecoveryPose(point,{x:0,y:1,z:0},Math.atan2(point.dx,point.dz),spec);
  sim.reset(pose.position,Math.atan2(point.dx,point.dz),{stepWorld:false,rotation:pose.rotation,preserveCharge:true});
  for(let i=0;i<180;i++)state=tick(sim,{brake:1});
  assert.equal(state.contacts,4);assert.ok(nearestRoute(route,state.position).distance<1);
  assert.equal(state.action.charge,charge);
  assert.ok(recoveryProgressChange(route.points[25].distance,point.distance,route.length)<0);
  assert.ok(Math.hypot(state.velocity.x,state.velocity.z)<.1);
 }finally{sim.dispose();world.free();}
});

test('C recovery works after a pedal button gains focus, but stays disabled on pause and in text fields',()=>{
 let calls=0,canDrive=true;
 const actions={inRace:()=>true,canDrive:()=>canDrive,recover:()=>calls++};
 const event=(button=true,editable=false,repeat=false)=>({code:'KeyC',repeat,preventDefault(){},target:{closest:s=>s==='button'?button:editable}});
 handleRaceKeyDown(event(),actions);assert.equal(calls,1);
 handleRaceKeyDown(event(true,false,true),actions);assert.equal(calls,1);
 canDrive=false;handleRaceKeyDown(event(),actions);assert.equal(calls,1);
 canDrive=true;handleRaceKeyDown(event(false,true),actions);assert.equal(calls,1);
});

test('recovery finds a clear point behind a six-car queue beyond the former 64m search window',()=>{
 const straight={length:600,points:Array.from({length:300},(_,i)=>({x:0,z:i*2,distance:i*2,dx:0,dz:1,y:.025}))};
 const traffic=Array.from({length:6},(_,i)=>({position:{x:0,y:.5,z:400-i*12},velocity:{x:0,y:0,z:0}}));
 const found=findRecoveryPose(straight,200,[2.2,-2.2,0],traffic,(index,lane)=>routePose(straight,index,lane));
 assert.ok(found);assert.ok(found.pose.position.z<334,'must get behind the whole blocked queue');
 assert.ok(found.index<168,'the previous 32-point search could not reach this point');
 assert.ok(recoveryProgressChange(400,straight.points[found.index].distance,600)<0);
});

test('a player Supra can complete the real Namak circuit alongside sealed barriers without automatic recovery',()=>{
 const {world}=scene(),spec=VEHICLES[0],sim=create(world,spec,25,-2.2);
 try{
  let state;for(let i=0;i<180;i++)state=tick(sim,{brake:1});
  let index=25,distance=route.points[25].distance,progress=0,maxDeviation=0,steps=0;
  const watch=createRecoveryWatch({roadHalfWidth:11});
  for(;steps<120*220&&progress<route.length;steps++){
   state=tick(sim,aiInput(route,state,index,-2.2,1,[],{speedLimit:100}));
   const near=nearestRoute(route,state.position,index);index=near.index;
   progress+=forwardProgress(distance,near.point.distance,route.length);distance=near.point.distance;
   maxDeviation=Math.max(maxDeviation,near.distance);
   assert.equal(watch.update(state,near.point.y,STEP,near.distance),null);
   assert.ok(state.position.y>-.3);
  }
  const result={progress,length:route.length,maxDeviation,seconds:steps*STEP,contacts:state.contacts};
  fs.mkdirSync(new URL('../artifacts/wall-recovery-20261011/',import.meta.url),{recursive:true});
  fs.writeFileSync(new URL('../artifacts/wall-recovery-20261011/namak-lap.json',import.meta.url),JSON.stringify(result,null,2));
  console.log(result);assert.ok(progress>=route.length);assert.ok(maxDeviation<9);
 }finally{sim.dispose();world.free();}
});
