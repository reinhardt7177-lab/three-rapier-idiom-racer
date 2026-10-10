// Personal bests, medal targets and the lap-count preference. Storage is a
// per-browser convenience: every read/write tolerates blocked or full storage.
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
export const MEDALS=Object.freeze([
 Object.freeze({id:'gold',label:'금메달'}),Object.freeze({id:'silver',label:'은메달'}),Object.freeze({id:'bronze',label:'동메달'}),
]);

export function medalTimes(trackId,laps=1){
 const base=ONE_LAP[trackId];if(!base)return null;
 const gain=(ROLLING_GAIN[trackId]??0)*(Math.max(1,laps)-1);
 return Object.fromEntries(Object.entries(base).map(([k,v])=>[k,v*Math.max(1,laps)-gain]));
}
export function medalFor(time,targets){
 if(!targets||!Number.isFinite(time))return null;
 return MEDALS.find(m=>time<=targets[m.id])?.id??null;
}

const RECORDS_KEY='mumu.circuit.records.v1',LAPS_KEY='mumu.circuit.laps.v1';
export const recordKey=(trackId,laps)=>`${trackId}:${laps}`;
function read(storage){
 try{const value=JSON.parse(storage?.getItem(RECORDS_KEY)||'{}');return value&&typeof value==='object'?value:{};}catch{return {};}
}
export function bestRecord(storage,trackId,laps){
 const entry=read(storage)[recordKey(trackId,laps)];
 return entry&&Number.isFinite(entry.time)?entry:null;
}
// Returns {improved, previous, best}. A slower run never overwrites a record.
export function submitRecord(storage,trackId,laps,entry){
 const all=read(storage),key=recordKey(trackId,laps),previous=all[key]&&Number.isFinite(all[key].time)?all[key]:null;
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
