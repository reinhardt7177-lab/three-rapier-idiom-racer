import test from 'node:test';
import assert from 'node:assert/strict';
import {newChampionship,commitRound,roundTrack,seriesTable,saveSeries,loadSeries,clearSeries,seriesBest,submitSeriesBest,SERIES_DRIVERS,SERIES_POINTS} from '../src/rebuild/championship.js';
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
const finishes=(winner='YOU')=>[winner,...SERIES_DRIVERS.filter(n=>n!==winner)].map((name,i)=>({name,time:80+i,finished:true}));
const fresh=()=>newChampionship({vehicle:'supra',id:'test'});
test('three real course rounds advance once and award 10/6/4/3/2/1',()=>{
 let s=fresh();assert.equal(roundTrack(s),'namak');s=commitRound(s,'namak',finishes());assert.equal(roundTrack(s),'yeosu');assert.deepEqual(seriesTable(s).map(r=>r.points),SERIES_POINTS);
 assert.throws(()=>commitRound(s,'namak',finishes()));s=commitRound(s,'yeosu',finishes());s=commitRound(s,'seongsamjae',finishes());assert.equal(roundTrack(s),null);assert.equal(seriesTable(s)[0].points,30);
});
test('partial, duplicate, unknown and invalid finishes cannot create championship points',()=>{
 for(const bad of [finishes().slice(1),finishes().map(()=>finishes()[0]),finishes().map((s,i)=>i? s:{...s,name:'UNKNOWN'}),finishes().map((s,i)=>i?s:{...s,finished:false}),finishes().map((s,i)=>i?s:{...s,time:NaN})])assert.throws(()=>commitRound(fresh(),'namak',bad));
 assert.throws(()=>commitRound(fresh(),'yeosu',finishes()));
});
test('rounds remain immutable and points ties use wins then real total finish time',()=>{
 const original=fresh(),a=commitRound(original,'namak',finishes()),b=commitRound(a,'yeosu',finishes('NOVA'));assert.equal(original.rounds.length,0);assert.equal(a.rounds.length,1);assert.equal(seriesTable(b)[0].points,16);assert.equal(seriesTable(b)[1].points,16);assert.equal(seriesTable(b)[0].name,'YOU');
});
test('series checkpoint resumes its next course and corrupted data is rejected',()=>{
 const storage=memory(),s=commitRound(fresh(),'namak',finishes());assert.equal(saveSeries(storage,s),true);assert.deepEqual(loadSeries(storage),s);assert.equal(roundTrack(loadSeries(storage)),'yeosu');
 const broken={...s,rounds:[...s.rounds,...s.rounds]};saveSeries(storage,broken);assert.equal(loadSeries(storage),null);clearSeries(storage);assert.equal(loadSeries(storage),null);
});
test('best series uses points before time and tolerates blocked storage',()=>{
 const storage=memory();let best=fresh(),slow=fresh();for(const t of ['namak','yeosu','seongsamjae']){best=commitRound(best,t,finishes());slow=commitRound(slow,t,finishes('NOVA'));}
 assert.equal(submitSeriesBest(storage,best).saved,true);assert.equal(submitSeriesBest(storage,slow).improved,false);assert.equal(seriesBest(storage,best).points,30);assert.throws(()=>submitSeriesBest(storage,fresh()));
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('quota');}};assert.equal(loadSeries(blocked),null);assert.equal(saveSeries(blocked,best),false);assert.equal(submitSeriesBest(blocked,best).saved,false);
});
