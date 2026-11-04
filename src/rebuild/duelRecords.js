import {recordKey} from './raceRecords.js';
import {normalizeRaceSetup} from './raceMode.js';
import {difficultyById} from './raceDifficulty.js';

// Separate from medal/ghost/championship storage. Different opponents, cars,
// weather and difficulties never compete for the same duel personal best.
const KEY='mumu.circuit.duel-records.v1';
export function duelRecordKey({trackId,laps=1,player='supra',opponent='NOVA',difficulty='normal',weather='clear',mode='duel',side='host'}){
 if(mode==='online')return JSON.stringify([recordKey(trackId,laps),'online',side==='guest'?'guest':'host',player,weather==='rain'?'rain':'clear']);
 return JSON.stringify([recordKey(trackId,laps),player,normalizeRaceSetup({opponent}).opponent,difficultyById(difficulty).id,weather==='rain'?'rain':'clear']);
}
function read(storage){try{const data=JSON.parse(storage?.getItem(KEY)||'{}');return data&&typeof data==='object'&&!Array.isArray(data)?data:{};}catch{return {};}}
export function duelRecord(storage,setup){
 const entry=read(storage)[duelRecordKey(setup)];
 return entry&&Number.isFinite(entry.best?.time)&&entry.best.time>0&&Number.isInteger(entry.runs)&&entry.runs>=1&&Number.isInteger(entry.wins)&&entry.wins>=0&&entry.wins<=entry.runs?entry:null;
}
export function submitDuelRecord(storage,setup,entry){
 if(!Number.isFinite(entry?.time)||entry.time<=0||!['win','loss','draw'].includes(entry.outcome))throw Error('A real duel finish is required');
 const all=read(storage),key=duelRecordKey(setup),previous=duelRecord(storage,setup),improved=!previous||entry.time<previous.best.time;
 const next={best:improved?{...entry}:previous.best,runs:(previous?.runs??0)+1,wins:(previous?.wins??0)+(entry.outcome==='win'?1:0),lastOutcome:entry.outcome};
 let saved=false;
 try{storage?.setItem(KEY,JSON.stringify({...all,[key]:next}));saved=storage?.getItem(KEY)===JSON.stringify({...all,[key]:next});}catch{}
 return {improved,previous:previous?.best??null,best:next.best,runs:next.runs,wins:next.wins,saved};
}
