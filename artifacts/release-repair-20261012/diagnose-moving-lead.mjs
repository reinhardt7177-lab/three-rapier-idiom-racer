import fs from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {runRace,loadTrack} from './sim-moving-lead.mjs';
import {difficultyById} from '../../src/rebuild/raceDifficulty.js';
import {aiInput} from '../../src/rebuild/course.js';

const label=process.argv[2]||'baseline';
const selected=process.argv[3]||'normal-clear-1';
const cases={'normal-clear-1':{difficultyId:'normal',weather:'clear',laps:1},'normal-rain-1':{difficultyId:'normal',weather:'rain',laps:1},'easy-clear-3':{difficultyId:'easy',weather:'clear',laps:3},'yeosu-traffic':{trackId:'yeosu',difficultyId:'normal',weather:'clear',laps:1,trafficCount:6}};
const options={trackId:'coastal',...cases[selected],playerProfile:difficultyById('hard').profile};
const data=loadTrack(options.trackId),route=data.route;
const minima={},lastEvent=new Map(),events=[],stalls=[],timeline=[];
function sample(c,planner,cars,traffic,time){
 const s=c.state,p=route.points[c.index],yaw=Math.atan2(2*(s.rotation.x*s.rotation.z+s.rotation.w*s.rotation.y),1-2*(s.rotation.x**2+s.rotation.y**2));
 const hit=c.sim.world.castRayAndGetNormal(new RAPIER.Ray({x:s.position.x,y:Math.max(p.y,s.position.y)+10,z:s.position.z},{x:0,y:-1,z:0}),40,true,RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC);
 return {time,id:c.id,index:c.index,metres:c.progress,routePoint:p,position:s.position,velocity:s.velocity,kmh:s.kmh,yaw,lane:(s.position.x-p.x)*p.dz-(s.position.z-p.z)*p.dx,relativeY:s.position.y-p.y,contacts:s.contacts,ride:s.ride,surface:s.surface,drive:s.drive,brake:s.brake,steer:s.steer,finish:c.finish,plan:planner.snapshot(c),ray:hit?{height:Math.max(p.y,s.position.y)+10-hit.timeOfImpact,normal:hit.normal}:null,wheels:s.wheels,nearby:[...cars,...traffic.cars].filter(o=>o!==c&&Math.hypot(o.state.position.x-s.position.x,o.state.position.z-s.position.z)<60).map(o=>({id:o.id,name:o.name,index:o.index,finish:o.finish,position:o.state.position,kmh:o.state.kmh,plan:planner.snapshot(o)})),playerAim:c.player?aiInput(route,s,c.index,c.lane,1,[],{speedProfile:options.playerProfile}):null};
}
const started=performance.now();
const result=await runRace({...options,data,maxSeconds:420*options.laps,trace(time,cars,planner,traffic){
 for(const c of cars){
  const relative=c.state.position.y-route.points[c.index].y;
  if(!minima[c.id]||relative<minima[c.id].relativeY)minima[c.id]=sample(c,planner,cars,traffic,time);
  if(relative<0&&time-(lastEvent.get(c.id)||-10)>=.25){lastEvent.set(c.id,time);if(events.length<240)events.push(sample(c,planner,cars,traffic,time));}
  if(c.finish==null&&c.state.kmh<2&&time>20&&Math.round(time*120)%1200===0)stalls.push(sample(c,planner,cars,traffic,time));
 }
 if(Math.round(time*120)%1200===0)timeline.push({time,cars:cars.map(c=>({id:c.id,kmh:c.state.kmh,metres:c.progress,index:c.index,finish:c.finish,plan:planner.snapshot(c)}))});
}});
const report={label,selected,options:{...options,playerProfile:'hard'},execution:'Local Windows CPU / Rapier WASM',wallSeconds:(performance.now()-started)/1000,result,minima,events,stalls,timeline};
fs.writeFileSync(new URL(`${label}-${selected}.json`,import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({label,selected,wallSeconds:report.wallSeconds,result,minima:Object.fromEntries(Object.entries(minima).map(([id,s])=>[id,{time:s.time,distance:s.routePoint.distance,lane:s.lane,relativeY:s.relativeY,kmh:s.kmh,contacts:s.contacts,ground:s.ride?.ground,ray:s.ray,plan:s.plan}])),stalls:stalls.length},null,2));
