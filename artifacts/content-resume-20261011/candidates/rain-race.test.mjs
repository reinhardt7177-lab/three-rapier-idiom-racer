import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runRace} from './race-sim.mjs';
import {difficultyById} from '../src/rebuild/raceDifficulty.js';
const results=[];
const cases=[...['coastal','namak'].map(trackId=>({trackId,difficultyId:'normal',laps:1})),...['yeosu','seongsamjae'].flatMap(trackId=>[1,3].flatMap(laps=>['easy','normal','hard'].map(difficultyId=>({trackId,difficultyId,laps}))))];
for(const scenario of cases)test(`${scenario.trackId} rain ${scenario.difficultyId} ${scenario.laps} laps: six real cars finish on wet contacts`,async()=>{
 let minimumUp=1;const wetCars=new Set();
 const race=await runRace({...scenario,weather:'rain',personalities:true,maxSeconds:420*scenario.laps,playerProfile:difficultyById('hard').profile,trace:(t,cars)=>{
  for(const car of cars){const q=car.state.rotation;minimumUp=Math.min(minimumUp,1-2*(q.x*q.x+q.z*q.z));if(Math.abs(car.state.surface.grip-.86)<1e-7)wetCars.add(car.id);}
 }});
 results.push({...race,laps:scenario.laps,minimumUp,wetCars:[...wetCars]});
 fs.mkdirSync(new URL('../artifacts/content-resume-20261011/',import.meta.url),{recursive:true});
 fs.writeFileSync(new URL('../artifacts/content-resume-20261011/rain-races.json',import.meta.url),JSON.stringify({device:'Colab CPU / Rapier WASM',results},null,2));
 assert.equal(wetCars.size,6,'every car must sample actual wet-road contact friction');
 assert.ok(race.cars.every(c=>Number.isFinite(c.finish)&&c.finish>0),'all six cars must finish');
 assert.ok(race.cars.every(c=>c.lowest>0),'no car may fall below the track');
 assert.ok(minimumUp>(scenario.trackId==='seongsamjae'?.98:.25),`upright ${minimumUp}`);
 if(scenario.difficultyId==='hard'){
  const rows=results.filter(r=>r.track===scenario.trackId&&r.laps===scenario.laps);
  const medians=['easy','normal','hard'].map(id=>rows.find(r=>r.difficulty===id).cars.filter(c=>!c.player).map(c=>c.finish).sort((a,b)=>a-b)[2]);
  assert.ok(medians[0]>medians[1]&&medians[1]>medians[2],`rain difficulty medians must improve: ${medians}`);
 }
});
