import fs from 'node:fs';
const out=new URL('calibrate-obstacle.mjs',import.meta.url);
if(fs.existsSync(out))throw Error('Preserve the calibration helper');
let s=fs.readFileSync(new URL('calibrate-final.mjs',import.meta.url),'utf8');
s=s.replaceAll('final-yeosu.json','obstacle-yeosu.json').replaceAll('planner-final.mjs','planner-obstacle.mjs');
s=s.replace("'src/rebuild/rivalPlanner.js','src/rebuild/raceDifficulty.js'","'src/rebuild/rivalPlanner.js','src/driving/physics.js','src/rebuild/activeRide.js','src/driving/steering.js','src/rebuild/raceDifficulty.js'");
s=s.replace('routeSha256:sha(read(paths[0])),targets','routeSha256:sha(read(paths[0])),routeDataSha256:sha(Buffer.from(JSON.stringify(JSON.parse(read(paths[0]))))),targets');
fs.writeFileSync(out,s);
console.log('Calibration helper prepared; it rejects incomplete races or behavior different from the measured candidate.');
