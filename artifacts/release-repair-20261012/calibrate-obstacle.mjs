import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {TRACKS} from '../../src/rebuild/tracks.js';
const root=new URL('../../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const matrix=JSON.parse(fs.readFileSync(new URL('obstacle-yeosu.json',import.meta.url)));
assert.equal(matrix.results.length,6,'all three difficulties at one and three laps are required');
const normalize=s=>s.replace(/^import .*;\r?\n/gm,'').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,'').replace(/\bblocker\b/g,'stopped').replace(/\s+/g,'');
assert.equal(normalize(read('src/rebuild/rivalPlanner.js').toString()),normalize(fs.readFileSync(new URL('planner-obstacle.mjs',import.meta.url),'utf8')),'the game planner must match the measured candidate behavior');
assert.equal(normalize(read('src/rebuild/course.js').toString()),normalize(fs.readFileSync(new URL('course-gap.mjs',import.meta.url),'utf8')),'the game following controller must match the measured candidate');
const medals={easy:'bronze',normal:'silver',hard:'gold'},targets={};
for(const laps of [1,3]){
 const rows=['easy','normal','hard'].map(d=>matrix.results.find(r=>r.laps===laps&&r.difficulty===d));
 for(const row of rows){
  assert.ok(row);assert.equal(row.trafficCount,6);assert.equal(row.cars.length,6);
  assert.ok(row.cars.every(c=>Number.isFinite(c.finish)&&c.finish>0&&c.lowest>0&&c.offroadSeconds===0));
  assert.ok(row.minimumUp>.98,'racers and traffic must remain upright');
  const times=row.cars.filter(c=>!c.player).map(c=>c.finish).sort((a,b)=>a-b);
  assert.equal(row.median,times[2]);
 }
 assert.ok(rows[0].median>rows[1].median&&rows[1].median>rows[2].median);
 targets[laps]=Object.fromEntries(rows.map(r=>[medals[r.difficulty],Math.floor(r.median)]));
}
const track=TRACKS.find(t=>t.id==='yeosu');
const paths=[`public/assets/rebuild/${track.route}`,'src/rebuild/rivalPlanner.js','src/driving/physics.js','src/rebuild/activeRide.js','src/driving/steering.js','src/rebuild/raceDifficulty.js','src/rebuild/vehicleDynamics.js','src/rebuild/roadTraffic.js','src/rebuild/course.js','src/rebuild/weather.js','scripts/race-sim.mjs',`${'artifacts/'+track.collisionFixture}/colliders.json`,`${'artifacts/'+track.collisionFixture}/colliders.bin`];
const report={execution:'Local Windows CPU / Rapier WASM. Isolated candidate with planner behavior verified against the game source; no changed time limit or recovery.',track:'yeosu',revision:track.revision,routeBytes:read(paths[0]).length,routeSha256:sha(read(paths[0])),routeDataSha256:sha(Buffer.from(JSON.stringify(JSON.parse(read(paths[0]))))),targets,inputs:paths.map(p=>({path:p,sha256:sha(read(p))})),candidateSourceSha256:sha(fs.readFileSync(new URL('planner-obstacle.mjs',import.meta.url))),matrixSha256:sha(fs.readFileSync(new URL('obstacle-yeosu.json',import.meta.url))),matrixCompletedAt:fs.statSync(new URL('obstacle-yeosu.json',import.meta.url)).mtime.toISOString(),results:matrix.results};
const out=new URL('yeosu-medal-calibration.json',import.meta.url);
if(fs.existsSync(out))throw Error('Do not overwrite calibration evidence');
fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify({targets,routeSha256:report.routeSha256},null,2));
