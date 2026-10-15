import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {runRace} from './sim-obstacle.mjs';
import {difficultyById} from '../../src/rebuild/raceDifficulty.js';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sourcePaths=['planner-obstacle.mjs','course-gap.mjs','sim-obstacle.mjs'];
const inputs=sourcePaths.map(p=>({path:p,sha256:sha(fs.readFileSync(new URL(p,import.meta.url)))}));
const pair=JSON.parse(fs.readFileSync(new URL('obstacle-pair.json',import.meta.url)));
assert.equal(pair.results.length,2);assert.ok(pair.results[0].median>pair.results[1].median);
const configs=[{difficultyId:'hard',laps:1},...['easy','normal','hard'].map(difficultyId=>({difficultyId,laps:3}))];
const results=[],start=performance.now();
for(const config of configs){
 let minimumUp=1;
 const race=await runRace({trackId:'yeosu',...config,weather:'clear',trafficCount:6,maxSeconds:420*config.laps,personalities:true,playerProfile:difficultyById('hard').profile,
  trace(time,cars,planner,traffic){for(const c of [...cars,...traffic.cars]){const q=c.state.rotation;minimumUp=Math.min(minimumUp,1-2*(q.x*q.x+q.z*q.z));}}});
 const times=race.cars.filter(c=>!c.player).map(c=>c.finish).sort((a,b)=>a-b);
 const row={...race,...config,trackId:'yeosu',trafficCount:6,minimumUp,median:times[2]};results.push(row);
 fs.writeFileSync(new URL('obstacle-remaining.json',import.meta.url),JSON.stringify({execution:'Local Windows CPU / Rapier WASM, original 420 seconds per lap and no recovery',inputs,wallSeconds:(performance.now()-start)/1000,results},null,2));
 console.log(JSON.stringify({config,minimumUp,median:row.median,cars:race.cars.map(c=>({id:c.id,finish:c.finish,lowest:c.lowest,offroadSeconds:c.offroadSeconds}))}));
 assert.ok(row.cars.every(c=>Number.isFinite(c.finish)&&c.finish>0&&c.lowest>0&&c.offroadSeconds===0));assert.ok(minimumUp>.98);
}
for(const i of inputs)assert.equal(sha(fs.readFileSync(new URL(i.path,import.meta.url))),i.sha256);
const combined=[...pair.results,...results].sort((a,b)=>a.laps-b.laps||['easy','normal','hard'].indexOf(a.difficulty)-['easy','normal','hard'].indexOf(b.difficulty));
fs.writeFileSync(new URL('obstacle-yeosu.json',import.meta.url),JSON.stringify({execution:'Local Windows CPU / Rapier WASM; two unchanged candidate runs combined, no excluded rows',inputs,phases:{pairWallSeconds:pair.wallSeconds,remainingWallSeconds:(performance.now()-start)/1000},results:combined},null,2));
for(const laps of [1,3]){
 const r=combined.filter(r=>r.laps===laps);assert.equal(r.length,3);assert.ok(r[0].median>r[1].median&&r[1].median>r[2].median,`${laps} laps: difficulty order ${r.map(r=>r.median)}`);
}
console.log('All six civilian-traffic races passed completion, road support, upright and difficulty gates.');
