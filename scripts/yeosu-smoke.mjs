import fs from 'node:fs';
import {runRace} from './race-sim.mjs';
import {difficultyById} from '../src/rebuild/raceDifficulty.js';
const dir=new URL('../artifacts/yeosu-map-traffic-20261012/',import.meta.url);
const rows=[],runId=process.argv[2]??'1';
for(const trafficCount of process.argv[3]?[Number(process.argv[3])]:[0,6]){
 let minimumUp=1,lowestTraffic=Infinity;const samples=[];
 const row=await runRace({trackId:'yeosu',difficultyId:'normal',trafficCount,playerProfile:difficultyById('hard').profile,maxSeconds:420,trace:(t,cars,planner,traffic)=>{
  for(const c of cars){const q=c.state.rotation;minimumUp=Math.min(minimumUp,1-2*(q.x*q.x+q.z*q.z));}
  for(const c of traffic.cars)lowestTraffic=Math.min(lowestTraffic,c.state.position.y);
  if(Math.round(t*120)%2400===0)samples.push({time:+t.toFixed(1),cars:cars.map(c=>({metres:Math.round(c.progress),kmh:Math.round(c.state.kmh),plan:planner.snapshot(c)})),traffic:traffic.snapshot()});
 }});
 rows.push({...row,minimumUp,lowestTraffic:Number.isFinite(lowestTraffic)?lowestTraffic:null,samples});
 fs.writeFileSync(new URL(`smoke-${runId}.json`,dir),JSON.stringify(rows,null,2));
 console.log(JSON.stringify({trafficCount,seconds:row.seconds,finishes:row.cars.map(c=>c.finish),minimumUp,lowestTraffic}));
 if(row.cars.some(c=>!Number.isFinite(c.finish)||c.lowest<=0)){process.exitCode=1;break;}
}
