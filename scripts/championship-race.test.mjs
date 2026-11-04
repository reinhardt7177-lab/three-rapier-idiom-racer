import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runRace} from './race-sim.mjs';
import {difficultyById} from '../src/rebuild/raceDifficulty.js';
import {newChampionship,commitRound,seriesTable,SERIES_DRIVERS,SERIES_TRACKS} from '../src/rebuild/championship.js';
test('six physical cars finish all three championship rounds and earn only finish-based points',async()=>{
 let series=newChampionship({vehicle:'supra',id:'physical-series'});const races=[];
 for(const trackId of SERIES_TRACKS){
  let actualFinishes=[];
  const result=await runRace({trackId,difficultyId:'normal',playerProfile:difficultyById('hard').profile,maxSeconds:420,trace:(t,cars)=>{actualFinishes=cars.map((c,i)=>({name:SERIES_DRIVERS[i],time:c.finish,finished:c.finish!==null}));}});
  for(const car of result.cars){assert.ok(car.finish!==null,`${trackId}: ${car.id} did not finish`);assert.ok(car.lowest>-.3,`${trackId}: ${car.id} fell`);}
  series=commitRound(series,trackId,actualFinishes);races.push(result);
 }
 const table=seriesTable(series);assert.equal(table.reduce((s,r)=>s+r.points,0),78);assert.equal(series.rounds.length,3);
 fs.writeFileSync(new URL('../artifacts/championship-20261011/physical-series.json',import.meta.url),JSON.stringify({device:'CPU / Rapier WASM',series,table,races},null,2));
});
