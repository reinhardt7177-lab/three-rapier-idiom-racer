import fs from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {Quaternion,Vector3} from 'three';
import {initPhysics,createVehiclePhysics,STEP,stepVehicleWorld} from '../../src/driving/physics.js';
import {VEHICLES} from '../../src/rebuild/fleet.js';
import {RACE_TUNING} from '../../src/rebuild/vehicleDynamics.js';
import {nearestRoute,routePose,forwardProgress,aiInput} from '../../src/rebuild/course.js';
import {recoveredCollider} from '../../src/rebuild/worldCollision.js';
const label=process.argv[2]??'current';
if(!/^[a-zA-Z0-9-]+$/.test(label))throw new Error('Use a simple diagnostic label.');
if(label==='before')throw new Error('The pre-change recording is preserved; use current or final for new measurements.');
const route=JSON.parse(fs.readFileSync(new URL('../../public/assets/rebuild/world-route.json',import.meta.url)));
await initPhysics();
const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;world.numSolverIterations=8;
const binary=fs.readFileSync(new URL('../unity-recovery/colliders.bin',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../unity-recovery/colliders.json',import.meta.url)));
const colliderNames=new Map();
for(const part of manifest){
 const vertices=new Float32Array(part.vertices),indices=new Uint32Array(part.indices);
 for(let i=0;i<vertices.length;i++)vertices[i]=binary.readFloatLE(part.offset+i*4);
 for(let i=0;i<indices.length;i++)indices[i]=binary.readUInt32LE(part.offset+vertices.byteLength+i*4);
 const collider=world.createCollider(recoveredCollider(vertices,indices));colliderNames.set(collider.handle,part.name??Object.keys(part));
}
const spec=VEHICLES[0],pose=routePose(route,25,-2.2),sim=createVehiclePhysics({sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec,raceTuning:RACE_TUNING.supra,start:pose.position});
let index=25,progress=0,distance=route.points[index].distance,previous,priorAcceleration=0;
if(label==='noCCD')sim.body.enableCcd(false);
if(label==='noBodyContacts')sim.colliders.forEach(c=>c.setSensor(true));
const summaries={},worst=[],q=new Quaternion(),up=new Vector3(),lastUp=new Vector3();
try {
 sim.reset(pose.position,pose.yaw,{stepWorld:false});
 for(let i=0;i<240;i++){sim.step({brake:1},false);stepVehicleWorld(world);sim.finishStep();}
 previous=sim.snapshot();lastUp.set(0,1,0).applyQuaternion(q.copy(previous.rotation));
 for(let tick=0;tick<120*450&&progress<route.length;tick++){
  const input=aiInput(route,previous,index,-2.2,1);
  sim.step(input,false);const staged=sim.snapshot(),userForce=sim.body.userForce();stepVehicleWorld(world);const state=sim.finishStep();
  const near=nearestRoute(route,state.position,index);index=near.index;
  progress+=forwardProgress(distance,near.point.distance,route.length);distance=near.point.distance;
  up.set(0,1,0).applyQuaternion(q.copy(state.rotation));
  const tiltRate=up.angleTo(lastUp)/STEP,acceleration=(state.velocity.y-previous.velocity.y)/STEP;
  const jerk=Math.abs(acceleration-priorAcceleration)/STEP;
  const s=summaries[near.point.region]??={samples:0,contactChanges:0,under3:0,maxTiltRate:0,maxVerticalAcceleration:0,maxVerticalJerk:0,sumTiltRate2:0,sumVerticalAcceleration2:0};
  s.samples++;s.contactChanges+=Number(state.contacts!==previous.contacts);s.under3+=Number(state.contacts<3);
  s.maxTiltRate=Math.max(s.maxTiltRate,tiltRate);s.maxVerticalAcceleration=Math.max(s.maxVerticalAcceleration,Math.abs(acceleration));s.maxVerticalJerk=Math.max(s.maxVerticalJerk,jerk);
  s.sumTiltRate2+=tiltRate*tiltRate;s.sumVerticalAcceleration2+=acceleration*acceleration;
  if(tiltRate>1||Math.abs(acceleration)>15){
   const solverContacts=[];
   for(const c of sim.colliders)world.contactPairsWith(c,other=>world.contactPair(c,other,manifold=>{
    solverContacts.push({collider:colliderNames.get(other.handle),contacts:manifold.numContacts(),solverContacts:manifold.numSolverContacts(),distances:Array.from({length:manifold.numContacts()},(_,i)=>manifold.contactDist(i))});
    for(let i=0;i<manifold.numSolverContacts();i++)solverContacts.push({collider:colliderNames.get(other.handle),point:manifold.solverContactPoint(i),distance:manifold.solverContactDist(i),normal:manifold.normal()});
   }));
   worst.push({tick,index,region:near.point.region,kmh:state.kmh,contacts:state.contacts,previousContacts:previous.contacts,tiltRate,verticalAcceleration:acceleration,position:state.position,preWorldVelocity:staged.velocity,postWorldVelocity:state.velocity,userForce,normal:state.wheels.map(w=>w.normal),ride:state.ride,solverContacts});if(worst.length>1000)worst.sort((a,b)=>Math.max(b.tiltRate,Math.abs(b.verticalAcceleration)/15)-Math.max(a.tiltRate,Math.abs(a.verticalAcceleration)/15)).splice(100);
  }
  previous=state;lastUp.copy(up);priorAcceleration=acceleration;
 }
 for(const s of Object.values(summaries)){s.rmsTiltRate=Math.sqrt(s.sumTiltRate2/s.samples);s.rmsVerticalAcceleration=Math.sqrt(s.sumVerticalAcceleration2/s.samples);delete s.sumTiltRate2;delete s.sumVerticalAcceleration2;}
 worst.sort((a,b)=>Math.max(b.tiltRate,Math.abs(b.verticalAcceleration)/15)-Math.max(a.tiltRate,Math.abs(a.verticalAcceleration)/15));
 const result={label,scope:'Single Supra, automatic route following, recovered 160 collider world. Simulated 120 Hz, no browser or camera.',progress,completed:progress>=route.length,finalIndex:index,summaries,worst:worst.slice(0,50)};
 fs.writeFileSync(new URL(`./route-${label}.json`,import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,worst:result.worst.slice(0,2)},null,2));
}finally{sim.dispose();world.free();}
