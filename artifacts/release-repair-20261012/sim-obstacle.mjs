// Headless six-car race on the recovered track colliders, mirroring runtime.js:
// player at the back of the grid, rivals per difficulty, surfaces and wall
// scraping. The "player" is driven by the same AI as a stand-in for a human.
import fs from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {initPhysics,createVehiclePhysics,STEP,stepVehicleWorld} from 'file:///D:/racing/three-rapier-idiom-racer/src/driving/physics.js';
import {PLAYER_STEERING_SENSITIVITY} from 'file:///D:/racing/three-rapier-idiom-racer/src/driving/steering.js';
import {nearestRoute,routePose,forwardProgress,aiInput} from 'file:///D:/racing/three-rapier-idiom-racer/src/rebuild/course.js';
import {RACE_TUNING,RACE_GRID_LANE,playerRaceTuning} from 'file:///D:/racing/three-rapier-idiom-racer/src/rebuild/vehicleDynamics.js';
import {VEHICLES} from 'file:///D:/racing/three-rapier-idiom-racer/src/rebuild/fleet.js';
import {raceRoster} from 'file:///D:/racing/three-rapier-idiom-racer/src/rebuild/raceMode.js';
import {onlineRoster} from 'file:///D:/racing/three-rapier-idiom-racer/src/rebuild/onlineProtocol.js';
import {recoveredCollider} from 'file:///D:/racing/three-rapier-idiom-racer/src/rebuild/worldCollision.js';
import {createRivalPlanner} from './planner-obstacle.mjs';
import {createOvertakeRoadCheck} from 'file:///D:/racing/three-rapier-idiom-racer/src/rebuild/overtakeRoad.js';
import {difficultyById,difficultyPace} from 'file:///D:/racing/three-rapier-idiom-racer/src/rebuild/raceDifficulty.js';
import {createSurfaceMap,touchingWall} from 'file:///D:/racing/three-rapier-idiom-racer/src/rebuild/raceSurface.js';
import {RACE_NITRO,slipstream} from 'file:///D:/racing/three-rapier-idiom-racer/src/rebuild/raceRules.js';
import {TRACKS} from 'file:///D:/racing/three-rapier-idiom-racer/src/rebuild/tracks.js';
import {createRoadTraffic} from 'file:///D:/racing/three-rapier-idiom-racer/src/rebuild/roadTraffic.js';

import {createWeatherSurfaceQuery,weatherSpeedProfile} from 'file:///D:/racing/three-rapier-idiom-racer/src/rebuild/weather.js';

const COLLIDERS={coastal:'unity-recovery',namak:'namak-20261010'};
export function loadTrack(id){
 const track=TRACKS.find(t=>t.id===id);
 const route=JSON.parse(fs.readFileSync(new URL(`../../public/assets/rebuild/${track.route}`,import.meta.url)));
 const fixture=track.collisionFixture??COLLIDERS[id];
 const binary=fs.readFileSync(new URL(`../../artifacts/${fixture}/colliders.bin`,import.meta.url));
 const manifest=JSON.parse(fs.readFileSync(new URL(`../../artifacts/${fixture}/colliders.json`,import.meta.url)));
 const parts=manifest.map(part=>{
  const vertices=new Float32Array(part.vertices),indices=new Uint32Array(part.indices);
  for(let i=0;i<vertices.length;i++)vertices[i]=binary.readFloatLE(part.offset+i*4);
  for(let i=0;i<indices.length;i++)indices[i]=binary.readUInt32LE(part.offset+vertices.byteLength+i*4);
  return {name:part.name,vertices,indices};
 });
 return {track,route,parts};
}
export function buildWorld(parts){
 const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;world.numSolverIterations=8;
 const asphalt=new Set(),surfaceMap=createSurfaceMap();
 for(const part of parts){
  const collider=world.createCollider(recoveredCollider(part.vertices,part.indices));
  surfaceMap.add(collider.handle,part.name);if(part.name.includes('Road_Asphalt'))asphalt.add(collider.handle);
 }
 return {world,asphalt,surfaceMap};
}

export async function runRace({trackId='coastal',difficultyId='normal',player='supra',playerProfile=null,maxSeconds=420,data=null,trace=null,laps=1,personalities=true,weather='clear',trafficCount=0,raceMode='grid',opponent='NOVA',guestVehicle='gtr'}={}){
 await initPhysics();
 const {track,route,parts}=data??loadTrack(trackId),{world,asphalt,surfaceMap}=buildWorld(parts);
 const difficulty=difficultyById(difficultyId),startIndex=25;
 const wetSurface=createWeatherSurfaceQuery(surfaceMap,weather),raceProfile=weatherSpeedProfile(difficulty.profile,weather),drivenProfile=weatherSpeedProfile(playerProfile,weather);
 const planner=createRivalPlanner(route,{roadClear:createOvertakeRoadCheck(world,route,asphalt),speedProfile:raceProfile,nitro:difficulty.nitro,personalities});
 const online=raceMode==='online',roster=online?onlineRoster(player,guestVehicle):raceRoster(player,{mode:raceMode,opponent});
 const cars=[],traffic=createRoadTraffic(world,route,{count:raceMode!=='grid'?0:trafficCount,surface:wetSurface});
 const driverPlanner=trafficCount&&raceMode==='grid'?createRivalPlanner(route,{roadClear:createOvertakeRoadCheck(world,route,asphalt),speedProfile:drivenProfile}):null;
 const driverCar={};
 try{
  for(let i=0;i<roster.length;i++){
   const {id,name,slot,rivalIndex}=roster[i],lane=slot%2===0?-RACE_GRID_LANE:RACE_GRID_LANE,index=startIndex-Math.floor(slot/2)*(track.gridRowStep??4);
   const pose=routePose(route,index,lane);
   const sim=createVehiclePhysics({sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,start:pose.position,spec:VEHICLES.find(v=>v.id===id),raceTuning:i===0||online||difficulty.id!=='easy'?playerRaceTuning(id):RACE_TUNING[id],steeringSensitivity:i===0||online?PLAYER_STEERING_SENSITIVITY:1,surface:wetSurface,nitro:i===0||online?RACE_NITRO:difficulty.rivalNitro??RACE_NITRO});
   sim.reset(pose.position,pose.yaw,{stepWorld:false});
   cars.push({id,name,sim,index,lane,player:i===0,onlineHuman:online,pace:i===0||online?1:difficultyPace(difficulty,rivalIndex),finish:null,progress:route.points[index].distance-route.points[startIndex].distance,distance:route.points[index].distance,state:sim.snapshot(),scrape:false,draft:0,draftSeconds:0,scrapeSeconds:0,offroadSeconds:0,boostSeconds:0,lowest:Infinity});
  }
  for(let i=0;i<120;i++){cars.forEach(c=>c.sim.step({brake:1},false));traffic.step(cars,false);stepVehicleWorld(world);traffic.finishStep();cars.forEach(c=>c.state=c.sim.finishStep());}
  let steps=0;
  for(;steps<maxSeconds/STEP&&cars.some(c=>c.finish==null);steps++){
   const inputs=online?new Map():planner.update(cars,STEP,traffic.cars);
   if(driverPlanner)Object.assign(driverCar,cars[0],{player:false});
   const driverInput=driverPlanner?.update([driverCar],STEP,[...cars.slice(1),...traffic.cars]).get(driverCar);
   for(const c of cars)c.draft=c.finish==null?slipstream(c.state,cars.filter(o=>o!==c).map(o=>o.state)):0;
   for(const c of cars){
    // Mirror runtime's physical 50m finish runout: parking every finished AI
    // on the timing line creates a test-only two-lane roadblock.
    let input=c.finish!=null?(!c.player&&!online&&c.finishRunout<50?aiInput(route,c.state,c.index,c.finishLane,c.pace,cars.filter(o=>o!==c).map(o=>o.state),{speedProfile:raceProfile,speedLimit:55}):{brake:1}):c.player||online?(driverInput??aiInput(route,c.state,c.index,c.lane,1,[...cars.filter(o=>o!==c),...traffic.cars].map(o=>o.state),{speedProfile:drivenProfile})):inputs.get(c);
    if(c.scrape||c.draft)input={...input,scrape:c.scrape?1:0,draft:c.draft};
    c.sim.step(input,false);
   }
   traffic.step(cars,true);stepVehicleWorld(world);traffic.finishStep();
   for(const c of cars){
    c.state=c.sim.finishStep();c.scrape=touchingWall(world,c.sim.colliders,surfaceMap.isWall);
    const near=nearestRoute(route,c.state.position,c.index);c.index=near.index;
    c.lowest=Math.min(c.lowest,c.state.position.y-near.point.y);
    if(c.finish==null){
     c.progress+=forwardProgress(c.distance,near.point.distance,route.length);
     if(c.scrape)c.scrapeSeconds+=STEP;if(c.state.surface.grip<(weather==='rain'?.9*.86:.9)){c.offroadSeconds+=STEP;c.offroadAt??=Math.round(near.point.distance);}if(c.state.action?.active)c.boostSeconds+=STEP;if(c.draft>.25)c.draftSeconds+=STEP;
     if(c.progress>=route.length*laps){c.finish=steps*STEP;c.finishRunout=0;c.finishLane=(c.state.position.x-near.point.x)*near.point.dz-(c.state.position.z-near.point.z)*near.point.dx;}
    }else if(!c.player){
     c.finishRunout+=Math.max(0,forwardProgress(c.distance,near.point.distance,route.length));
    }
    c.distance=near.point.distance;
   }
   trace?.(steps*STEP,cars,planner,traffic);
  }
  const order=[...cars].sort((a,b)=>(a.finish??1e9)-(b.finish??1e9)||b.progress-a.progress);
  return {track:track.id,raceMode,difficulty:difficulty.id,weather,traffic:traffic.snapshot(),seconds:+(steps*STEP).toFixed(2),cars:cars.map(c=>({id:c.id,name:c.name,player:c.player,place:order.indexOf(c)+1,finish:c.finish&&+c.finish.toFixed(2),metres:Math.round(c.progress),lowest:+c.lowest.toFixed(2),scrapeSeconds:+c.scrapeSeconds.toFixed(2),offroadSeconds:+c.offroadSeconds.toFixed(2),offroadAt:c.offroadAt??null,boostSeconds:+c.boostSeconds.toFixed(2),draftSeconds:+c.draftSeconds.toFixed(2),plan:planner.snapshot(c)}))};
 }finally{traffic.dispose();cars.forEach(c=>c.sim.dispose());world.free();}
}

if(import.meta.url===`file:///${process.argv[1].replace(/\\/g,'/')}`){
 const [trackId='coastal',difficultyId='normal',playerDifficulty='hard',laps='1']=process.argv.slice(2);
 console.log(JSON.stringify(await runRace({trackId,difficultyId,playerProfile:difficultyById(playerDifficulty).profile,laps:Number(laps),maxSeconds:420*Number(laps)}),null,1));
}
