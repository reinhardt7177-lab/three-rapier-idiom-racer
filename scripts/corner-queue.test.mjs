import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTrack,buildWorld} from './race-sim.mjs';
import {initPhysics,createVehiclePhysics,STEP,stepVehicleWorld} from '../src/driving/physics.js';
import {routePose,nearestRoute,curveSpeeds} from '../src/rebuild/course.js';
import {createRivalPlanner} from '../src/rebuild/rivalPlanner.js';
import {createOvertakeRoadCheck} from '../src/rebuild/overtakeRoad.js';
import {VEHICLES} from '../src/rebuild/fleet.js';
import {RACE_TUNING} from '../src/rebuild/vehicleDynamics.js';
import {difficultyById} from '../src/rebuild/raceDifficulty.js';
await initPhysics();
const data=loadTrack('yeosu'),route=data.route,limits=curveSpeeds(route);
test('an abandoned queue crossing releases its walking-speed cap after returning home',()=>{
 const index=211,pose=routePose(route,index,-2.2),p=route.points[index];
 const car={id:'supra',name:'NOVA',index,lane:-2.2,pace:1,finish:null,player:false,progress:p.distance,state:{position:{...pose.position},velocity:{x:0,y:0,z:0},kmh:0,contacts:4,ride:{locked:true},rotation:{x:0,y:Math.sin(pose.yaw/2),z:0,w:Math.cos(pose.yaw/2)},steeringLimit:.52}};
 const lead={...car,player:true,state:{...car.state,position:{x:pose.position.x+p.dx*18,y:pose.position.y,z:pose.position.z+p.dz*18}}};
 let crossing=true;const planner=createRivalPlanner(route,{speedProfile:difficultyById('normal').profile,roadClear:({fromLane,toLane})=>crossing||Math.abs(fromLane-toLane)<.01});
 for(let i=0;i<180;i++)planner.update([car,lead],STEP);
 assert.equal(planner.snapshot(car).mode,'changing');
 crossing=false;for(let i=0;i<60;i++)planner.update([car,lead],STEP);
 assert.equal(planner.snapshot(car).mode,'follow');
 car.state.velocity={x:p.dx*10,y:0,z:p.dz*10};car.state.kmh=36;
 let input;for(let i=0;i<60;i++)input=planner.update([car],STEP).get(car);
 const normal=createRivalPlanner(route,{speedProfile:difficultyById('normal').profile,roadClear:()=>true}).update([car],STEP).get(car);
 assert.ok(normal.targetKmh>14,'the fixture must distinguish normal bend braking from the queue cap');
 assert.equal(input.targetKmh,normal.targetKmh,'aborting must restore the full normal corner-speed envelope');
});
for(const side of [-1,1])test(`Yeosu bend: five queued rivals clear a stopped player on lane ${side} without contact or recovery`,()=>{
 const {world,asphalt,surfaceMap}=buildWorld(data.parts);world.step();
 const check=createOvertakeRoadCheck(world,route,asphalt),index=route.points.findIndex((p,i)=>i>60&&limits[i]>40&&limits[i]<65&&check({index:i,fromLane:side*2.2,toLane:-side*2.2,state:{kmh:0},dimensions:RACE_TUNING.supra}));
 assert.ok(index>=0);const cars=['supra','slk','mustang','porsche911','gtr','rx7'].map((id,k)=>{
  const i=index-k*5,lane=side*2.2,pose=routePose(route,i,lane),sim=createVehiclePhysics({sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,start:pose.position,spec:VEHICLES.find(v=>v.id===id),raceTuning:RACE_TUNING[id],surface:surfaceMap.surface});
  sim.reset(pose.position,pose.yaw,{stepWorld:false});return {id,name:k?'NOVA':'YOU',sim,index:i,lane,pace:1,player:k===0,finish:null,progress:route.points[i].distance,state:sim.snapshot()};
 });
 const d=difficultyById('normal'),planner=createRivalPlanner(route,{roadClear:check,speedProfile:d.profile,racecraft:d.racecraft});
 let contacts=0,lowest=Infinity,offroad=0;const clearAt=new Map(),touches=[];
 try{
  for(let tick=0;tick<120*35;tick++){
   const inputs=planner.update(cars,STEP);for(const c of cars)c.sim.step(c.player?{brake:1}:inputs.get(c),false);stepVehicleWorld(world);
   for(const c of cars){c.state=c.sim.finishStep();const near=nearestRoute(route,c.state.position,c.index);c.index=near.index;lowest=Math.min(lowest,c.state.position.y-near.point.y);if(c.state.surface.grip<.9)offroad++;if(!c.player&&c.index>index+8&&!clearAt.has(c.id))clearAt.set(c.id,tick*STEP);}
   for(const c of cars.slice(1))world.contactPair(c.sim.colliders[0],cars[0].sim.colliders[0],m=>{if(m.numSolverContacts()){contacts++;if(touches.length<4)touches.push({time:tick*STEP,id:c.id,index:c.index,position:c.state.position,plan:planner.snapshot(c)});}});
  }
  console.log(JSON.stringify({side,index,clearAt:Object.fromEntries(clearAt),contacts,lowest,offroad,touches}));
  assert.equal(clearAt.size,5,'every rival must actually drive past the stationary player');
  assert.equal(contacts,0,'queue escape cannot push the player');assert.equal(offroad,0);assert.ok(lowest>0);
 }finally{for(const c of cars)c.sim.dispose();world.free();}
});
