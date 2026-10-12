import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {TRACKS} from '../src/rebuild/tracks.js';
import {bestRecord,earnedRecord,submitRecord} from '../src/rebuild/raceRecords.js';
import {loadGhost,saveGhost} from '../src/rebuild/raceGhost.js';
import {progressFromRecords} from '../src/rebuild/progression.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url));
const source=JSON.parse(read('assets-sources/yeosu/map/selected-roads.json'));
const route=JSON.parse(read('public/assets/rebuild/yeosu-route.json'));
test('Yeosu uses verifiable OSM road coordinates and a single connected motor-road loop',()=>{
 assert.equal(source.sourceSha256,crypto.createHash('sha256').update(read('assets-sources/yeosu/map/yeosu-osm-20261012.osm')).digest('hex'));
 assert.equal(route.mapSource.sha256,source.sourceSha256);
 assert.equal(new Set(source.points.map(p=>p.nodeId)).size,source.points.length,'no repeated junction or out-and-back stub');
 for(const p of source.points){assert.ok(p.lat>34&&p.lat<35&&p.lon>127&&p.lon<128);assert.ok(source.ways.some(w=>w.id===p.wayId));}
 assert.ok(source.ways.some(w=>w.id===64707298));assert.ok(source.ways.some(w=>w.tags.name==='거북선대교'));
 assert.ok(source.ways.every(w=>w.tags.motorcar!=='no'&&w.tags.motor_vehicle!=='no'));
 assert.equal(source.license,'ODbL-1.0');assert.ok(route.mapSource.copyright.includes('OpenStreetMap'));
 assert.ok(route.mapSource.maximumPlanarDeviation<7,'race corner rounding stays close to source roads');
 assert.ok(Math.abs(route.length-source.originalLength)/source.originalLength<.02,'road lengths are preserved');
 assert.equal(TRACKS.find(t=>t.id==='yeosu').revision,route.revision);
});
test('new geographic course isolates times and ghosts while preserving legacy earned medals',()=>{
 const data=new Map([['mumu.circuit.records.v1',JSON.stringify({'yeosu:1':{time:80,vehicle:'supra',medal:'silver'}})],['mumu.circuit.ghost.v1.yeosu.1',JSON.stringify({version:1,vehicle:'supra',interval:.1,data:[0,0,0,0,0,0,1]})]]);
 const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 assert.equal(bestRecord(storage,'yeosu',1),null);assert.equal(loadGhost(storage,'yeosu',1),null);
 assert.equal(earnedRecord(storage,'yeosu',1).medal,'silver');assert.equal(progressFromRecords(storage).count,1);
 submitRecord(storage,'yeosu',1,{time:300,vehicle:'supra'});assert.equal(bestRecord(storage,'yeosu',1).time,300);
 saveGhost(storage,'yeosu',1,{version:1,vehicle:'supra',data:[0,0,0,0,0,0,1],interval:.1});assert.ok(loadGhost(storage,'yeosu',1));
 assert.equal(JSON.parse(data.get('mumu.circuit.records.v1'))['yeosu:1'].time,80);
 assert.ok(data.has('mumu.circuit.ghost.v1.yeosu.1'));
});
