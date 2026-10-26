import fs from 'node:fs';
import {runRace,loadTrack} from './race-sim.mjs';
import {difficultyById} from '../src/rebuild/raceDifficulty.js';
import {curveSpeeds} from '../src/rebuild/course.js';
const data=loadTrack('yeosu'),samples=[];
const run=process.argv[2]??'1';
const result=await runRace({data,difficultyId:'normal',trafficCount:Number(process.argv[3]??0),playerProfile:difficultyById('hard').profile,maxSeconds:Number(process.argv[4]??240),trace:(t,cars,planner,traffic)=>{
 if(Math.round(t*120)%120)return;
 samples.push({time:t,cars:cars.map(c=>{const p=data.route.points[c.index];return {id:c.id,progress:c.progress,index:c.index,region:p.region,lane:(c.state.position.x-p.x)*p.dz-(c.state.position.z-p.z)*p.dx,curveLimit:curveSpeeds(data.route,difficultyById('normal').profile)[c.index],state:c.state,plan:planner.snapshot(c)};}),traffic:traffic.snapshot()});
}});
fs.writeFileSync(new URL(`../artifacts/yeosu-map-traffic-20261012/jam-diagnostic-${run}.json`,import.meta.url),JSON.stringify({result,samples},null,2));
console.log(JSON.stringify(result.cars));
