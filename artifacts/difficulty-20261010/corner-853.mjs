import fs from 'node:fs';
import {curveSpeeds} from '../../src/rebuild/course.js';
import {difficultyById} from '../../src/rebuild/raceDifficulty.js';
const route=JSON.parse(fs.readFileSync(new URL('../../public/assets/rebuild/world-route.json',import.meta.url)));
const e=curveSpeeds(route,difficultyById('easy').profile),n=curveSpeeds(route,difficultyById('normal').profile),h=curveSpeeds(route,difficultyById('hard').profile),c=curveSpeeds(route);
route.points.forEach((p,i)=>{if(p.distance>700&&p.distance<900&&i%3===0)console.log(Math.round(p.distance),p.region,Math.round(p.y),'classic',c[i].toFixed(0),'easy',e[i].toFixed(0),'normal',n[i].toFixed(0),'hard',h[i].toFixed(0));});
