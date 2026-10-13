import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {medalTimes,medalFor} from '../src/rebuild/raceRecords.js';
import {TRACKS} from '../src/rebuild/tracks.js';
const original=JSON.parse(fs.readFileSync(new URL('../artifacts/korea-circuits-20261011/matrix.json',import.meta.url)));
const yeosu=JSON.parse(fs.readFileSync(new URL('../artifacts/release-repair-20261012/yeosu-medal-calibration.json',import.meta.url)));
test('Yeosu medal evidence belongs to the current geographic route, independent of checkout line endings',()=>{
 const track=TRACKS.find(t=>t.id==='yeosu');
 const route=JSON.parse(fs.readFileSync(new URL('../public/assets/rebuild/'+track.route,import.meta.url)));
 assert.equal(yeosu.revision,track.revision);assert.equal(route.revision,track.revision);
 assert.equal(yeosu.routeDataSha256,crypto.createHash('sha256').update(JSON.stringify(route)).digest('hex'));
 assert.equal(yeosu.results.length,6);
});
for(const track of ['yeosu','seongsamjae'])for(const laps of [1,3]){
 test(`${track} ${laps} laps: medal targets are backed by complete six-car races`,()=>{
  const matrix=track==='yeosu'?yeosu:original;
  const rows=matrix.results.filter(r=>r.track===track&&r.laps===laps);
  assert.equal(rows.length,3);
  for(const row of rows){assert.equal(row.cars.length,6);assert.ok(row.cars.every(c=>Number.isFinite(c.finish)&&c.lowest>0));assert.ok(row.minimumUp>.98);}
  if(track==='yeosu')for(const row of rows){assert.equal(row.trafficCount,6);assert.ok(row.cars.every(c=>c.offroadSeconds===0));}
  const times=medalTimes(track,laps),medals={easy:'bronze',normal:'silver',hard:'gold'};
  for(const row of rows){assert.equal(times[medals[row.difficulty]],Math.floor(row.median));}
  assert.ok(rows[0].median>rows[1].median&&rows[1].median>rows[2].median);
  assert.ok(times.gold<times.silver&&times.silver<times.bronze);
  assert.equal(medalFor(times.gold,times),'gold');assert.equal(medalFor(times.bronze+.01,times),null);
 });
}
