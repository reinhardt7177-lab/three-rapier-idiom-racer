import test from 'node:test';
import assert from 'node:assert/strict';
import {progressFromRecords,newlyUnlocked,canSelectCar,canRaceTrack} from '../src/rebuild/progression.js';
import {submitRecord,medalTimes} from '../src/rebuild/raceRecords.js';
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};};
test('fresh garage has five cars and three courses; first genuine medal opens mountain and RX-7',()=>{
 const storage=memory(),before=progressFromRecords(storage);
 assert.equal(before.cars.filter(c=>c.unlocked).length,5);assert.equal(before.tracks.filter(t=>t.unlocked).length,3);
 assert.equal(canSelectCar(before,'rx7'),false);assert.equal(canRaceTrack(before,'seongsamjae'),false);
 submitRecord(storage,'namak',1,{time:medalTimes('namak',1).bronze,vehicle:'supra'});
 const after=progressFromRecords(storage);assert.equal(after.count,1);
 assert.deepEqual(newlyUnlocked(before,after).map(i=>i.id),['rx7','seongsamjae']);
 assert.equal(canRaceTrack(after,'seongsamjae'),true);
});
test('medal upgrades do not farm unlocks, lap formats count once and existing records migrate',()=>{
 const storage=memory();submitRecord(storage,'coastal',1,{time:210});submitRecord(storage,'coastal',1,{time:196});
 assert.equal(progressFromRecords(storage).count,1);
 submitRecord(storage,'coastal',3,{time:medalTimes('coastal',3).bronze});
 assert.equal(progressFromRecords(storage).count,2);assert.equal(canSelectCar(progressFromRecords(storage),'m3'),true);
 submitRecord(storage,'namak',1,{time:80});submitRecord(storage,'yeosu',1,{time:79});
 assert.equal(canSelectCar(progressFromRecords(storage),'huracan'),true);
 assert.equal(progressFromRecords({getItem:()=>'{broken'}).count,0);
 assert.equal(progressFromRecords({getItem:()=>{throw Error('blocked');}}).count,0);
});
