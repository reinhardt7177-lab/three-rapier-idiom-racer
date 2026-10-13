import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {createRivalPlanner} from '../src/rebuild/rivalPlanner.js';
import {createOvertakeRoadCheck} from '../src/rebuild/overtakeRoad.js';
import {initPhysics,createVehiclePhysics,STEP,stepVehicleWorld} from '../src/driving/physics.js';
import {nearestRoute,routePose,forwardProgress,aiInput,curveSpeeds} from '../src/rebuild/course.js';
import {RACE_TUNING,RACE_GRID_LANE} from '../src/rebuild/vehicleDynamics.js';
import {VEHICLES,rivalFleet} from '../src/rebuild/fleet.js';
import {recoveredCollider} from '../src/rebuild/worldCollision.js';
import {RIVAL_RACE_PROFILE,rivalPace} from '../src/rebuild/rivalSpeed.js';
const straight={length:4000,points:Array.from({length:800},(_,i)=>({x:0,y:0,z:i*5,dx:0,dz:1,distance:i*5}))};
function fake(z=100,lane=-2.2,v=0,player=false){return {id:'supra',index:Math.round(z/5),lane,pace:1,progress:z,player,finish:null,state:{position:{x:lane,y:.53,z},rotation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:v},speed:v,kmh:Math.abs(v)*3.6,contacts:4,ride:{locked:true},steeringLimit:.52}};}
const free=()=>true;
const advance=(planner,cars,seconds)=>{for(let i=0;i<Math.ceil(seconds/STEP);i++)planner.update(cars,STEP);};

test('empty paved lane permits overtaking without moving snapshots or giving input to the player',()=>{
 const car=fake(),lead=fake(115,-2.2,0,true),before=JSON.stringify([car,lead]);
 const planner=createRivalPlanner(straight,{roadClear:free}),inputs=planner.update([car,lead],STEP);
 assert.equal(planner.snapshot(car).mode,'changing');assert.equal(planner.snapshot(car).targetLane,2.2);
 assert.ok(inputs.get(car).throttle>0);assert.ok(!inputs.has(lead));assert.equal(JSON.stringify([car,lead]),before);
});
test('adjacent traffic, oncoming vehicles and fast rear traffic reject the crossing',()=>{
 for(const obstacle of [fake(100,2.2),fake(145,2.2,-15),fake(200,2.2,-77),fake(70,2.2,25)]){
  const car=fake(),lead=fake(115,-2.2,0,true),planner=createRivalPlanner(straight,{roadClear:free});
  const input=planner.update([car,lead,obstacle],STEP).get(car);
  assert.equal(planner.snapshot(car).mode,'follow');assert.equal(planner.snapshot(car).reason,'occupied');
  assert.equal(input.throttle,0);assert.equal(input.brake,1);assert.ok(input.waitingForTraffic);
 }
});
test('tight bends, missing road proof, airborne cars and insufficient approach room never start a pass',()=>{
 const coast=JSON.parse(fs.readFileSync(new URL('../public/assets/rebuild/world-route.json',import.meta.url)));
 const curveIndex=coast.points.findIndex((p,i)=>p.region==='Mountain'&&curveSpeeds(coast)[i]<60);
 const scenarios=[
  {route:straight,check:()=>false,car:fake(),lead:fake(115,-2.2,0,true),reason:'road'},
  {route:straight,check:free,car:fake(),lead:fake(106,-2.2,0,true),reason:'too-close'},
  {route:straight,check:free,car:{...fake(),state:{...fake().state,contacts:0,ride:{locked:false}}},lead:fake(115,-2.2,0,true),reason:'airborne'},
 ];
 const c=fake();c.index=curveIndex;c.state.position=routePose(coast,curveIndex,-2.2).position;
 const l=fake(115,-2.2,0,true),p=coast.points[curveIndex];l.state.position={x:c.state.position.x+p.dx*15,y:c.state.position.y,z:c.state.position.z+p.dz*15};
 scenarios.push({route:coast,check:free,car:c,lead:l,reason:'curve'});
 for(const s of scenarios){const planner=createRivalPlanner(s.route,{roadClear:s.check});planner.update([s.car,s.lead],STEP);assert.equal(planner.snapshot(s.car).mode,'follow');assert.equal(planner.snapshot(s.car).reason,s.reason);}
});
test('a committed passing lane is reserved against a second closing rival',()=>{
 const front=fake(100,-2.2,8),rear=fake(55,-2.2,20),lead=fake(120,-2.2,0,true),planner=createRivalPlanner(straight,{roadClear:free});
 planner.update([rear,lead,front],STEP);assert.equal(planner.snapshot(front).mode,'changing');assert.equal(planner.snapshot(rear).mode,'follow');assert.equal(planner.snapshot(rear).reason,'occupied');
});
test('cut-in aborts safely; pause freezes the plan and recovery clears a stale target',()=>{
 const car=fake(),lead=fake(115,-2.2,0,true),planner=createRivalPlanner(straight,{roadClear:free});
 planner.update([car,lead],STEP);const before=planner.snapshot(car);planner.update([car,lead],0);assert.deepEqual(planner.snapshot(car),before);
 advance(planner,[car,lead,fake(101,2.2,0,true)],.25);assert.equal(planner.snapshot(car).mode,'aborting');assert.equal(planner.snapshot(car).targetLane,-2.2);
 planner.reset(car,2.2);assert.equal(planner.snapshot(car).mode,'follow');assert.equal(planner.snapshot(car).targetLane,2.2);
 planner.reset();assert.equal(planner.snapshot(car),null);
});
test('return waits for rear clearance and only counts a pass after physically reaching home',()=>{
 const car=fake(),lead=fake(115,-2.2,0,true),planner=createRivalPlanner(straight,{roadClear:free});planner.update([car,lead],STEP);
 car.state.position.x=2.2;advance(planner,[car,lead],.25);assert.equal(planner.snapshot(car).mode,'passing');
 car.state.position.z=120;car.index=24;advance(planner,[car,lead],.25);assert.equal(planner.snapshot(car).mode,'passing');assert.equal(planner.snapshot(car).passes,0);
 car.state.position.z=150;car.index=30;advance(planner,[car,lead],.25);assert.equal(planner.snapshot(car).mode,'returning');assert.equal(planner.snapshot(car).passes,0);
 car.state.position.x=-2.2;advance(planner,[car,lead],.25);assert.equal(planner.snapshot(car).mode,'follow');assert.equal(planner.snapshot(car).passes,1);
});
test('the original lead loses its committed exemption when it moves into the crossing',()=>{
 const car=fake(),lead=fake(110,-2.2,0,true),planner=createRivalPlanner(straight,{roadClear:free});
 planner.update([car,lead],STEP);assert.equal(planner.snapshot(car).mode,'changing');
 car.state.position.x=-.4;car.state.position.z=104;lead.state.velocity.x=3;
 advance(planner,[car,lead],.25);
 const input=planner.update([car,lead],STEP).get(car);
 assert.equal(planner.snapshot(car).reason,'occupied');assert.equal(input.throttle,0);assert.equal(input.brake,1);
});
test('a blocked return holds its current track and moves forward instead of parking across traffic',()=>{
 const car=fake(),lead=fake(115,-2.2,0,true),planner=createRivalPlanner(straight,{roadClear:free});planner.update([car,lead],STEP);
 car.state.position.x=2.2;advance(planner,[car,lead],.25);
 car.state.position.z=150;car.index=30;advance(planner,[car,lead],.25);assert.equal(planner.snapshot(car).mode,'returning');
 car.state.position.x=0;const rear=fake(145,-2.2,0,true);advance(planner,[car,lead,rear],.25);
 const input=planner.update([car,lead,rear],STEP).get(car);
 assert.equal(planner.snapshot(car).mode,'passing');assert.equal(planner.snapshot(car).targetLane,0);assert.equal(planner.snapshot(car).passes,0);
 assert.equal(input.brake,0);assert.equal(input.throttle,1);
});

test('a faster rival clears a stopped rear-car merge buffer by holding its track and driving forward',()=>{
 const car=fake(100,2.2,20),lead=fake(130,2.2,10,true),planner=createRivalPlanner(straight,{roadClear:free,speedProfile:RIVAL_RACE_PROFILE});
 planner.update([car,lead],STEP);assert.equal(planner.snapshot(car).mode,'changing');
 car.state.position.x=.2;car.state.position.z=150;car.index=30;car.state.velocity.z=0;car.state.kmh=car.state.speed=0;
 const rear=fake(145,.2,0),input=planner.update([car,lead,rear],.1);advance(planner,[car,lead,rear],.15);
 const controls=planner.update([car,lead,rear],STEP).get(car);assert.equal(planner.snapshot(car).mode,'passing');assert.equal(planner.snapshot(car).reason,'defer-crossing');assert.equal(controls.brake,0);assert.equal(controls.throttle,1);
 assert.equal(car.state.position.z,150,'planner must not move the stopped chassis');
});

test('a passing rival re-plans when a stationary car occupies its lane again on a closed circuit',()=>{
 const car=fake(100,-2.2,0),lead=fake(115,-2.2,0,true),planner=createRivalPlanner(straight,{roadClear:free,speedProfile:RIVAL_RACE_PROFILE});
 planner.update([car,lead],STEP);assert.equal(planner.snapshot(car).mode,'changing');
 car.state.position.x=2.2;advance(planner,[car,lead],.25);assert.equal(planner.snapshot(car).mode,'passing');
 lead.state.position.x=2.2;advance(planner,[car,lead],.25);
 assert.equal(planner.snapshot(car).mode,'changing');assert.equal(planner.snapshot(car).targetLane,-2.2);
 assert.equal(planner.snapshot(car).attempts,2);
});
test('a re-blocked passing rival holds its approach gap if the alternate lane is occupied',()=>{
 const car=fake(100,-2.2,0),lead=fake(115,-2.2,0,true),planner=createRivalPlanner(straight,{roadClear:free,speedProfile:RIVAL_RACE_PROFILE});
 planner.update([car,lead],STEP);car.state.position.x=2.2;advance(planner,[car,lead],.25);
 lead.state.position.x=2.2;const blocker=fake(100,-2.2,0,true);advance(planner,[car,lead,blocker],.25);
 const input=planner.update([car,lead,blocker],STEP).get(car);
 assert.equal(planner.snapshot(car).mode,'passing');assert.equal(planner.snapshot(car).reason,'stopped-ahead');
 assert.equal(input.throttle,0);assert.equal(input.brake,1);assert.ok(input.waitingForTraffic);
});

test('a lane-centred rival can leave a stopped rear bumper behind but yields to a moving rear car',()=>{
 for(const [v,expected] of [[0,'changing'],[15,'follow']]){
  const car=fake(100,-2.2,0),lead=fake(115,-2.2,0,true),rear=fake(95,-2.2,v,true);
  const planner=createRivalPlanner(straight,{roadClear:free,speedProfile:RIVAL_RACE_PROFILE});
  planner.update([car,lead,rear],STEP);assert.equal(planner.snapshot(car).mode,expected);
 }
});

await initPhysics();
test('road proof rejects narrow asphalt, grass and an obstacle on the paved crossing',()=>{
 for(const [halfWidth,wall,expected] of [[6,false,true],[3,false,false],[6,true,false]]){
  const world=new RAPIER.World({x:0,y:-9.81,z:0});
  try{
   const floor=world.createCollider(RAPIER.ColliderDesc.cuboid(halfWidth,.5,100).setTranslation(0,-.5,100));
   world.createCollider(RAPIER.ColliderDesc.cuboid(100,.5,100).setTranslation(0,-.6,100));
   if(wall)world.createCollider(RAPIER.ColliderDesc.cuboid(.3,.75,1).setTranslation(0,.75,110));world.step();
   const check=createOvertakeRoadCheck(world,straight,new Set([floor.handle]));
   assert.equal(check({index:20,fromLane:-2.2,toLane:2.2,state:fake().state,dimensions:RACE_TUNING.supra}),expected);
  }finally{world.free();}
 }
});

function physicalCars(world,positions){
 return positions.map(([id,z,lane,player])=>{
  const sim=createVehiclePhysics({sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,raceTuning:RACE_TUNING[id],spec:VEHICLES.find(v=>v.id===id),start:{x:lane,y:.53,z}});
  sim.reset({x:lane,y:.53,z},0,{stepWorld:false});return {id,sim,index:Math.round(z/5),lane,pace:1,progress:z,player,finish:null,state:sim.snapshot()};
 });
}
function tick(world,cars,inputs){
 cars.forEach(c=>c.sim.step(c.player?{brake:1}:inputs.get(c),false));stepVehicleWorld(world);
 cars.forEach(c=>{c.state=c.sim.finishStep();c.index=nearestRoute(straight,c.state.position,c.index).index;});
}
for(const id of VEHICLES.map(v=>v.id))test(`${id}: Rapier AI passes a stopped player and returns without contact`,()=>{
 const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;world.numSolverIterations=8;
 const floor=world.createCollider(RAPIER.ColliderDesc.cuboid(6,.5,600).setTranslation(0,-.5,400));
 const cars=physicalCars(world,[[id,100,-2.2,false],['mustang',110,-2.2,true]]),[car,player]=cars;
 const planner=createRivalPlanner(straight,{roadClear:createOvertakeRoadCheck(world,straight,new Set([floor.handle]))});
 try{
  for(let i=0;i<240;i++)tick(world,cars,new Map([[car,{brake:1}]]));
  const start={...player.state.position};let contacts=0,maxLane=-Infinity;
  for(let i=0;i<120*25&&planner.snapshot(car)?.passes!==1;i++){
   tick(world,cars,planner.update(cars,STEP));maxLane=Math.max(maxLane,car.state.position.x);
   world.contactPair(car.sim.colliders[0],player.sim.colliders[0],m=>{if(m.numSolverContacts())contacts++;});
   assert.ok(Math.abs(car.state.position.x)<3.25,'left the two paved lanes');assert.equal(car.state.contacts,4);
  }
  console.log('physical overtake',{id,contacts,maxLane,plan:planner.snapshot(car),position:car.state.position});
  assert.equal(contacts,0,'planned pass touched the player');assert.equal(planner.snapshot(car).passes,1);
  assert.ok(car.state.position.z>player.state.position.z+16);assert.ok(Math.abs(car.state.position.x+2.2)<.6);
  assert.ok(Math.hypot(player.state.position.x-start.x,player.state.position.z-start.z)<.05,'pass pushed a stopped player');
 }finally{cars.forEach(c=>c.sim.dispose());world.free();}
});

test('five faster planned rivals and a slower driven player complete the recovered 6.84 km course',()=>{
 const route=JSON.parse(fs.readFileSync(new URL('../public/assets/rebuild/world-route.json',import.meta.url)));
 const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;world.numSolverIterations=8;
 const binary=fs.readFileSync(new URL('../artifacts/unity-recovery/colliders.bin',import.meta.url));
 const manifest=JSON.parse(fs.readFileSync(new URL('../artifacts/unity-recovery/colliders.json',import.meta.url))),asphalt=new Set();
 for(const part of manifest){
  const vertices=new Float32Array(part.vertices),indices=new Uint32Array(part.indices);
  for(let i=0;i<vertices.length;i++)vertices[i]=binary.readFloatLE(part.offset+i*4);
  for(let i=0;i<indices.length;i++)indices[i]=binary.readUInt32LE(part.offset+vertices.byteLength+i*4);
  const collider=world.createCollider(recoveredCollider(vertices,indices));if(part.name.includes('Road_Asphalt'))asphalt.add(collider.handle);
 }
 const cars=[];
 const planner=createRivalPlanner(route,{roadClear:createOvertakeRoadCheck(world,route,asphalt),speedProfile:RIVAL_RACE_PROFILE});
 try{
  for(let i=0;i<6;i++){
   const index=25-Math.floor(i/2)*4,lane=i%2===0?-RACE_GRID_LANE:RACE_GRID_LANE,pose=routePose(route,index,lane),id=i===0?'supra':rivalFleet('supra')[i-1];
   const sim=createVehiclePhysics({sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,start:pose.position,spec:VEHICLES.find(v=>v.id===id),raceTuning:RACE_TUNING[id]});
   sim.reset(pose.position,pose.yaw,{stepWorld:false});cars.push({id,sim,index,lane,player:i===0,pace:i===0?.83:rivalPace(i-1),finish:null,progress:route.points[index].distance-route.points[25].distance,distance:route.points[index].distance,state:sim.snapshot()});
  }
  for(let i=0;i<120;i++){cars.forEach(c=>c.sim.step({brake:1},false));stepVehicleWorld(world);cars.forEach(c=>c.state=c.sim.finishStep());}
  let steps=0;
  for(;steps<120*450&&cars.some(c=>c.finish==null);steps++){
   const inputs=planner.update(cars,STEP);
   cars.forEach(c=>c.sim.step(c.finish!=null?{brake:1}:c.player?aiInput(route,c.state,c.index,c.lane,c.pace,cars.filter(o=>o!==c).map(o=>o.state)):inputs.get(c),false));
   stepVehicleWorld(world);
   cars.forEach(c=>{
    c.state=c.sim.finishStep();const near=nearestRoute(route,c.state.position,c.index);c.index=near.index;
    if(c.finish==null){c.progress+=forwardProgress(c.distance,near.point.distance,route.length);if(c.progress>=route.length)c.finish=steps*STEP;}
    c.distance=near.point.distance;assert.ok(Number.isFinite(c.state.position.y));assert.ok(c.state.position.y>near.point.y-5,'fell below the recovered road');
   });
  }
  const results=cars.map(c=>({id:c.id,metres:Math.round(c.progress),finish:c.finish,index:c.index,position:c.state.position,velocity:c.state.velocity,contacts:c.state.contacts,region:route.points[c.index].region,plan:planner.snapshot(c)}));
  console.log('Planner recovered-map race',{seconds:steps*STEP,results});
  fs.mkdirSync(new URL('../artifacts/rival-ai-20261010/',import.meta.url),{recursive:true});
  fs.writeFileSync(new URL('../artifacts/rival-ai-20261010/full-course.json',import.meta.url),JSON.stringify(results,null,2));
  for(const c of cars)assert.ok(c.finish!=null,`${c.id} stalled at ${Math.round(c.progress)}m / ${JSON.stringify(planner.snapshot(c))}`);
  assert.ok(cars.reduce((sum,c)=>sum+(planner.snapshot(c)?.passes||0),0)>0,'no actual overtaking and return occurred');
 }finally{cars.forEach(c=>c.sim.dispose());world.free();}
});
