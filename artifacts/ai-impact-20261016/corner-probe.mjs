import fs from 'node:fs';
import {loadTrack,buildWorld} from '../../scripts/race-sim.mjs';
import {initPhysics,createVehiclePhysics,STEP,stepVehicleWorld} from '../../src/driving/physics.js';
import {routePose,nearestRoute,curveSpeeds} from '../../src/rebuild/course.js';
import {createRivalPlanner} from '../../src/rebuild/rivalPlanner.js';
import {createOvertakeRoadCheck} from '../../src/rebuild/overtakeRoad.js';
import {VEHICLES} from '../../src/rebuild/fleet.js';
import {RACE_TUNING} from '../../src/rebuild/vehicleDynamics.js';
import {difficultyById} from '../../src/rebuild/raceDifficulty.js';
await initPhysics();
const label=process.argv[2]||'baseline',data=loadTrack('yeosu'),{route}=data,limits=curveSpeeds(route);
const rows=[];
for(const side of [-1,1]){
 const {world,asphalt,surfaceMap}=buildWorld(data.parts);world.step();const check=createOvertakeRoadCheck(world,route,asphalt);
 const index=route.points.findIndex((p,i)=>i>60&&limits[i]<65&&limits[i]>40&&check({index:i,fromLane:side*2.2,toLane:-side*2.2,state:{kmh:0},dimensions:RACE_TUNING.supra}));
 if(index<0)throw Error('No paved curve fixture');
 const cars=[['supra',index,true],['slk',index-5,false],['mustang',index-10,false]].map(([id,i,player])=>{
  const lane=side*2.2,pose=routePose(route,i,lane),sim=createVehiclePhysics({sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,start:pose.position,spec:VEHICLES.find(v=>v.id===id),raceTuning:RACE_TUNING[id],surface:surfaceMap.surface});sim.reset(pose.position,pose.yaw,{stepWorld:false});
  return {id,name:player?'YOU':'NOVA',sim,index:i,lane,pace:1,player,finish:null,progress:route.points[i].distance,state:sim.snapshot()};
 });
 const planner=createRivalPlanner(route,{roadClear:check,speedProfile:difficultyById('normal').profile,racecraft:difficultyById('normal').racecraft});
 let contacts=0,lowest=Infinity;const samples=[];
 for(let i=0;i<120*35;i++){
  const input=planner.update(cars,STEP);for(const c of cars)c.sim.step(c.player?{brake:1}:input.get(c),false);
  stepVehicleWorld(world);
  for(const c of cars){c.state=c.sim.finishStep();const near=nearestRoute(route,c.state.position,c.index);c.index=near.index;lowest=Math.min(lowest,c.state.position.y-near.point.y);}
  for(const c of cars.slice(1))world.contactPair(c.sim.colliders[0],cars[0].sim.colliders[0],m=>{if(m.numSolverContacts())contacts++;});
  if(i%120===0)samples.push({time:i/120,cars:cars.map(c=>({id:c.id,index:c.index,kmh:c.state.kmh,plan:planner.snapshot(c)}))});
 }
 rows.push({side,index,curveLimit:limits[index],contacts,lowest,cars:cars.map(c=>({id:c.id,index:c.index,kmh:c.state.kmh,plan:planner.snapshot(c)})),samples});
 for(const c of cars)c.sim.dispose();world.free();
}
fs.writeFileSync(`artifacts/ai-impact-20261016/corner-${label}.json`,JSON.stringify(rows,null,2));console.log(JSON.stringify(rows.map(({samples,...r})=>r),null,2));
