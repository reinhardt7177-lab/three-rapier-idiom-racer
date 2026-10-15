import test from 'node:test';
import assert from 'node:assert/strict';
import {loadingMetrics} from '../src/rebuild/loadingMetrics.js';
test('loading metrics distinguish cached bytes, transferred bytes and unavailable sizes',()=>{
 const m=loadingMetrics([
  {name:'http://localhost/world.glb',encodedBodySize:2500,transferSize:2800,duration:20},
  {name:'http://localhost/supra.glb',encodedBodySize:1000,transferSize:0,duration:1},
  {name:'https://other/decoder',encodedBodySize:0,transferSize:0,duration:4},
  {name:'http://localhost/route.json',encodedBodySize:500,transferSize:300,duration:2},
 ]);
 assert.equal(m.encodedBytes,4000);assert.equal(m.transferBytes,3100);assert.equal(m.cacheHits,2);assert.equal(m.revalidated,1);assert.equal(m.unknownSizes,1);
 assert.equal(m.files[0].name,'world.glb');assert.equal(m.files[0].durationMs,20);
});
