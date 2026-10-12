import {RIVAL_RACE_PROFILE} from './rivalSpeed.js';

// Rival pace per difficulty. Rivals still send pedals only: no rubber-banding,
// no teleports. Easy keeps the previous rival calibration exactly.
export const DIFFICULTIES=Object.freeze([
 Object.freeze({id:'easy',label:'쉬움',description:'예전 라이벌 속도',paceBase:.95,paceStep:.02,profile:RIVAL_RACE_PROFILE,nitro:false}),
 Object.freeze({id:'normal',label:'보통',description:'코너와 추월에서 따라붙는 라이벌',paceBase:.99,paceStep:.02,profile:Object.freeze({maxSpeed:245,lateralAcceleration:7.3,fullBrakingHorizon:true}),nitro:true,rivalNitro:Object.freeze({startCharge:25,passiveCharge:2,draftCharge:8})}),
 Object.freeze({id:'hard',label:'어려움',description:'니트로와 빠른 코너 공략',paceBase:1.01,paceStep:.02,profile:Object.freeze({maxSpeed:265,lateralAcceleration:8.1,fullBrakingHorizon:true}),nitro:true,rivalNitro:Object.freeze({startCharge:60,passiveCharge:5,draftCharge:8})}),
]);
export const DEFAULT_DIFFICULTY='normal';
export function difficultyById(id){return DIFFICULTIES.find(d=>d.id===id)||DIFFICULTIES.find(d=>d.id===DEFAULT_DIFFICULTY);}
export function difficultyPace(difficulty,rivalIndex){return difficulty.paceBase+Math.max(0,Math.min(4,rivalIndex))*difficulty.paceStep;}

// The player starts from the back of the six-car grid and has to race through.
export const PLAYER_GRID_SLOT=5;
// Car 0 is the player, cars 1..5 are rivals. Slot 0 is pole position.
export function gridSlot(car,playerSlot=PLAYER_GRID_SLOT){
 if(car===0)return playerSlot;
 return car-1<playerSlot?car-1:car;
}

const KEY='mumu.circuit.difficulty.v1';
export function loadDifficulty(storage){try{return difficultyById(storage?.getItem(KEY)).id;}catch{return DEFAULT_DIFFICULTY;}}
export function saveDifficulty(storage,id){try{storage?.setItem(KEY,difficultyById(id).id);}catch{}}
