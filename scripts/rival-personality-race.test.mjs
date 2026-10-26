import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runRace} from './race-sim.mjs';
import {difficultyById} from '../src/rebuild/raceDifficulty.js';
const results=[];
for(const trackId of ['coastal','namak','yeosu','seongsamjae'])for(const laps of [1,3]){
 test(`${trackId} ${laps} laps: five pedal-only personalities finish at all difficulties`,async()=>{
  const rows=[];
  for(const difficultyId of ['easy','normal','hard']){
   let minimumUp=1;
   const race=await runRace({trackId,difficultyId,laps,maxSeconds:420*laps,personalities:true,playerProfile:difficultyById('hard').profile,trace:(time,cars)=>{
    for(const c of cars){const q=c.state.rotation;minimumUp=Math.min(minimumUp,1-2*(q.x*q.x+q.z*q.z));}
   }});
   const rivals=race.cars.filter(c=>!c.player);
   const times=rivals.map(c=>c.finish).sort((a,b)=>a-b);
   const row={...race,laps,minimumUp,median:times[2]};rows.push(row);results.push(row);
   fs.mkdirSync(new URL('../artifacts/content-resume-20261011/',import.meta.url),{recursive:true});
   fs.writeFileSync(new URL('../artifacts/content-resume-20261011/rival-personality-races.json',import.meta.url),JSON.stringify({device:'Colab CPU / Rapier WASM',results},null,2));
   assert.ok(race.cars.every(c=>Number.isFinite(c.finish)&&c.finish>0),`${trackId}/${difficultyId}/${laps}: unfinished car`);
   assert.ok(race.cars.every(c=>c.lowest>0),`${trackId}/${difficultyId}/${laps}: fell below track`);
   assert.ok(minimumUp>(trackId==='seongsamjae'?.98:.25),`${trackId}/${difficultyId}/${laps}: upright ${minimumUp}`);
   assert.deepEqual(rivals.map(c=>c.plan.personality),['NOVA','RAVEN','BLAZE','MIST','LUNA']);
  }
  assert.ok(rows[0].median>rows[1].median&&rows[1].median>rows[2].median,`${trackId}/${laps}: difficulty median must improve`);
 });
}
