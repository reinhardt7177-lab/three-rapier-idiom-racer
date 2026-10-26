import test from 'node:test';
import assert from 'node:assert/strict';
import {LAP_OPTIONS,DEFAULT_LAPS,medalTimes,medalFor,bestRecord,earnedRecord,recordKey,submitRecord,loadLaps,saveLaps,lapInfo} from '../src/rebuild/raceRecords.js';
import {createGhostRecorder,ghostPose,loadGhost,saveGhost} from '../src/rebuild/raceGhost.js';
import {routeGuidance} from '../src/rebuild/routeGuidance.js';
import {TRACKS} from '../src/rebuild/tracks.js';

const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),size:()=>m.size};};
const blocked={getItem(){throw new Error('denied');},setItem(){throw new Error('denied');}};

test('every track has ordered medal targets for every lap option',()=>{
 for(const t of TRACKS)for(const laps of LAP_OPTIONS){
  const m=medalTimes(t.id,laps);
  assert.ok(m.gold<m.silver&&m.silver<m.bronze,`${t.id} ${laps}`);
  if(laps>1)assert.ok(m.gold<medalTimes(t.id,1).gold*laps,'later laps start rolling');
 }
 const m=medalTimes('namak',1);
 assert.equal(medalFor(m.gold,m),'gold');assert.equal(medalFor(m.gold+.01,m),'silver');
 assert.equal(medalFor(m.bronze,m),'bronze');assert.equal(medalFor(m.bronze+.01,m),null);
 assert.equal(medalFor(NaN,m),null);assert.equal(medalTimes('unknown',1),null);
});

test('a personal best only improves, per track and lap count',()=>{
 const s=memory();
 assert.equal(bestRecord(s,'namak',1),null);
 let r=submitRecord(s,'namak',1,{time:88,vehicle:'supra'});
 assert.ok(r.improved);assert.equal(r.previous,null);assert.equal(r.best.medal,'bronze');
 r=submitRecord(s,'namak',1,{time:91,vehicle:'gtr'});
 assert.ok(!r.improved);assert.equal(bestRecord(s,'namak',1).time,88);assert.equal(bestRecord(s,'namak',1).vehicle,'supra');
 r=submitRecord(s,'namak',1,{time:79.5,vehicle:'gtr'});
 assert.ok(r.improved);assert.equal(r.previous.time,88);assert.equal(r.best.medal,'gold');
 assert.equal(bestRecord(s,'namak',3),null);assert.equal(bestRecord(s,'coastal',1),null);
});

test('corrupt or blocked storage never breaks the result screen',()=>{
 const s=memory();s.setItem('mumu.circuit.records.v1','{not json');
 assert.equal(bestRecord(s,'namak',1),null);
 assert.ok(submitRecord(s,'namak',1,{time:90}).improved);
 assert.equal(bestRecord(blocked,'namak',1),null);
 assert.doesNotThrow(()=>submitRecord(blocked,'namak',1,{time:90}));
 assert.equal(loadLaps(blocked),DEFAULT_LAPS);assert.doesNotThrow(()=>saveLaps(blocked,3));
 const l=memory();saveLaps(l,3);assert.equal(loadLaps(l),3);saveLaps(l,7);assert.equal(loadLaps(l),3,'invalid lap counts are ignored');
});

test('new-course saved badges are recalculated without deleting times or legacy medals',()=>{
 const s=memory(),key=recordKey('yeosu',1),time=medalTimes('yeosu',1).silver-.25;
 const raw=JSON.stringify({[key]:{time,vehicle:'gtr',medal:null,savedAt:'preserved'},'yeosu:1':{time:80,vehicle:'supra',medal:'silver'}});
 s.setItem('mumu.circuit.records.v1',raw);
 const best=bestRecord(s,'yeosu',1);assert.equal(best.time,time);assert.equal(best.vehicle,'gtr');assert.equal(best.savedAt,'preserved');assert.equal(best.medal,'silver');
 assert.equal(earnedRecord(s,'yeosu',1).time,time);
 const slower=submitRecord(s,'yeosu',1,{time:time+30,vehicle:'supra'});
 assert.equal(slower.improved,false);assert.equal(slower.previous.medal,'silver');assert.equal(slower.best.medal,'silver');
 assert.equal(s.getItem('mumu.circuit.records.v1'),raw,'reading or losing cannot overwrite saved data');
 const legacyOnly={getItem:()=>JSON.stringify({'yeosu:1':{time:80,medal:'silver'}})};
 assert.equal(bestRecord(legacyOnly,'yeosu',1),null);assert.equal(earnedRecord(legacyOnly,'yeosu',1).medal,'silver');
});

test('lap number and in-lap distance follow race progress, including the grid offset',()=>{
 assert.deepEqual(lapInfo(-19,1000,3),{lap:1,laps:3,inLap:0});
 assert.deepEqual(lapInfo(999,1000,3),{lap:1,laps:3,inLap:999});
 assert.deepEqual(lapInfo(1000,1000,3),{lap:2,laps:3,inLap:0});
 assert.deepEqual(lapInfo(3500,1000,3),{lap:3,laps:3,inLap:1500},'capped at the final lap');
});

test('route guidance only announces the finish on the final lap',()=>{
 const points=Array.from({length:200},(_,i)=>({x:0,y:0,z:i*5,dx:0,dz:1,distance:i*5}));
 const route={points,length:1000};
 assert.equal(routeGuidance(route,195,980).direction,'finish');
 assert.notEqual(routeGuidance(route,195,980,3000).direction,'finish','lap 1 of 3 near the line');
 assert.equal(routeGuidance(route,195,2980,3000).direction,'finish');
 assert.equal(routeGuidance(route,195,980,3000).remaining,2020);
});

test('a ghost replays the recorded run at the same race time',()=>{
 const rec=createGhostRecorder('gtr'),STEP=1/120;
 for(let i=1;i<=1200;i++){const t=i*STEP,yaw=t*.2;rec.record(t,{position:{x:t*10,y:1,z:-t*5},rotation:{x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)}});}
 const ghost=rec.finish(10);
 assert.equal(ghost.vehicle,'gtr');assert.equal(ghost.data.length%7,0);
 assert.ok(ghost.data.length/7>=99&&ghost.data.length/7<=101,`${ghost.data.length/7} samples for 10 s`);
 const p=ghostPose(ghost,5.05);
 assert.ok(Math.abs(p.position.x-50.5)<.2&&Math.abs(p.position.z+25.25)<.1,JSON.stringify(p.position));
 assert.ok(Math.abs(Math.hypot(p.rotation.x,p.rotation.y,p.rotation.z,p.rotation.w)-1)<1e-9);
 assert.equal(ghostPose(ghost,-1),null);assert.equal(ghostPose(ghost,20),null);assert.equal(ghostPose(null,1),null);
 // Opposite-sign quaternions describe the same rotation and must not spin the ghost.
 const flip={...ghost,data:[0,0,0,0,0,0,1, 0,0,0,0,0,0,-1, 0,0,0,0,0,0,1]};
 assert.ok(Math.abs(Math.abs(ghostPose(flip,.05).rotation.w)-1)<1e-9);
});

test('ghosts persist per track and lap count, and full storage only drops the ghost',()=>{
 const s=memory(),rec=createGhostRecorder('supra');rec.record(0,{position:{x:1,y:2,z:3},rotation:{x:0,y:0,z:0,w:1}});rec.record(.1,{position:{x:2,y:2,z:3},rotation:{x:0,y:0,z:0,w:1}});
 assert.ok(saveGhost(s,'namak',3,rec.finish(.1)));
 assert.equal(loadGhost(s,'namak',3).vehicle,'supra');assert.equal(loadGhost(s,'namak',1),null);
 s.setItem('mumu.circuit.ghost.v1.namak.1','{"version":1,"vehicle":"x","data":[1,2]}');
 assert.equal(loadGhost(s,'namak',1),null,'malformed data is ignored');
 assert.equal(saveGhost(blocked,'namak',1,rec.finish(.1)),false);assert.equal(loadGhost(blocked,'namak',1),null);
});
