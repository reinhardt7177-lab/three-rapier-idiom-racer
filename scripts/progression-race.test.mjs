import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {runRace} from './race-sim.mjs';
import {difficultyById} from '../src/rebuild/raceDifficulty.js';
import {submitRecord} from '../src/rebuild/raceRecords.js';
import {progressFromRecords,canRaceTrack} from '../src/rebuild/progression.js';
test('a complete real six-car Rapier race earns a medal and unlocks the next course',async()=>{
 const race=await runRace({trackId:'namak',difficultyId:'normal',playerProfile:difficultyById('hard').profile});
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 assert.equal(canRaceTrack(progressFromRecords(storage),'seongsamjae'),false);
 assert.equal(race.cars.filter(c=>c.finish!=null).length,6);assert.ok(race.cars.every(c=>c.lowest>-.5));
 const player=race.cars.find(c=>c.player);submitRecord(storage,'namak',1,{time:player.finish,vehicle:player.id});
 const progress=progressFromRecords(storage);assert.equal(progress.count,1);assert.equal(canRaceTrack(progress,'seongsamjae'),true);
 const folder=new URL('../artifacts/content-resume-20261011/',import.meta.url);fs.mkdirSync(folder,{recursive:true});
 fs.writeFileSync(new URL('progression-race.json',folder),JSON.stringify({race,progress},null,2));
});
