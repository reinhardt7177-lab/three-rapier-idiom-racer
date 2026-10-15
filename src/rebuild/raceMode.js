import {VEHICLES,rivalFleet} from './fleet.js';
import {gridSlot} from './raceDifficulty.js';
import {RIVAL_PERSONALITIES} from './rivalPersonalities.js';
import {onlineRoster} from './onlineProtocol.js';

export const RACE_MODES=Object.freeze([
 Object.freeze({id:'grid',label:'6대 레이스',description:'플레이어와 라이벌 5대의 순위 경쟁'}),
 Object.freeze({id:'online',label:'온라인 1:1',description:'초대 링크로 친구와 함께 출발'}),
 Object.freeze({id:'duel',label:'AI 연습 대결',description:'라이벌 한 명과 1:1 연습'}),
]);
export const DEFAULT_RACE_SETUP=Object.freeze({mode:'grid',opponent:'NOVA'});
const KEY='mumu.circuit.race-mode.v1';
export function normalizeRaceSetup(value={}){
 return {mode:RACE_MODES.some(m=>m.id===value?.mode)?value.mode:'grid',opponent:RIVAL_PERSONALITIES.some(p=>p.name===value?.opponent)?value.opponent:'NOVA'};
}
export function loadRaceSetup(storage){try{return normalizeRaceSetup(JSON.parse(storage?.getItem(KEY)||'null'));}catch{return {...DEFAULT_RACE_SETUP};}}
export function saveRaceSetup(storage,value){try{storage?.setItem(KEY,JSON.stringify(normalizeRaceSetup(value)));}catch{}}

// The six-car grid retains its original cars, slots, rival order and pace
// indices. A duel selects one of those same rivals, on a two-car front row.
export function raceRoster(selected,setup=DEFAULT_RACE_SETUP){
 const player=VEHICLES.some(v=>v.id===selected)?selected:'supra',settings=normalizeRaceSetup(setup),fleet=rivalFleet(player);
 if(settings.mode==='online')return onlineRoster(player,player);
 const indices=settings.mode==='duel'?[RIVAL_PERSONALITIES.findIndex(p=>p.name===settings.opponent)]:[0,1,2,3,4];
 const names=['YOU',...indices.map(i=>RIVAL_PERSONALITIES[i].name)];
 return names.map((name,i)=>({id:i===0?player:fleet[indices[i-1]],name,player:i===0,rivalIndex:i===0?-1:indices[i-1],slot:gridSlot(i,names.length-1)}));
}
export function duelOutcome(playerFinish,rivalFinish){
 if(!Number.isFinite(playerFinish))return null;
 if(!Number.isFinite(rivalFinish)||playerFinish<rivalFinish)return 'win';
 return playerFinish===rivalFinish?'draw':'loss';
}
export function duelStatus(cars){
 const player=cars.find(c=>c.player),rival=cars.find(c=>!c.player);
 if(!player||!rival)return null;
 return {opponent:rival.name,vehicle:rival.id,gapMetres:Math.round((player.progress-rival.progress)*10)/10,playerTime:player.finish,rivalTime:rival.finish,outcome:duelOutcome(player.finish,rival.finish)};
}
