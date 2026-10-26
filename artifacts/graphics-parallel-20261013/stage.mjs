import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const files=['.gitattributes','package.json','src/rebuild/runtime.js','src/rebuild/course.js','src/rebuild/rivalPlanner.js','src/rebuild/raceRecords.js',...['coastalVisuals','namakVisuals','yeosuVisuals','yeosuVisualLayout','seongsamjaeVisuals','staticWorld','daylightSky'].map(n=>`src/rebuild/${n}.js`),...['map-materials','namak-visuals','yeosu-visuals','seongsamjae-visuals','traffic-planner','traffic-race','korea-medals','race-records'].map(n=>`scripts/${n}.test.mjs`),...['NEXT_STEPS','RELEASE_REPAIR_20261012','GRAPHICS_PARALLEL_20261013','YEOSU_GRAPHICS_20261013','SEONGSAMJAE_VISUALS_20261013'].map(n=>`docs/${n}.md`)];
function walk(dir,exclude=false){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory()){if(e.name==='local-helper-before'||e.name==='qa-dist-20261013'||e.name==='node_modules'||e.name==='.git')continue;walk(p,exclude);}else{if(exclude&&(/^reference[-_]/.test(e.name)||/\.(jpe?g|webp|mp4|blend)$/i.test(e.name)))continue;if(fs.statSync(p).size>100_000_000)throw Error('Large file needs LFS '+p);files.push(p);}}}
walk('artifacts/graphics-parallel-20261013',true);
const repair='artifacts/release-repair-20261012';
for(const label of ['final','graphics'])for(const ending of ['check-inputs.json','check-summary.json','check.log'])files.push(`${repair}/${label}-${ending}`);
for(const label of ['final','graphics'])walk(`${repair}/${label}-check-evidence`);
walk(`${repair}/before/traffic-final`);
for(const name of ['yeosu-medal-calibration.json','traffic-scoped-unit.log','traffic-scoped-rain.json','traffic-scoped-rain.log','traffic-scoped-equivalence.json','traffic-scoped-equivalence.log','traffic-scoped-full-course.json','graphics-bundle.json','calibrate-obstacle.mjs','scoped-equivalence.mjs','run-rain-scope.mjs','planner-obstacle.mjs','course-gap.mjs','sim-obstacle.mjs'])files.push(`${repair}/${name}`);
const unique=[...new Set(files)].filter(p=>fs.existsSync(p));
for(let i=0;i<unique.length;i+=32)execFileSync('git',['add','--',...unique.slice(i,i+32)],{stdio:['ignore','ignore','pipe']});
const report={staged:unique.length,paths:unique};fs.writeFileSync('artifacts/graphics-parallel-20261013/stage-manifest.json',JSON.stringify(report,null,2));console.log(JSON.stringify({files:unique.length},null,2));
