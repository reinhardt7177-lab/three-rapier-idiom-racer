import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {medalTimes,medalFor} from '../src/rebuild/raceRecords.js';
const matrix=JSON.parse(fs.readFileSync(new URL('../artifacts/korea-circuits-20261011/matrix.json',import.meta.url)));
for(const track of ['yeosu','seongsamjae'])for(const laps of [1,3]){
 test(`${track} ${laps} laps: medal targets are backed by complete six-car races`,()=>{
  const rows=matrix.results.filter(r=>r.track===track&&r.laps===laps);
  assert.equal(rows.length,3);
  for(const row of rows){assert.equal(row.cars.length,6);assert.ok(row.cars.every(c=>Number.isFinite(c.finish)&&c.lowest>0));assert.ok(row.minimumUp>.98);}
  const times=medalTimes(track,laps),medals={easy:'bronze',normal:'silver',hard:'gold'};
  for(const row of rows){assert.equal(times[medals[row.difficulty]],Math.floor(row.median));}
  assert.ok(rows[0].median>rows[1].median&&rows[1].median>rows[2].median);
  assert.ok(times.gold<times.silver&&times.silver<times.bronze);
  assert.equal(medalFor(times.gold,times),'gold');assert.equal(medalFor(times.bronze+.01,times),null);
 });
}
