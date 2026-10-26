// Actual Rapier six-car races; no recovery teleport, distance adjustment or timer replacement.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {runRace} from './race-sim.mjs';
import {difficultyById} from '../src/rebuild/raceDifficulty.js';
import {koreaData} from './korea-data.mjs';
const directory=new URL('../artifacts/korea-circuits-20261011/',import.meta.url);
const results=[];
for(const trackId of ['yeosu','seongsamjae']){
 const data=koreaData(trackId);
 for(const laps of [1,3])for(const difficultyId of ['easy','normal','hard']){
  let minUp=1,maxOff=0;
  const trace=(t,cars)=>{for(const c of cars){const q=c.state.rotation;minUp=Math.min(minUp,1-2*(q.x*q.x+q.z*q.z));assert.ok(c.state.position.y>data.route.points[c.index].y-3,`${trackId} ${difficultyId} ${laps} ${c.id} fell at ${t}`);assert.ok(1-2*(q.x*q.x+q.z*q.z)>.25,`${c.id} overturned at ${t}`);}};
  const result=await runRace({trackId,difficultyId,data,laps,playerProfile:difficultyById('hard').profile,maxSeconds:420*laps,trace});
  result.laps=laps;result.minimumUp=minUp;
  const times=result.cars.filter(c=>!c.player).map(c=>c.finish).sort((a,b)=>a-b);
  result.median=times[2];results.push(result);
  fs.writeFileSync(new URL(`matrix-${trackId}-${difficultyId}-${laps}.json`,directory),JSON.stringify(result,null,2));
  console.log(JSON.stringify({trackId,laps,difficultyId,median:result.median,cars:result.cars.map(c=>({id:c.id,time:c.finish,lowest:c.lowest,offroad:c.offroadSeconds})),minUp}));
  for(const car of result.cars){assert.ok(car.finish!==null,`${car.id} did not finish`);assert.ok(car.lowest>-.3,`${car.id} dropped below road`);}
 }
 for(const laps of [1,3]){
  const r=results.filter(r=>r.track===trackId&&r.laps===laps);
  assert.ok(r[0].median>r[1].median&&r[1].median>r[2].median,`${trackId} ${laps} difficulty is not monotonic`);
 }
}
fs.writeFileSync(new URL('matrix.json',directory),JSON.stringify({device:'Colab CPU / Rapier WASM',results},null,2));
