import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runRace} from './race-sim.mjs';
import {difficultyById} from '../src/rebuild/raceDifficulty.js';
const results=[];
for(const config of [{difficultyId:'easy',weather:'clear',laps:1},{difficultyId:'normal',weather:'clear',laps:1},{difficultyId:'normal',weather:'rain',laps:3}]){
 test(`Yeosu civilian traffic: ${config.difficultyId}/${config.weather}/${config.laps} laps finishes without leaving asphalt`,async()=>{
  let minimumUp=1;
  const race=await runRace({trackId:'yeosu',...config,trafficCount:6,maxSeconds:420*config.laps,personalities:true,playerProfile:difficultyById('hard').profile,
   trace(time,cars,planner,traffic){for(const c of [...cars,...traffic.cars]){const q=c.state.rotation;minimumUp=Math.min(minimumUp,1-2*(q.x*q.x+q.z*q.z));}}});
  const row={...race,...config,trafficCount:6,minimumUp};results.push(row);
  const out=new URL('../artifacts/release-repair-20261012/traffic-races.json',import.meta.url);
  fs.mkdirSync(new URL('.',out),{recursive:true});fs.writeFileSync(out,JSON.stringify({runtime:process.platform,physics:'Node / Rapier WASM',results},null,2));
  assert.equal(race.cars.length,6);assert.equal(race.traffic.count,6);
  assert.ok(race.cars.every(c=>Number.isFinite(c.finish)&&c.finish>0),'all racers finish within the unchanged 420 seconds per lap');
  assert.ok(race.cars.every(c=>c.lowest>0&&c.offroadSeconds===0),'all racers stay on asphalt');
  assert.ok(minimumUp>.98,'racers and civilians stay upright');
  console.log(JSON.stringify({config,minimumUp,cars:race.cars.map(c=>({id:c.id,finish:c.finish,lowest:c.lowest}))}));
 });
}
