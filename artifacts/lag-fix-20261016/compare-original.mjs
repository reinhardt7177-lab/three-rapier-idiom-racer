import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import RAPIER from '@dimforge/rapier3d-compat';
import * as current from '../../src/driving/physics.js';
import {VEHICLES} from '../../src/rebuild/fleet.js';
import {playerRaceTuning} from '../../src/rebuild/vehicleDynamics.js';
const root=path.resolve('.');
const source=fs.readFileSync(new URL('./before/src/driving/physics.js',import.meta.url),'utf8').replace(/from\s+(['"])([^'"]+)\1/g,(_,quote,specifier)=>`from ${quote}${specifier.startsWith('.')?pathToFileURL(path.resolve(root,'src/driving',specifier)).href:import.meta.resolve(specifier)}${quote}`);
const original=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
await current.initPhysics();
function fixture(api,id){
 const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=current.STEP;
 world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,400).setTranslation(0,-.5,0));
 world.createCollider(RAPIER.ColliderDesc.cuboid(30,2,.5).setTranslation(0,2,75));
 const car=api.createVehiclePhysics({sharedWorld:world,arcade:true,progressiveAcceleration:true,launchEnabled:false,spec:VEHICLES.find(v=>v.id===id),raceTuning:playerRaceTuning(id),start:{x:0,y:1.3,z:0}});
 return {world,car,dispose(){car.dispose();world.free();}};
}
if(process.argv[2]==='benchmark'){
 const rows=[];
 function run(api,label){
  const f=fixture(api,'supra');
  try{
   for(let i=0;i<1200;i++){api===original?f.car.step({brake:1},false):f.car.prepareStep({brake:1});api.stepVehicleWorld(f.world);f.car.finishStep();}
   const started=performance.now();let state;
   for(let i=0;i<24000;i++){
    const phase=i%2400,input=phase<1200?{throttle:1}:phase<1500?{brake:1}:phase<1950?{throttle:1,steer:.5,handbrake:true}:{reverse:1};
    api===original?f.car.step(input,false):f.car.prepareStep(input);api.stepVehicleWorld(f.world);state=f.car.finishStep();
   }
   const ms=performance.now()-started;rows.push({label,ms,steps:24000,microsecondsPerStep:ms/24});return state;
  }finally{f.dispose();}
 }
 const warmA=run(original,'warm-A'),warmB=run(current,'warm-B');assert.deepEqual(warmA,warmB);
 const states=[run(original,'A1'),run(current,'B1'),run(original,'A2'),run(current,'B2')];states.forEach(s=>assert.deepEqual(s,states[0]));
 fs.writeFileSync(new URL('./warm-cpu-comparison.json',import.meta.url),JSON.stringify({executedAt:new Date().toISOString(),note:'Local single-car real Rapier, flat road with wall, same process, warmup, no render; warm rows retained.',rows},null,2));
 console.log(JSON.stringify(rows));process.exit(0);
}
const report=[];
for(const {id} of VEHICLES){
 const a=fixture(original,id),b=fixture(current,id);let impacts=0;
 try{for(let tick=0;tick<1800;tick++){
  const input=tick<120?{brake:1}:tick<900?{throttle:1}:tick<1080?{brake:1}:tick<1320?{throttle:1,steer:.6,handbrake:true}:tick<1560?{reverse:1}:{throttle:1,steer:-.7};
  a.car.step(input,false);b.car.prepareStep(input);
  original.stepVehicleWorld(a.world);current.stepVehicleWorld(b.world);
  const sa=a.car.finishStep(),sb=b.car.finishStep();assert.deepEqual(sb,sa,`${id}, tick ${tick}`);
  if(sa.collisionResponse.severity>0)impacts++;
 }report.push({id,identicalSteps:1800,impactSteps:impacts});}finally{a.dispose();b.dispose();}
}
fs.writeFileSync(new URL('./original-state-comparison.json',import.meta.url),JSON.stringify({executedAt:new Date().toISOString(),report},null,2));
console.log(JSON.stringify(report));
