import fs from 'node:fs';
import {runRace} from '../../scripts/race-sim.mjs';
import {difficultyById} from '../../src/rebuild/raceDifficulty.js';
const results=[];
for(const trackId of ['coastal','namak','yeosu','seongsamjae']){
 let minimumUp=1,peakStep=0,last=new Map();
 const row=await runRace({trackId,difficultyId:'normal',playerProfile:difficultyById('hard').profile,maxSeconds:420,trace:(t,cars)=>{
  for(const c of cars){const q=c.state.rotation;minimumUp=Math.min(minimumUp,1-2*(q.x*q.x+q.z*q.z));if(last.has(c))peakStep=Math.max(peakStep,Math.hypot(c.state.position.x-last.get(c).x,c.state.position.y-last.get(c).y,c.state.position.z-last.get(c).z));last.set(c,c.state.position);}
 }});
 results.push({...row,minimumUp,peakStep});fs.writeFileSync(new URL('laps-after-candidate-1.json',import.meta.url),JSON.stringify({device:'Local Windows CPU / Rapier WASM',player:'hard-profile bot without nitro input',traffic:0,results},null,2));
 console.log(JSON.stringify({trackId,finishes:row.cars.map(c=>c.finish),minimumUp,peakStep,player:row.cars[0]}));
 if(row.cars.some(c=>!Number.isFinite(c.finish))){process.exitCode=1;break;}
}
