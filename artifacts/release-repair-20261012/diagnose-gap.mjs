import fs from 'node:fs';
import {runRace,loadTrack} from './sim-gap.mjs';
import {difficultyById,difficultyPace} from '../../src/rebuild/raceDifficulty.js';
import {personalityByName,personalitySpeedProfile} from '../../src/rebuild/rivalPersonalities.js';
import {curveSpeeds} from '../../src/rebuild/course.js';
const data=loadTrack('yeosu'),route=data.route,difficulty=difficultyById('easy');
const limit=curveSpeeds(route,personalitySpeedProfile(difficulty.profile,personalityByName('BLAZE')));
const timeline=[],out=new URL('gap-easy-stall.json',import.meta.url),started=performance.now();
let stoppedSince=null,stopped=false;
try{
 const result=await runRace({trackId:'yeosu',difficultyId:'easy',trafficCount:6,laps:1,maxSeconds:420,playerProfile:difficultyById('hard').profile,data,
  trace(time,cars,planner,traffic){
   const c=cars.find(c=>c.id==='porsche911'),p=route.points[c.index],s=c.state;
   if(s.kmh<2&&time>40){stoppedSince??=time;}else stoppedSince=null;
   if(Math.round(time*120)%1200===0||(stoppedSince!=null&&time-stoppedSince>5)){
    const sample={time,metres:c.progress,index:c.index,position:s.position,velocity:s.velocity,kmh:s.kmh,drive:s.drive,brake:s.brake,steer:s.steer,plan:planner.snapshot(c),pace:difficultyPace(difficulty,2),availableSpeed:limit[c.index]*difficultyPace(difficulty,2),nearby:[...cars,...traffic.cars].filter(o=>o!==c&&Math.hypot(o.state.position.x-s.position.x,o.state.position.z-s.position.z)<140).map(o=>({name:o.name,finish:o.finish,index:o.index,position:o.state.position,velocity:o.state.velocity,kmh:o.state.kmh,lane:(o.state.position.x-p.x)*p.dz-(o.state.position.z-p.z)*p.dx,along:(o.state.position.x-s.position.x)*p.dx+(o.state.position.z-s.position.z)*p.dz,plan:planner.snapshot(o)}))};
    timeline.push(sample);fs.writeFileSync(out,JSON.stringify({execution:'Local CPU diagnostic; original physics and 420s cap; no transforms changed',seconds:time,wallSeconds:(performance.now()-started)/1000,timeline},null,2));
   }
   if(stoppedSince!=null&&time-stoppedSince>5){stopped=true;throw Error('Diagnostic captured a sustained stopped Porsche');}
  }});
 fs.writeFileSync(out,JSON.stringify({execution:'Local CPU diagnostic',wallSeconds:(performance.now()-started)/1000,result,timeline},null,2));
}catch(error){if(!stopped)throw error;console.log(error.message);}
console.log(JSON.stringify(timeline.slice(-2),null,2));
