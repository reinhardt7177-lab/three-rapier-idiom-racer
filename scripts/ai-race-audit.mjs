import fs from 'node:fs';
import {runRace} from './race-sim.mjs';
import {difficultyById} from '../src/rebuild/raceDifficulty.js';

const matrix=[
 {trackId:'namak',difficultyId:'normal'},
 {trackId:'coastal',difficultyId:'normal'},
 {trackId:'yeosu',difficultyId:'normal',trafficCount:6,maxSeconds:540},
 {trackId:'seongsamjae',difficultyId:'normal',weather:'rain'},
 {trackId:'namak',difficultyId:'easy'},
 {trackId:'namak',difficultyId:'hard'},
 {trackId:'coastal',difficultyId:'easy',laps:3,maxSeconds:1260},
];
const label=process.argv[2]??'final',selection=process.argv[3];
const results=[];
for(const [index,scenario] of matrix.entries()){
 if(selection!=null&&index!==Number(selection))continue;
 let closeSeconds=0,swaps=0,previous=null,stall=new Map(),maxStall=0,lastSample=-1;
 const race=await runRace({...scenario,playerProfile:difficultyById('hard').profile,trace:(time,cars)=>{
  if(time-lastSample<.2)return;const dt=lastSample<0?0:time-lastSample;lastSample=time;
  const active=cars.filter(c=>c.finish==null),ordered=[...active].sort((a,b)=>b.progress-a.progress);
  const order=ordered.map(c=>c.name);
  if(previous)for(let a=0;a<order.length;a++)for(let b=a+1;b<order.length;b++){
   const pa=previous.indexOf(order[a]),pb=previous.indexOf(order[b]);if(pa>=0&&pb>=0&&pa>pb)swaps++;
  }
  previous=order;
  if(ordered.some((c,i)=>i>0&&Math.abs(ordered[i-1].progress-c.progress)<40))closeSeconds+=dt;
  for(const c of active){const duration=time>8&&c.state.kmh<3?(stall.get(c)??0)+dt:0;stall.set(c,duration);maxStall=Math.max(maxStall,duration);}
 }});
 const row={...scenario,...race,closeSeconds:+closeSeconds.toFixed(1),orderChanges:swaps,maxStall:+maxStall.toFixed(1)};
 results.push(row);fs.mkdirSync('artifacts/ai-3pass-20261015',{recursive:true});
 fs.writeFileSync(`artifacts/ai-3pass-20261015/${label}${selection??''}.json`,JSON.stringify({device:'Local CPU / Rapier WASM',results},null,2));
 console.log(JSON.stringify(row));
 if(race.cars.some(c=>!Number.isFinite(c.finish)||c.finish<=0||c.lowest<=0))process.exitCode=1;
}
