import {runRace} from '../../scripts/race-sim.mjs';
import {difficultyById} from '../../src/rebuild/raceDifficulty.js';
let next=0;
await runRace({trackId:'namak',difficultyId:'hard',playerProfile:difficultyById('hard').profile,maxSeconds:110,trace(t,cars,planner){
 if(t<next)return;next=t+(t>60?0.5:5);
 const pick=cars.filter(c=>c.player||['slk','rx7'].includes(c.id));
 console.log(t.toFixed(1),pick.map(c=>`${c.player?'YOU':c.id} ${Math.round(c.progress)}m ${Math.round(c.state.kmh)}kmh c${c.state.contacts} ${planner.snapshot(c)?.mode??''}/${planner.snapshot(c)?.reason??''}${c.scrape?' WALL':''}`).join(' | '));
}});
