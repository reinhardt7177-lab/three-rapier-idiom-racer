import test from 'node:test';
import assert from 'node:assert/strict';
import {VEHICLES,rivalFleet} from '../src/rebuild/fleet.js';
import {RIVAL_PERSONALITIES} from '../src/rebuild/rivalPersonalities.js';
import {difficultyById,difficultyPace,gridSlot} from '../src/rebuild/raceDifficulty.js';
import {raceRoster,loadRaceSetup,saveRaceSetup,normalizeRaceSetup,duelOutcome,duelStatus} from '../src/rebuild/raceMode.js';
import {duelRecord,duelRecordKey,submitDuelRecord} from '../src/rebuild/duelRecords.js';
import {bestRecord,submitRecord} from '../src/rebuild/raceRecords.js';
import {progressFromRecords} from '../src/rebuild/progression.js';
import {loadGhost,saveGhost} from '../src/rebuild/raceGhost.js';
import {commitRound,newChampionship} from '../src/rebuild/championship.js';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v))};};
const setup={trackId:'namak',laps:1,player:'supra',opponent:'NOVA',difficulty:'normal',weather:'clear'};
const entry=(time=82,outcome='win')=>({time,outcome,vehicle:'supra'});

test('the default six-car mode retains every original vehicle, grid slot and rival pace index',()=>{
 for(const car of VEHICLES){const roster=raceRoster(car.id);assert.equal(roster.length,6);
  assert.deepEqual(roster.map(c=>c.id),[car.id,...rivalFleet(car.id)]);
  assert.deepEqual(roster.map(c=>c.name),['YOU',...RIVAL_PERSONALITIES.map(p=>p.name)]);
  assert.deepEqual(roster.map(c=>c.slot),Array.from({length:6},(_,i)=>gridSlot(i)));
  assert.deepEqual(roster.slice(1).map(c=>c.rivalIndex),[0,1,2,3,4]);
 }
});
test('all eight player cars can duel each of the five actual rivals on two distinct front-row slots',()=>{
 for(const player of VEHICLES)for(const [index,rival] of RIVAL_PERSONALITIES.entries()){
  const roster=raceRoster(player.id,{mode:'duel',opponent:rival.name});
  assert.equal(roster.length,2);assert.equal(roster.filter(c=>c.player).length,1);
  assert.deepEqual(roster.map(c=>c.slot),[1,0]);assert.equal(roster[1].name,rival.name);
  assert.equal(roster[1].id,rivalFleet(player.id)[index]);assert.notEqual(roster[0].id,roster[1].id);
  for(const difficulty of ['easy','normal','hard'])assert.equal(difficultyPace(difficultyById(difficulty),roster[1].rivalIndex),difficultyPace(difficultyById(difficulty),index));
 }
});
test('mode and opponent persist, while malformed or blocked storage falls back safely',()=>{
 const s=memory();assert.deepEqual(loadRaceSetup(s),{mode:'grid',opponent:'NOVA'});
 saveRaceSetup(s,{mode:'duel',opponent:'MIST'});assert.deepEqual(loadRaceSetup(s),{mode:'duel',opponent:'MIST'});
 s.setItem('mumu.circuit.race-mode.v1','broken');assert.deepEqual(loadRaceSetup(s),{mode:'grid',opponent:'NOVA'});
 assert.deepEqual(normalizeRaceSetup({mode:'not-a-mode',opponent:'UNKNOWN'}),{mode:'grid',opponent:'NOVA'});
 const blocked={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};
 assert.equal(loadRaceSetup(blocked).mode,'grid');assert.doesNotThrow(()=>saveRaceSetup(blocked,{mode:'duel'}));
});
test('duel wins use actual finish times, never the progress ranking; ties and unfinished rivals are explicit',()=>{
 assert.equal(duelOutcome(null,10),null);assert.equal(duelOutcome(10,null),'win');
 assert.equal(duelOutcome(10,11),'win');assert.equal(duelOutcome(11,10),'loss');assert.equal(duelOutcome(10,10),'draw');
 const cars=[{player:true,progress:98,finish:null},{player:false,id:'slk',name:'NOVA',progress:104,finish:null}];
 assert.equal(duelStatus(cars).gapMetres,-6);cars[0].progress=108;assert.equal(duelStatus(cars).gapMetres,4);
 cars[0].finish=10;cars[1].finish=9;assert.equal(duelStatus(cars).outcome,'loss');assert.equal(duelStatus([]),null);
});
test('duel records count wins and runs, but only replace the personal best with a faster real finish',()=>{
 const s=memory();let r=submitDuelRecord(s,setup,entry());assert.equal(r.saved,true);assert.equal(r.wins,1);assert.equal(r.runs,1);
 r=submitDuelRecord(s,setup,entry(88,'loss'));assert.equal(r.improved,false);assert.equal(r.best.time,82);assert.equal(r.wins,1);assert.equal(r.runs,2);
 r=submitDuelRecord(s,setup,entry(80,'draw'));assert.equal(r.improved,true);assert.equal(r.previous.time,82);assert.equal(r.best.time,80);assert.equal(r.wins,1);assert.equal(r.runs,3);
 assert.equal(duelRecord(s,setup).lastOutcome,'draw');
 for(const bad of [{time:0,outcome:'win'},{time:NaN,outcome:'win'},{time:81,outcome:'pending'}])assert.throws(()=>submitDuelRecord(s,setup,bad));
});
test('duel records are separated by course revision, lap count, player, opponent, difficulty and weather',()=>{
 const s=memory();submitDuelRecord(s,setup,entry());const key=duelRecordKey(setup);
 for(const change of [{trackId:'yeosu'},{laps:3},{player:'gtr'},{opponent:'RAVEN'},{difficulty:'hard'},{weather:'rain'}]){
  assert.notEqual(duelRecordKey({...setup,...change}),key);assert.equal(duelRecord(s,{...setup,...change}),null);
 }
 assert.ok(duelRecordKey({...setup,trackId:'yeosu'}).includes('osm-20261012'));
});
test('duels preserve the old six-car medal progress, personal best, replay ghost and championship contract',()=>{
 const s=memory();submitRecord(s,'namak',1,{time:84,vehicle:'supra'});
 saveGhost(s,'namak',1,{version:1,vehicle:'supra',interval:.1,time:84,data:[0,1,2,0,0,0,1]});
 const progress=progressFromRecords(s),ghost=loadGhost(s,'namak',1),best=bestRecord(s,'namak',1);
 submitDuelRecord(s,setup,entry(72));
 assert.deepEqual(progressFromRecords(s),progress);assert.deepEqual(loadGhost(s,'namak',1),ghost);assert.deepEqual(bestRecord(s,'namak',1),best);
 assert.throws(()=>commitRound(newChampionship({vehicle:'supra',id:'duel'}),'namak',[{name:'YOU',time:72,finished:true},{name:'NOVA',time:73,finished:true}]));
});
test('corrupt, missing and blocked duel storage never prevent racing or showing the real result',()=>{
 const s=memory();s.setItem('mumu.circuit.duel-records.v1','{bad');assert.equal(duelRecord(s,setup),null);assert.equal(submitDuelRecord(s,setup,entry()).saved,true);
 const blocked={getItem(){throw Error('denied');},setItem(){throw Error('quota');}};
 assert.equal(duelRecord(blocked,setup),null);assert.equal(submitDuelRecord(blocked,setup,entry()).saved,false);
 assert.equal(submitDuelRecord(null,setup,entry()).saved,false);
});
