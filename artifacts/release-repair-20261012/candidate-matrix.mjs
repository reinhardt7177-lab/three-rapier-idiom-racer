import fs from 'node:fs';
import {runRace} from './sim-moving-lead.mjs';
import {difficultyById} from '../../src/rebuild/raceDifficulty.js';
const group=process.argv[2]||'coastal';
const cases=group==='coastal'?[
 {trackId:'coastal',difficultyId:'normal',weather:'clear',laps:1},
 {trackId:'coastal',difficultyId:'normal',weather:'rain',laps:1},
 {trackId:'coastal',difficultyId:'easy',weather:'clear',laps:3},
]:group==='yeosu'? [1,3].flatMap(laps=>['easy','normal','hard'].map(difficultyId=>({trackId:'yeosu',difficultyId,weather:'clear',laps,trafficCount:6}))):group==='traffic-weather'?[
 {trackId:'yeosu',difficultyId:'normal',weather:'rain',laps:1,trafficCount:6},
 {trackId:'yeosu',difficultyId:'normal',weather:'rain',laps:3,trafficCount:6},
 {trackId:'yeosu',difficultyId:'normal',weather:'clear',laps:1,trafficCount:2},
 {trackId:'yeosu',difficultyId:'normal',weather:'clear',laps:1,trafficCount:4},
]:[];
if(!cases.length)throw Error('Unknown group');
const results=[],started=performance.now();
for(const config of cases){
 let minimumUp=1;
 const race=await runRace({...config,maxSeconds:420*config.laps,personalities:true,playerProfile:difficultyById('hard').profile,trace(time,cars,planner,traffic){
  for(const c of [...cars,...traffic.cars]){const q=c.state.rotation;minimumUp=Math.min(minimumUp,1-2*(q.x*q.x+q.z*q.z));}
 }});
 const finished=race.cars.every(c=>Number.isFinite(c.finish)&&c.finish>0),supported=race.cars.every(c=>c.lowest>0),upright=minimumUp>(config.trackId==='seongsamjae'?.98:.25);
 const times=race.cars.filter(c=>!c.player).map(c=>c.finish).sort((a,b)=>a-b);
 const row={...race,...config,minimumUp,median:finished?times[2]:null,finished,supported,upright};results.push(row);
 fs.writeFileSync(new URL(`candidate-${group}.json`,import.meta.url),JSON.stringify({execution:'Local Windows CPU / Rapier WASM; isolated candidate',limits:'Original 420 seconds per lap, lowest > 0, upright > 0.25 (>0.98 on Seongsamjae)',wallSeconds:(performance.now()-started)/1000,results},null,2));
 console.log(JSON.stringify({config,finished,supported,upright,minimumUp,median:row.median,cars:race.cars.map(c=>({id:c.id,finish:c.finish,lowest:c.lowest}))}));
 if(!finished||!supported||!upright){process.exitCode=1;break;}
}
if(group==='yeosu'&&results.length===6){
 for(const laps of [1,3]){const r=results.filter(r=>r.laps===laps);if(!(r[0].median>r[1].median&&r[1].median>r[2].median)){console.error('Difficulty medians do not improve',laps,r.map(r=>r.median));process.exitCode=1;}}
}
