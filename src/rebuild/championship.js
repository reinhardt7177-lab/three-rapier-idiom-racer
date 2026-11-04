// A round is committed only after all six real finish times are available.
// This module never controls vehicle positions, speed, inputs or race distance.
import {VEHICLES} from './fleet.js';
export const SERIES_TRACKS=Object.freeze(['namak','yeosu','seongsamjae']);
export const SERIES_POINTS=Object.freeze([10,6,4,3,2,1]);
export const SERIES_DRIVERS=Object.freeze(['YOU','NOVA','RAVEN','BLAZE','MIST','LUNA']);
const SESSION_KEY='mumu.circuit.championship.session.v1',BEST_KEY='mumu.circuit.championship.best.v1';
const safeRead=(s,k)=>{try{return JSON.parse(s?.getItem(k)||'null');}catch{return null;}};
export function newChampionship({vehicle,difficulty='normal',laps=1,id=crypto.randomUUID()}={}){
 if(!VEHICLES.some(v=>v.id===vehicle)||!['easy','normal','hard'].includes(difficulty)||![1,3].includes(laps))throw Error('Invalid championship setup');
 return {version:1,id,vehicle,difficulty,laps,rounds:[]};
}
export function roundTrack(series){return SERIES_TRACKS[series?.rounds?.length??0]??null;}
export function seriesTable(series){
 const table=SERIES_DRIVERS.map(name=>({name,points:0,wins:0,time:0}));
 for(const round of series.rounds)for(const [place,driver] of round.order.entries()){
  const row=table.find(r=>r.name===driver.name);row.points+=SERIES_POINTS[place];row.wins+=place===0?1:0;row.time+=driver.time;
 }
 return table.sort((a,b)=>b.points-a.points||b.wins-a.wins||a.time-b.time||SERIES_DRIVERS.indexOf(a.name)-SERIES_DRIVERS.indexOf(b.name));
}
export function commitRound(series,trackId,standings){
 if(trackId!==roundTrack(series))throw Error('Unexpected or repeated series round');
 if(standings.length!==6||new Set(standings.map(s=>s.name)).size!==6||standings.some(s=>!SERIES_DRIVERS.includes(s.name)||!s.finished||!Number.isFinite(s.time)||s.time<=0))throw Error('Six valid finishes required');
 const order=standings.map(s=>({name:s.name,time:s.time})).sort((a,b)=>a.time-b.time||SERIES_DRIVERS.indexOf(a.name)-SERIES_DRIVERS.indexOf(b.name));
 return {...series,rounds:[...series.rounds,{trackId,order}]};
}
export function saveSeries(storage,series){try{storage.setItem(SESSION_KEY,JSON.stringify(series));return storage.getItem(SESSION_KEY)===JSON.stringify(series);}catch{return false;}}
export function clearSeries(storage){try{storage?.removeItem(SESSION_KEY);}catch{}}
export function loadSeries(storage){
 const s=safeRead(storage,SESSION_KEY);if(!s||s.version!==1||typeof s.id!=='string'||!s.id||typeof s.vehicle!=='string'||!['easy','normal','hard'].includes(s.difficulty)||![1,3].includes(s.laps)||!Array.isArray(s.rounds)||s.rounds.length>3)return null;
 try{let checked=newChampionship({...s,id:s.id});for(const round of s.rounds)checked=commitRound(checked,round.trackId,round.order.map(d=>({...d,finished:true})));return checked;}catch{return null;}
}
const bestKey=s=>`${s.difficulty}:${s.laps}`;
export function seriesBest(storage,series){const b=safeRead(storage,BEST_KEY)?.[bestKey(series)];return b&&Number.isFinite(b.points)&&Number.isFinite(b.time)&&b.points>=0&&b.points<=30&&b.time>0?b:null;}
export function submitSeriesBest(storage,series){
 if(series.rounds.length!==3)throw Error('Complete series required');
 const row=seriesTable(series).find(r=>r.name==='YOU'),previous=seriesBest(storage,series),entry={points:row.points,wins:row.wins,time:row.time,vehicle:series.vehicle,date:new Date().toISOString().slice(0,10)};
 const improved=!previous||entry.points>previous.points||entry.points===previous.points&&(entry.wins>(previous.wins||0)||entry.wins===(previous.wins||0)&&entry.time<previous.time);
 let saved=false;if(improved){try{const all=safeRead(storage,BEST_KEY)||{};storage.setItem(BEST_KEY,JSON.stringify({...all,[bestKey(series)]:entry}));saved=true;}catch{}}
 return {improved,saved,best:improved?entry:previous};
}
