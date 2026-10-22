import fs from 'node:fs';
import {runRace} from '../../scripts/race-sim.mjs';
import {difficultyById} from '../../src/rebuild/raceDifficulty.js';
const [label='baseline',count='6',track='yeosu']=process.argv.slice(2),samples=[],stalls=new Map();
let next=0;const started=performance.now();
const result=await runRace({trackId:track,difficultyId:'normal',trafficCount:Number(count),playerProfile:difficultyById('hard').profile,maxSeconds:450,trace:(time,cars,planner)=>{
 for(const c of cars){const s=stalls.get(c)||{age:0,max:0};s.age=c.finish==null&&c.state.kmh<3?s.age+1/120:0;s.max=Math.max(s.max,s.age);stalls.set(c,s);}
 if(time<next)return;next+=1;
 samples.push({time,cars:cars.map(c=>({id:c.id,player:c.player,progress:+c.progress.toFixed(2),kmh:+c.state.kmh.toFixed(2),index:c.index,position:c.state.position,plan:planner.snapshot(c)}))});
}});
const report={label,trafficCount:Number(count),wallSeconds:(performance.now()-started)/1000,result,stalls:[...stalls].map(([c,s])=>({id:c.id,maxSeconds:s.max})),samples};
fs.writeFileSync(`artifacts/ai-impact-20261016/${label}-${track}-${count}.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({label,wallSeconds:report.wallSeconds,result,stalls:report.stalls}));
