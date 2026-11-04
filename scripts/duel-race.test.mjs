import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runRace} from './race-sim.mjs';
import {difficultyById} from '../src/rebuild/raceDifficulty.js';

const results=[],target=new URL('../artifacts/race-duel-20261012/duel-races.json',import.meta.url);
fs.mkdirSync(new URL('../artifacts/race-duel-20261012/',import.meta.url),{recursive:true});
const cases=['coastal','namak','yeosu','seongsamjae'].flatMap(trackId=>['easy','normal','hard'].map(difficultyId=>({trackId,difficultyId,opponent:'NOVA',laps:1,weather:'clear'})));
cases.push(...['RAVEN','BLAZE','MIST','LUNA'].map(opponent=>({trackId:'namak',difficultyId:'normal',opponent,laps:1,weather:'clear'})),{trackId:'namak',difficultyId:'normal',opponent:'RAVEN',laps:3,weather:'clear'},{trackId:'seongsamjae',difficultyId:'normal',opponent:'NOVA',laps:1,weather:'rain'});
for(const config of cases)test(`1:1 ${config.trackId}/${config.difficultyId}/${config.opponent}/${config.laps}lap/${config.weather}: two real finishes without falls`,{timeout:300000},async()=>{
 const started=performance.now();let minUpright=1;
 const race=await runRace({...config,raceMode:'duel',trafficCount:config.trackId==='yeosu'?6:0,playerProfile:difficultyById('hard').profile,maxSeconds:420*config.laps,trace:(_time,cars)=>{for(const c of cars){const q=c.state.rotation;minUpright=Math.min(minUpright,1-2*(q.x*q.x+q.z*q.z));}}});
 const report={...config,execution:'Local Windows CPU / Rapier WASM',wallSeconds:+((performance.now()-started)/1000).toFixed(2),minUpright:+minUpright.toFixed(4),race};results.push(report);fs.writeFileSync(target,JSON.stringify(results,null,2)+'\n');
 assert.equal(race.cars.length,2);assert.equal(race.traffic.count,0);assert.equal(race.cars[1].name,config.opponent);
 for(const c of race.cars){assert.ok(c.finish!==null,`${c.name} did not finish: ${c.metres}m`);assert.ok(c.lowest>0,`${c.name} chassis below road: ${c.lowest}m`);}
 assert.ok(minUpright>.25,`inverted: ${minUpright}`);assert.deepEqual(race.cars.map(c=>c.place).sort(),[1,2]);
 console.log(JSON.stringify({config,finish:race.cars.map(c=>({name:c.name,time:c.finish,lowest:c.lowest})),minUpright,wallSeconds:report.wallSeconds}));
});
test('the same duel opponent becomes faster at each difficulty on all four courses',()=>{
 for(const trackId of ['coastal','namak','yeosu','seongsamjae']){
  const times=['easy','normal','hard'].map(difficultyId=>results.find(r=>r.trackId===trackId&&r.difficultyId===difficultyId&&r.laps===1&&r.weather==='clear').race.cars[1].finish);
  assert.ok(times[2]<times[1]&&times[1]<times[0],`${trackId}: ${times}`);
 }
});
