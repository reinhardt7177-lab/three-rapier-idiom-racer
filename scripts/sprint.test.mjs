import test from 'node:test';
import assert from 'node:assert/strict';
import { newSprint,startSprint,advanceCountdown,updateSprint,invalidateSprint,recordSprint,loadSprint,SPRINT_KEY,SPRINT_GATES,formatTime } from '../src/driving/sprint.js';

const state=(p,kmh=60,contacts=4)=>({position:{y:.6,...p},kmh,contacts});
function cross(s,index,direction=1,lateral=0,contacts=4) {
  const p=SPRINT_GATES[index];
  const point=d=>({x:p.x+p.tx*d-p.tz*lateral,z:p.z+p.tz*d+p.tx*lateral});
  return updateSprint(s,state(point(-direction)),state(point(direction),60,contacts),1/120);
}
function complete(){let s={...newSprint(),phase:'running',elapsed:10};for(let i=0;i<3;i++){s=cross(s,i);if(i<2)s={...s,elapsed:s.elapsed+10};}return updateSprint(s,state(SPRINT_GATES[2]),state(SPRINT_GATES[2],0),1/120);}
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),map};};

test('countdown gates input phase and cannot advance before 3 seconds',()=>{
  let s=startSprint(newSprint());for(let i=0;i<29;i++)s=advanceCountdown(s,.1);assert.equal(s.phase,'countdown');assert.equal(s.elapsed,0);s=advanceCountdown(s,.1);assert.equal(s.phase,'running');
});
test('ordered grounded forward crossings record splits; result waits for a stop',()=>{
  let s={...newSprint(),phase:'running'};
  assert.equal(cross(s,1).gate,0);assert.equal(cross(s,0,-1).gate,0);assert.equal(cross(s,0,1,0,0).gate,0);assert.equal(cross(s,0,1,30).gate,0);
  for(let i=0;i<3;i++){s={...s,elapsed:s.elapsed+10};s=cross(s,i);assert.equal(s.gate,i+1);}
  assert.equal(s.phase,'cooldown');const time=s.elapsed;
  s=updateSprint(s,state(SPRINT_GATES[2]),state(SPRINT_GATES[2],80),1/120);assert.equal(s.phase,'cooldown');assert.equal(s.elapsed,time);
  s=updateSprint(s,state(SPRINT_GATES[2]),state(SPRINT_GATES[2],0),1/120);assert.equal(s.phase,'complete');assert.equal(s.elapsed,time);
});
test('teleports, off-road cuts and recovery cannot become a valid best',()=>{
  let s={...newSprint(),phase:'running'};s=updateSprint(s,state({x:0,z:-720}),state({x:0,z:-430}),1/120);assert.equal(s.valid,false);assert.equal(s.gate,0);
  assert.equal(cross({...newSprint(),phase:'running'},0,1,30).valid,false);
  const invalid={...invalidateSprint({...newSprint(),phase:'running'}),phase:'complete',splits:[10,20,30],elapsed:30};const storage=memory();recordSprint(invalid,storage);assert.equal(storage.map.size,0);
});
test('only faster valid runs save, blocked storage is safe, unrelated keys survive',()=>{
  const storage=memory();storage.setItem('story','keep');let s=recordSprint(complete(),storage);assert.equal(s.saved,true);assert.equal(s.personalBest,true);assert.equal(storage.getItem('story'),'keep');assert.deepEqual(loadSprint(storage),s.best);
  s=recordSprint({...complete(),elapsed:50,splits:[10,20,50]},storage);assert.equal(s.personalBest,false);assert.ok(loadSprint(storage).time<50);
  const blocked=recordSprint(complete(),{setItem(){throw Error('denied');}});assert.equal(blocked.saved,false);assert.ok(blocked.best);
  storage.setItem(SPRINT_KEY,JSON.stringify({version:1,route:'harbor-s860-v1',time:30,splits:[10,40,30]}));assert.equal(loadSprint(storage),null);
});
test('slower retries preserve save warnings and persist the unsaved in-memory best when storage recovers',()=>{
  const blocked={getItem:()=>null,setItem(){throw Error('blocked');}};
  const first=recordSprint({...complete(),elapsed:40,splits:[10,25,40]},blocked);
  assert.equal(first.saved,false);
  const retry=newSprint(first.best,first.saved);
  assert.equal(retry.saved,false,'reset must retain the best-record persistence status');
  const slower={...retry,phase:'complete',gate:3,elapsed:43,splits:[11,26,43]};
  const stillBlocked=recordSprint(slower,blocked);
  assert.equal(stillBlocked.saved,false);
  assert.equal(stillBlocked.personalBest,false);
  assert.deepEqual(stillBlocked.best,first.best);
  const storage=memory(),recovered=recordSprint(slower,storage);
  assert.equal(recovered.saved,true);
  assert.equal(recovered.personalBest,false);
  assert.deepEqual(loadSprint(storage),first.best,'save the earlier best, not the slower retry');
  assert.equal(newSprint(recovered.best,recovered.saved).saved,true);
  assert.equal(newSprint(null,false).saved,null);
  assert.equal(newSprint(first.best).saved,null,'existing callers remain supported');
});
test('a better stored sprint survives stale memory and duplicate completion without rewrites',()=>{
  const storage=memory(),stored=recordSprint({...complete(),elapsed:32,splits:[10,20,32]},storage);
  let writes=0;
  storage.setItem=()=>{writes++;throw Error('a persisted better record must not be rewritten');};
  const retry=recordSprint({...complete(),elapsed:35,splits:[10,22,35],best:{time:40,splits:[10,25,40]}},storage);
  assert.equal(retry.saved,true);
  assert.equal(retry.personalBest,false);
  assert.deepEqual(retry.best,stored.best);
  assert.equal(recordSprint(retry,storage).saved,true);
  assert.equal(writes,0);
});
test('sprint storage preserves other versions, other routes and records that cannot be read',()=>{
  for(const changed of [{version:2},{version:0},{route:'future-route'}]) {
    const storage=memory(),raw=JSON.stringify({version:1,route:'harbor-s860-v1',time:30,splits:[10,20,30],...changed,progress:['keep']});
    storage.setItem(SPRINT_KEY,raw);
    const result=recordSprint(complete(),storage);
    assert.equal(loadSprint(storage),null);
    assert.equal(result.saved,false);
    assert.ok(result.best);
    assert.equal(storage.getItem(SPRINT_KEY),raw);
  }
  let writes=0;
  const unreadable={getItem(){throw Error('read denied');},setItem(){writes++;}};
  assert.equal(recordSprint(complete(),unreadable).saved,false);
  assert.equal(writes,0,'an unknown existing record must never be overwritten');
});
test('sprint save success requires a readable matching record, not only a successful write',()=>{
  const silent={getItem:()=>null,setItem(){}};
  assert.equal(recordSprint(complete(),silent).saved,false);
  let reads=0;
  const unreadableAfterWrite={getItem(){if(reads++)throw Error('read-back denied');return null;},setItem(){}};
  assert.equal(recordSprint(complete(),unreadableAfterWrite).saved,false);
  const changedAfterWrite={getItem(){return this.raw??null;},setItem(){this.raw=JSON.stringify({version:1,route:'harbor-s860-v1',time:40,splits:[10,25,40]});}};
  assert.equal(recordSprint(complete(),changedAfterWrite).saved,false);
});
test('time formatting is stable across minute boundaries and missing records',()=>{assert.equal(formatTime(null),'—');assert.equal(formatTime(61.234),'1:01.23');assert.equal(formatTime(0),'0:00.00');});
