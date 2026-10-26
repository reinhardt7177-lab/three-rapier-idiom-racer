import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import RAPIER from '@dimforge/rapier3d-compat';
const [label='after',base=process.cwd()]=process.argv.slice(2);
const {initPhysics,createVehiclePhysics,STEP,stepVehicleWorld}=await import(pathToFileURL(`${base}/src/driving/physics.js`));
const {RACE_TUNING}=await import(pathToFileURL(`${base}/src/rebuild/vehicleDynamics.js`));
const {VEHICLES}=await import(pathToFileURL(`${base}/src/rebuild/fleet.js`));
const {touchingWall}=await import(pathToFileURL(`${base}/src/rebuild/raceSurface.js`));
await initPhysics();const rows=[];
for(const kind of ['wall-glance','rear-end']){
 const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;world.numSolverIterations=8;
 world.createCollider(RAPIER.ColliderDesc.cuboid(500,.5,1000).setTranslation(0,-.5,0));
 const wall=kind==='wall-glance'?world.createCollider(RAPIER.ColliderDesc.cuboid(.5,2,900).setTranslation(-5.5,2,0)):null;
 const create=(x,z,id='supra')=>{const sim=createVehiclePhysics({sharedWorld:world,barriers:false,arcade:true,launchEnabled:false,progressiveAcceleration:true,start:{x,y:.85,z},spec:VEHICLES.find(v=>v.id===id),raceTuning:RACE_TUNING[id]});sim.reset({x,y:.85,z},0,{stepWorld:false});return sim;};
 const a=create(kind==='wall-glance'?-3.1:0,0),b=kind==='rear-end'?create(0,10,'mustang'):null,cars=[a,b].filter(Boolean);
 for(let i=0;i<120;i++){for(const c of cars)c.step({brake:1},false);stepVehicleWorld(world);for(const c of cars)c.finishStep();}
 a.body.setLinvel({x:kind==='wall-glance'?-9:0,y:0,z:100/3.6},true);
 let scrape=false,first=null,minSpeed=1000,maxResponse=0,maxYaw=0,wallSeconds=0,lowest=Infinity;const samples=[];
 for(let i=0;i<360;i++){
  a.step({throttle:1,steer:kind==='wall-glance'?.22:0,scrape:Number(scrape)},false);b?.step({brake:.1},false);stepVehicleWorld(world);const s=a.finishStep();b?.finishStep();
  scrape=wall?touchingWall(world,a.colliders,h=>h===wall.handle):false;if(scrape)wallSeconds+=STEP;
  world.contactPairsWith(a.colliders[0],other=>{if((wall&&other.handle===wall.handle)||(b&&other.parent()?.handle===b.body.handle))first??=i*STEP;});
  if(first!==null)minSpeed=Math.min(minSpeed,s.kmh);maxResponse=Math.max(maxResponse,s.collisionResponse?.severity??0);maxYaw=Math.max(maxYaw,Math.abs(s.angularVelocity.y)*180/Math.PI);lowest=Math.min(lowest,s.position.y);
  if(i%30===0)samples.push({time:i*STEP,kmh:s.kmh,scrape,response:s.collisionResponse??null,position:s.position});
 }
 rows.push({kind,first,minSpeed,finalKmh:a.snapshot().kmh,maxResponse,maxYaw,wallSeconds,lowest,samples});for(const c of cars)c.dispose();world.free();
}
fs.writeFileSync(`artifacts/ai-impact-20261016/impact-${label}.json`,JSON.stringify(rows,null,2));console.log(JSON.stringify(rows.map(({samples,...r})=>r),null,2));
