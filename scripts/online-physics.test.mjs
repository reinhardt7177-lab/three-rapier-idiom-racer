import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runRace} from './race-sim.mjs';
import {difficultyById} from '../src/rebuild/raceDifficulty.js';
const results=[],target=new URL('../artifacts/race-duel-20261012/online-headless.json',import.meta.url);
const cases=['coastal','namak','yeosu','seongsamjae'].map(trackId=>({trackId,laps:1,weather:'clear'}));
cases.push({trackId:'namak',laps:3,weather:'rain'});
for(const config of cases)test(`online host physics ${config.trackId}/${config.laps}lap/${config.weather}: both human-tuned bodies finish without a fall`,{timeout:300000},async()=>{
 let upright=1;const started=performance.now();
 const race=await runRace({...config,raceMode:'online',player:'supra',guestVehicle:'gtr',trafficCount:6,playerProfile:difficultyById('hard').profile,maxSeconds:420*config.laps,trace:(_time,cars)=>{for(const c of cars){const q=c.state.rotation;upright=Math.min(upright,1-2*(q.x*q.x+q.z*q.z));}}});
 const evidence={...config,execution:'Local Windows CPU / Rapier WASM',note:'Two headless stand-in human pedal drivers; no WebRTC in this test. Both use player grip/steering/nitro settings.',wallSeconds:+((performance.now()-started)/1000).toFixed(2),minUpright:upright,race};results.push(evidence);fs.writeFileSync(target,JSON.stringify(results,null,2)+'\n');
 assert.equal(race.cars.length,2);assert.equal(race.traffic.count,0);
 for(const car of race.cars){assert.ok(car.finish!==null,`${car.name} unfinished at ${car.metres}m`);assert.ok(car.lowest>0,`${car.name} below road ${car.lowest}m`);}
 assert.ok(upright>.25,`inverted ${upright}`);
 console.log(JSON.stringify({config,finish:race.cars.map(c=>({name:c.name,time:c.finish,lowest:c.lowest})),upright,wallSeconds:evidence.wallSeconds}));
});
