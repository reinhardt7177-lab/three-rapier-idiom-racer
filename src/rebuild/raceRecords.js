// Personal bests, medal targets and the lap-count preference. Storage is a
// per-browser convenience: every read/write tolerates blocked or full storage.
import {TRACKS} from './tracks.js';
export const LAP_OPTIONS=Object.freeze([1,3]);
export const DEFAULT_LAPS=1;

// One-lap medal times in seconds from a standing start. Calibrated against the
// headless six-car races: gold beats the median hard rival, bronze the median
// easy rival (docs/RACE_CHALLENGE_20261011.md).
const ONE_LAP=Object.freeze({
 coastal:Object.freeze({gold:197,silver:205,bronze:213}),
 namak:Object.freeze({gold:80,silver:85,bronze:90}),
});
// Later laps start rolling, so they are a few seconds quicker than the first.
const ROLLING_GAIN=Object.freeze({coastal:8,namak:4.5});
// Actual standing-start 1/3-lap six-car Rapier runs, not extrapolated lap gains.
// Gold/ silver/ bronze beat the hard/ normal/ easy median rival respectively.
// Yeosu: artifacts/release-repair-20261012/yeosu-medal-calibration.json
// (local CPU, current 8.90 km course with six civilian cars).
// Seongsamjae: artifacts/korea-circuits-20261011/matrix.json (Colab CPU).
const KOREA_MEDALS=Object.freeze({
 yeosu:Object.freeze({1:Object.freeze({gold:287,silver:289,bronze:294}),3:Object.freeze({gold:833,silver:857,bronze:867})}),
 seongsamjae:Object.freeze({1:Object.freeze({gold:157,silver:167,bronze:170}),3:Object.freeze({gold:457,silver:490,bronze:499})}),
});
export const MEDALS=Object.freeze([
 Object.freeze({id:'gold',label:'금메달'}),Object.freeze({id:'silver',label:'은메달'}),Object.freeze({id:'bronze',label:'동메달'}),
]);

export function medalTimes(trackId,laps=1){
 if(KOREA_MEDALS[trackId])return KOREA_MEDALS[trackId][laps]?{...KOREA_MEDALS[trackId][laps]}:null;
 const base=ONE_LAP[trackId];if(!base)return null;
 const gain=(ROLLING_GAIN[trackId]??0)*(Math.max(1,laps)-1);
 return Object.fromEntries(Object.entries(base).map(([k,v])=>[k,v*Math.max(1,laps)-gain]));
}
export function medalFor(time,targets){
 if(!targets||!Number.isFinite(time))return null;
 return MEDALS.find(m=>time<=targets[m.id])?.id??null;
}

const RECORDS_KEY='mumu.circuit.records.v1',LAPS_KEY='mumu.circuit.laps.v1';
export const recordKey=(trackId,laps)=>`${trackId}:${laps}${TRACKS.find(t=>t.id===trackId)?.revision?':'+TRACKS.find(t=>t.id===trackId).revision:''}`;
function read(storage){
 try{const value=JSON.parse(storage?.getItem(RECORDS_KEY)||'{}');return value&&typeof value==='object'?value:{};}catch{return {};}
}
function currentRecord(entry,trackId,laps){
 if(!entry||!Number.isFinite(entry.time))return null;
 // Old short-course targets cached null badges on valid new-course records.
 // Re-evaluate those badges on read, without rewriting the saved run.
 return trackId==='yeosu'?{...entry,medal:medalFor(entry.time,medalTimes(trackId,laps))}:entry;
}
export function bestRecord(storage,trackId,laps){
 const entry=read(storage)[recordKey(trackId,laps)];
 return currentRecord(entry,trackId,laps);
}
// Legacy medals still contribute to unlocks, while their shorter course times
// can never become the new road course best or its replay ghost.
export function earnedRecord(storage,trackId,laps){
 const current=bestRecord(storage,trackId,laps),legacy=read(storage)[`${trackId}:${laps}`];
 return current?.medal?current:legacy?.medal?legacy:current;
}
// Returns {improved, previous, best}. A slower run never overwrites a record.
export function submitRecord(storage,trackId,laps,entry){
 const all=read(storage),key=recordKey(trackId,laps),previous=currentRecord(all[key],trackId,laps);
 const improved=Number.isFinite(entry.time)&&(!previous||entry.time<previous.time);
 const best=improved?{...entry,medal:medalFor(entry.time,medalTimes(trackId,laps))}:previous;
 if(improved){all[key]=best;try{storage?.setItem(RECORDS_KEY,JSON.stringify(all));}catch{}}
 return {improved,previous,best};
}
export function loadLaps(storage){try{const laps=Number(storage?.getItem(LAPS_KEY));return LAP_OPTIONS.includes(laps)?laps:DEFAULT_LAPS;}catch{return DEFAULT_LAPS;}}
export function saveLaps(storage,laps){try{if(LAP_OPTIONS.includes(laps))storage?.setItem(LAPS_KEY,String(laps));}catch{}}

// Lap number (1-based, capped) and progress within the current lap.
export function lapInfo(progress,length,laps){
 const clamped=Math.max(0,progress);
 const lap=Math.min(laps,Math.floor(clamped/length)+1);
 return {lap,laps,inLap:clamped-(lap-1)*length};
}
