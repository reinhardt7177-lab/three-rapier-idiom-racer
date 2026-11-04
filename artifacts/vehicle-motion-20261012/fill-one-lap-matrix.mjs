import fs from 'node:fs';
import {runRace} from '../../scripts/race-sim.mjs';
import {difficultyById} from '../../src/rebuild/raceDifficulty.js';
const dry=JSON.parse(fs.readFileSync(new URL('final-test-evidence/artifacts/content-resume-20261011/rival-personality-races.json',import.meta.url)));
const rows=dry.results.filter(r=>r.laps===1),added=[];
for(const trackId of ['coastal','namak','yeosu','seongsamjae'])for(const difficultyId of ['easy','normal','hard']){
 if(rows.some(r=>r.track===trackId&&r.difficulty===difficultyId))continue;
 let minimumUp=1;
 const race=await runRace({trackId,difficultyId,laps:1,maxSeconds:420,personalities:true,playerProfile:difficultyById('hard').profile,trace:(time,cars)=>{for(const c of cars){const q=c.state.rotation;minimumUp=Math.min(minimumUp,1-2*(q.x*q.x+q.z*q.z));}}});
 const row={...race,laps:1,minimumUp,median:race.cars.filter(c=>!c.player).map(c=>c.finish).sort((a,b)=>a-b)[2]};rows.push(row);added.push(row);
 fs.writeFileSync(new URL('one-lap-added-races.json',import.meta.url),JSON.stringify({device:'Local Windows CPU / Rapier WASM',results:added},null,2));
 console.log({track:row.track,difficulty:row.difficulty,finished:row.cars.filter(c=>Number.isFinite(c.finish)).length,lowest:Math.min(...row.cars.map(c=>c.lowest))});
}
const outcomes=rows.map(r=>({...r,passed:r.cars.every(c=>Number.isFinite(c.finish)&&c.finish>0&&c.lowest>0)&&r.minimumUp>(r.track==='seongsamjae'?.98:.25)}));
fs.writeFileSync(new URL('one-lap-matrix.json',import.meta.url),JSON.stringify({device:'Local Windows CPU / Rapier WASM',traffic:0,recovery:'no recovery or teleport routine called',source:'Final full-check one-lap rows plus only missing conditions; all failures retained',results:outcomes,passed:outcomes.filter(r=>r.passed).length,cases:outcomes.length},null,2));
console.log({cases:outcomes.length,passed:outcomes.filter(r=>r.passed).length,finishedCars:outcomes.reduce((n,r)=>n+r.cars.filter(c=>Number.isFinite(c.finish)).length,0)});
process.exitCode=outcomes.every(r=>r.passed)?0:1;
