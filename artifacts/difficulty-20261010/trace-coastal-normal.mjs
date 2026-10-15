import {runRace} from '../../scripts/race-sim.mjs';
import {difficultyById} from '../../src/rebuild/raceDifficulty.js';
import {nearestRoute} from '../../src/rebuild/course.js';
await runRace({trackId:'coastal',difficultyId:'normal',playerProfile:difficultyById('hard').profile,maxSeconds:45,trace(t,cars,planner){
 const watch=cars.filter(c=>['slk','gtr'].includes(c.id)&&c.progress>760&&c.progress<900);
 if(!watch.length||Math.round(t*120)%12)return;
 console.log(t.toFixed(1),cars.filter(c=>c.progress>700&&c.progress<950).map(c=>{const p=planner.snapshot(c);return `${c.player?'YOU':c.id} ${Math.round(c.progress)}m ${Math.round(c.state.kmh)}kmh lane? g${c.state.surface.grip.toFixed(2)} imp${(c.state.contacts)} ${p?p.mode+'/'+p.reason+' '+p.targetLane:''}${c.scrape?' WALL':''}`}).join(' | '));
}});
