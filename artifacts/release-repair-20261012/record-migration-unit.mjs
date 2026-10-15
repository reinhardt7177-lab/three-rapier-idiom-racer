import test from 'node:test';
import assert from 'node:assert/strict';
import {bestRecord,earnedRecord,submitRecord,recordKey,medalTimes} from './records-candidate.mjs';
test('new-course saved badges are recalculated without deleting times, legacy medals or slower-run data',()=>{
 const key=recordKey('yeosu',1),time=medalTimes('yeosu',1).silver-.25;
 const raw=JSON.stringify({[key]:{time,vehicle:'gtr',medal:null,savedAt:'preserved'},'yeosu:1':{time:80,vehicle:'supra',medal:'silver'}});
 const data=new Map([['mumu.circuit.records.v1',raw]]),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 const best=bestRecord(storage,'yeosu',1);
 assert.equal(best.time,time);assert.equal(best.vehicle,'gtr');assert.equal(best.savedAt,'preserved');assert.equal(best.medal,'silver');
 assert.equal(earnedRecord(storage,'yeosu',1).time,time);
 const slower=submitRecord(storage,'yeosu',1,{time:time+30,vehicle:'supra'});
 assert.equal(slower.improved,false);assert.equal(slower.previous.medal,'silver');assert.equal(slower.best.medal,'silver');
 assert.equal(data.get('mumu.circuit.records.v1'),raw,'reading or losing a race cannot overwrite saved data');
 const legacyOnly={getItem:()=>JSON.stringify({'yeosu:1':{time:80,medal:'silver'}})};
 assert.equal(bestRecord(legacyOnly,'yeosu',1),null);assert.equal(earnedRecord(legacyOnly,'yeosu',1).medal,'silver');
});
