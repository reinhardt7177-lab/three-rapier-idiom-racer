import test from 'node:test';import assert from 'node:assert/strict';
import {courseProgress,createDuelReadout} from '../src/driving/duelReadout.js';
import {COAST_ROADS,offsetPoint} from '../src/driving/coastRoute.js';
import {SPRINT_GATES} from '../src/driving/sprint.js';
const road=COAST_ROADS.harbor,at=s=>road.reduce((a,b)=>Math.abs(a.s-s)<Math.abs(b.s-s)?a:b);
const race=(elapsed=3,gate=0)=>({elapsed,gate,valid:true,phase:'running'});
test('course distance follows curves, matches both lanes and clamps skipped gates',()=>{
 const p=at(500);assert.ok(Math.abs(courseProgress(offsetPoint(p,3.5),1)-p.s)<1);
 assert.ok(Math.abs(courseProgress(offsetPoint(p,-3.5),1)-p.s)<1);
 assert.equal(courseProgress(at(700),0),SPRINT_GATES[0].s);
 assert.ok(courseProgress(at(480),1)<courseProgress(at(510),1));
});
test('overtake announcement has hysteresis, expires on race time and resets',()=>{
 const b=createDuelReadout();b.update(race(),race(),at(120),at(150));
 const a=b.update(race(4),race(4),at(160),at(150));assert.equal(a.place,1);assert.match(a.notice,/추월 성공/);
 assert.equal(b.update(race(4),race(4),at(160),at(150)).notice,a.notice);
 assert.equal(b.update(race(6),race(6),at(160),at(150)).notice,'');
 assert.equal(b.update({...race(0),phase:'countdown'},race(),at(120),at(150)).place,null);
 assert.equal(b.update(race(1),race(1),at(120),at(150)).notice,'');
});
test('side by side never flips repeatedly and invalid runs have no rank',()=>{
 const b=createDuelReadout(),p=at(120);assert.equal(b.update(race(),race(),p,p).place,null);
 b.update(race(),race(),at(160),p);assert.equal(b.update(race(),race(),p,p).place,1);
 assert.equal(b.update({...race(),valid:false},race(),at(160),p).place,null);
});
test('finish order depends on crossing time, not braking position',()=>{
 const b=createDuelReadout();assert.equal(b.update(race(35,3),race(34,3),at(950),at(880)).place,2);
 assert.equal(b.update(race(34,3),race(34,3),at(950),at(880)).place,null);
});
