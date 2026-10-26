import fs from 'node:fs';
import {runRace,loadTrack} from '../../scripts/race-sim.mjs';
import {difficultyById} from '../../src/rebuild/raceDifficulty.js';
const rows=[],data=loadTrack('coastal');
const result=await runRace({data,trackId:'coastal',difficultyId:'normal',playerProfile:difficultyById('hard').profile,maxSeconds:40,trace(time,cars,planner){
 if(Math.round(time*120)%12)return;
 rows.push({time,cars:cars.map(c=>{const s=c.state,p=data.route.points[c.index];return {id:c.id,index:c.index,metres:c.progress,lane:(s.position.x-p.x)*p.dz-(s.position.z-p.z)*p.dx,position:s.position,kmh:s.kmh,drive:s.drive,brake:s.brake,steer:s.steer,velocity:s.velocity,angularVelocity:s.angularVelocity,contacts:s.contacts,ride:s.ride,plan:planner.snapshot(c),wheelHeights:s.wheels.map(w=>w.point?.y??null),surface:s.surface,boost:s.action?.active};})});
}});
fs.writeFileSync(new URL('early-motion-baseline.json',import.meta.url),JSON.stringify({execution:'Local Windows CPU / Rapier WASM',maxSeconds:40,result,rows},null,2));
console.log('saved early motion',rows.length);
