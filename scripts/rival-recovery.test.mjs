import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import {recoveryState,recoveryPath,updateRivalRecovery} from '../src/rebuild/rivalRecovery.js';
import {createRecoveryRoadCheck} from '../src/rebuild/recoveryRoad.js';
import {loadTrack,buildWorld} from './race-sim.mjs';
import {initPhysics,createVehiclePhysics,STEP,stepVehicleWorld} from '../src/driving/physics.js';
import {nearestRoute,forwardProgress} from '../src/rebuild/course.js';
import {createRivalPlanner} from '../src/rebuild/rivalPlanner.js';
import {createOvertakeRoadCheck} from '../src/rebuild/overtakeRoad.js';
import {difficultyById} from '../src/rebuild/raceDifficulty.js';
import {RACE_TUNING} from '../src/rebuild/vehicleDynamics.js';
import {VEHICLES} from '../src/rebuild/fleet.js';

const route={points:[{x:0,y:0,z:0,dx:0,dz:1}]};
function car(yaw=1.2,z=0){return {id:'supra',index:0,player:false,finish:null,state:{position:{x:0,y:.53,z},rotation:{x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)},velocity:{x:0,y:0,z:0},kmh:0,contacts:4,ride:{locked:true},steeringLimit:.52}};}
function wait(s,c,cars=[c],pathClear=()=>true){let input;for(let i=0;i<360;i++)input=updateRivalRecovery(s,{route,car:c,cars,dt:STEP,pathClear});return input;}

test('recovery requires a sustained physical standstill and never moves the car snapshot',()=>{
 for(const sign of [-1,1]){
  const c=car(sign*1.2),s=recoveryState(),before=JSON.stringify(c);
  for(let i=0;i<299;i++)assert.equal(updateRivalRecovery(s,{route,car:c,cars:[c],dt:STEP,pathClear:()=>true}),null);
  const input=wait(s,c);assert.equal(input.reverse,.45);assert.equal(input.steer,-sign);assert.equal(input.throttle,0);assert.equal(s.attempts,1);
  assert.equal(JSON.stringify(c),before,'controller cannot write transforms, velocity or progression');
 }
});
test('pause, humans, finished cars, airborne wheels and lateral motion cannot begin reversing',()=>{
 for(const change of [c=>c.player=true,c=>c.finish=5,c=>c.state.contacts=0,c=>c.state.ride.locked=false,c=>c.state.velocity.x=1]){
  const c=car(),s=recoveryState();change(c);assert.equal(wait(s,c),null);assert.equal(s.attempts,0);
 }
 const c=car(),s=recoveryState(),before=JSON.stringify(s);
 for(let i=0;i<500;i++)assert.equal(updateRivalRecovery(s,{route,car:c,cars:[c],dt:0,pathClear:()=>true}),null);
 assert.equal(JSON.stringify(s),before);
 assert.equal(wait(recoveryState(),car(0)),null,'ordinary aligned waiting is not a fault');
});
test('rear/path refusal holds the existing queue; a newly blocked reverse immediately brakes',()=>{
 const c=car(),s=recoveryState();assert.equal(wait(s,c,[c],()=>false),null);assert.equal(s.attempts,0);
 assert.ok(wait(s,c).reverse);s.checkIn=0;
 const input=updateRivalRecovery(s,{route,car:c,cars:[c],dt:STEP,pathClear:()=>false});
 assert.equal(input.reverse,0);assert.equal(input.brake,1);
});
test('a compressed stopped queue backs up straight, while an aligned moving queue does not',()=>{
 const c=car(0),lead=car(0,6),s=recoveryState(),before=JSON.stringify([c,lead]);
 const input=wait(s,c,[c,lead]);assert.equal(input.reverse,.45);assert.equal(input.steer,0);assert.equal(s.backout,4);
 assert.equal(JSON.stringify([c,lead]),before);
 lead.state.kmh=10;assert.equal(wait(recoveryState(),c,[c,lead]),null);
});
test('reverse arc moves physically backwards and reduces either sign of a bad heading',()=>{
 for(const sign of [-1,1]){const c=car(sign*1.2),poses=recoveryPath(c,-sign,2),p=poses.at(-1);assert.ok(Math.abs(p.yaw)<1.2);assert.ok(p.z<0);assert.ok(p.x*sign<0);assert.deepEqual(c.state.position,{x:0,y:.53,z:0});}
});

await initPhysics();
test('actual-pose recovery proof refuses a road edge, rear wall, stationary rear car and fast rear traffic',()=>{
 const world=new RAPIER.World({x:0,y:-9.81,z:0});
 try{
  const floor=world.createCollider(RAPIER.ColliderDesc.cuboid(6,.5,100).setTranslation(0,-.5,0));world.step();
  const check=createRecoveryRoadCheck(world,new Set([floor.handle])),c=car(0),args={car:c,cars:[c],steer:0,distance:2};
  assert.equal(check(args),true);
  c.state.position.x=5.8;assert.equal(check(args),false);c.state.position.x=0;
  const rear=car(0,-6);assert.equal(check({...args,cars:[c,rear]}),false);
  rear.state.position.z=-20;rear.state.velocity.z=16;rear.state.kmh=57.6;assert.equal(check({...args,cars:[c,rear]}),false);
  const compressedFront=car(0,4.6);assert.equal(check({...args,cars:[c,compressedFront]}),true,'reverse must be allowed to leave an already compressed front buffer');
  const compressedRear=car(0,-4.6);assert.equal(check({...args,cars:[c,compressedRear]}),false,'reverse cannot deepen the rear buffer');
  const wall=world.createCollider(RAPIER.ColliderDesc.cuboid(1,.75,.3).setTranslation(0,.75,-3));world.step();assert.equal(check(args),false);
  world.removeCollider(wall,true);
 }finally{world.free();}
});

test('observed coastal wall pose reverses, regains its lane and drives 50m within 12 seconds without leaving asphalt',()=>{
 const data=loadTrack('coastal'),{route}=data,{world,asphalt,surfaceMap}=buildWorld(data.parts);
 // NOVA at t=369s in the rejected handling experiment. Only this starting
 // pose is reused; all live motion below uses the current stable physics.
 const position={x:-356.7684631347656,y:52.7160758972168,z:484.950439453125};
 const q={x:-.01664356328547001,y:-.6802777647972107,z:.0019687535241246223,w:.73276287317276};
 const yaw=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.y*q.y+q.x*q.x));
 const sim=createVehiclePhysics({sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,start:position,spec:VEHICLES.find(v=>v.id==='slk'),raceTuning:RACE_TUNING.slk,surface:surfaceMap.surface});
 sim.reset(position,yaw,{stepWorld:false});
 const c={id:'slk',name:'NOVA',sim,index:1726,lane:-2.2,pace:1,player:false,finish:null,progress:0,state:sim.snapshot()};
 const planner=createRivalPlanner(route,{roadClear:createOvertakeRoadCheck(world,route,asphalt),speedProfile:difficultyById('easy').profile,personalities:true});
 let distance=route.points[c.index].distance,offroad=0,lowest=Infinity,reverse=0;
 try{
  for(let i=0;i<120*12;i++){
   const input=planner.update([c],STEP).get(c);if(input.reverse)reverse++;
   sim.prepareStep(input);stepVehicleWorld(world);c.state=sim.finishStep();
   const near=nearestRoute(route,c.state.position,c.index);c.index=near.index;c.progress+=forwardProgress(distance,near.point.distance,route.length);distance=near.point.distance;
   lowest=Math.min(lowest,c.state.position.y-near.point.y);if(c.state.surface.grip<.9)offroad++;
  }
  console.log(JSON.stringify({wallRecovery:{metres:c.progress,kmh:c.state.kmh,lowest,offroad,reverseSeconds:reverse*STEP,plan:planner.snapshot(c)}}));
  assert.ok(reverse>0);assert.ok(c.progress>50);assert.equal(offroad,0);assert.ok(lowest>.2);assert.equal(c.state.contacts,4);assert.equal(planner.snapshot(c).reverseAttempts,1);
 }finally{sim.dispose();world.free();}
});

test('five compressed rivals back out and pass a stopped player without any chassis contact or off-road motion',()=>{
 const route={length:4000,points:Array.from({length:800},(_,i)=>({x:0,y:0,z:i*5,dx:0,dz:1,distance:i*5}))};
 const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;world.numSolverIterations=8;
 const floor=world.createCollider(RAPIER.ColliderDesc.cuboid(6,.5,2100).setTranslation(0,-.5,2000));
 const cars=['supra','slk','mustang','porsche911','gtr','rx7'].map((id,i)=>{
  const position={x:-2.2,y:.53,z:160-i*5},spec=VEHICLES.find(v=>v.id===id);
  const sim=createVehiclePhysics({sharedWorld:world,barriers:false,arcade:true,launchEnabled:false,progressiveAcceleration:true,start:position,spec,raceTuning:RACE_TUNING[id]});
  sim.reset(position,0,{stepWorld:false});return {id,name:i?'RIVAL '+i:'YOU',sim,index:Math.round(position.z/5),lane:-2.2,pace:1,player:!i,finish:null,state:sim.snapshot()};
 });
 const planner=createRivalPlanner(route,{roadClear:createOvertakeRoadCheck(world,route,new Set([floor.handle])),speedProfile:difficultyById('normal').profile});
 const passed=new Map();let contacts=0,maxLane=0,lowest=Infinity;
 try{
  for(let i=0;i<120*60&&passed.size<5;i++){
   const inputs=planner.update(cars,STEP);for(const c of cars)c.sim.prepareStep(c.player?{brake:1}:inputs.get(c));stepVehicleWorld(world);
   for(const c of cars){c.state=c.sim.finishStep();c.index=nearestRoute(route,c.state.position,c.index).index;maxLane=Math.max(maxLane,Math.abs(c.state.position.x));lowest=Math.min(lowest,c.state.position.y);if(!c.player&&c.state.position.z>168&&!passed.has(c.id))passed.set(c.id,i*STEP);}
   for(let a=0;a<cars.length;a++)for(let b=a+1;b<cars.length;b++)world.contactPair(cars[a].sim.colliders[0],cars[b].sim.colliders[0],m=>{if(m.numSolverContacts())contacts++;});
  }
  console.log(JSON.stringify({compressedQueue:{passed:Object.fromEntries(passed),contacts,maxLane,lowest}}));
  assert.equal(passed.size,5);assert.equal(contacts,0);assert.ok(maxLane<3.4);assert.ok(lowest>.2);
  assert.ok(Math.hypot(cars[0].state.position.x+2.2,cars[0].state.position.z-160)<.05,'the stopped human cannot be pushed out of the way');
 }finally{cars.forEach(c=>c.sim.dispose());world.free();}
});
