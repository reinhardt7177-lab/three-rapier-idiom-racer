import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion,PerspectiveCamera} from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {initPhysics,createVehiclePhysics,STEP,stepVehicleWorld} from '../src/driving/physics.js';
import {RACE_TUNING} from '../src/rebuild/vehicleDynamics.js';
import {roadRecoveryPose,createRecoveryWatch,recoverySpaceClear,recoveryProgressChange} from '../src/rebuild/vehiclePose.js';
import {createChaseCamera} from '../src/driving/chaseCamera.js';
await initPhysics();
const specs={supra:{track:1.59,wheelbase:2.47,wheelRadius:.35},slk:{track:1.55,wheelbase:2.43,wheelRadius:.34},mustang:{track:1.62,wheelbase:2.72,wheelRadius:.365}};

test('stable chase cannot zoom or shake from chassis pitch, roll or repeated impacts',()=>{
 const a=new PerspectiveCamera(),b=new PerspectiveCamera(),chase=createChaseCamera(a),reference=createChaseCamera(b);
 for(let i=0;i<300;i++){
  const t=i/60,position=new Vector3(0,2,30*t),pitch=.5*Math.sin(t*15),forward=new Vector3(0,Math.sin(pitch),Math.cos(pitch));
  const options={stableRide:true,snap:i===0};
  chase.update(position,forward,108,1/60,{...options,impact:.4});reference.update(position,new Vector3(0,0,1),108,1/60,options);
  assert.ok(a.position.distanceTo(b.position)<1e-7);assert.ok(a.quaternion.angleTo(b.quaternion)<1e-7);
 }
});

test('road recovery aligns to the slope and avoids a half-metre suspension drop in all cars',()=>{
 for(const id of Object.keys(specs)){
  const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;
  const tilt=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.12),normal=new Vector3(0,1,0).applyQuaternion(tilt),point=new Vector3(0,0,0);
  world.createCollider(RAPIER.ColliderDesc.cuboid(25,.5,100).setRotation(tilt).setTranslation(...new Vector3(0,-.5,0).applyQuaternion(tilt).toArray()));
  const options={sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec:specs[id],raceTuning:RACE_TUNING[id]};
  const sim=createVehiclePhysics(options),pose=roadRecoveryPose(point,normal,0,specs[id]);
  let range=[];
  for(const legacy of [true,false]){
   sim.reset(legacy?{x:0,y:1.1,z:0}:pose.position,0,{stepWorld:false,rotation:legacy?null:pose.rotation});
   let low=Infinity,high=-Infinity,peak=0,s;
   for(let i=0;i<120;i++){sim.step({brake:1},false);stepVehicleWorld(world);s=sim.finishStep();const h=new Vector3().copy(s.position).dot(normal);low=Math.min(low,h);high=Math.max(high,h);peak=Math.max(peak,Math.hypot(s.angularVelocity.x,s.angularVelocity.z));}
   range.push({heave:high-low,peak});assert.equal(s.contacts,4);
  }
  assert.ok(range[1].heave<.06&&range[1].heave<range[0].heave*.2,`${id}: recovery still drops/bounces`);
  console.log({id,recoveryBefore:range[0],recoveryAfter:range[1]});sim.dispose();world.free();
 }
});

test('sustained inversion/fall recovers, ordinary bank and jumps do not; pause cannot advance watch',()=>{
 const watch=createRecoveryWatch(),p={x:0,y:2,z:0},q=new Quaternion(),state={position:p,rotation:q};
 for(let i=0;i<400;i++)assert.equal(watch.update(state,0,STEP),null);
 q.setFromAxisAngle(new Vector3(0,0,1),.6);for(let i=0;i<400;i++)assert.equal(watch.update(state,0,STEP),null);
 q.setFromAxisAngle(new Vector3(0,0,1),Math.PI);for(let i=0;i<100;i++)assert.equal(watch.update(state,0,STEP),null);
 for(let i=0;i<400;i++)assert.equal(watch.update(state,0,0),null);
 let reason;for(let i=0;i<90;i++)reason=watch.update(state,0,STEP)||reason;assert.equal(reason,'overturned');
 watch.reset();q.identity();p.y=-8;for(let i=0;i<65;i++)reason=watch.update(state,0,STEP)||reason;assert.equal(reason,'fallen');
 watch.reset();p.y=15;for(let i=0;i<400;i++)assert.equal(watch.update(state,0,STEP),null);
});

test('recovery preserves spent boost and resets velocities; a new race refills it',()=>{
 const sim=createVehiclePhysics({barriers:false,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec:specs.supra,raceTuning:RACE_TUNING.supra,start:{x:0,y:.85,z:-300}});
 try{
  for(let i=0;i<600;i++)sim.step({throttle:1,boost:true});const charge=sim.snapshot().action.charge;assert.ok(charge<90);
  sim.reset({x:0,y:.55,z:0},0,{stepWorld:false,preserveCharge:true});assert.equal(sim.snapshot().action.charge,charge);assert.equal(sim.snapshot().kmh,0);
  sim.reset();assert.equal(sim.snapshot().action.charge,100);
 }finally{sim.dispose();}
});

test('recovery rejects an empty-looking point in approaching traffic and never awards progress',()=>{
 const approaching={position:{x:0,y:.53,z:-20},velocity:{x:0,y:0,z:30}};
 assert.equal(recoverySpaceClear({x:0,y:.53,z:0},[approaching]),false,'fast AI will hit this spawn in less than a second');
 assert.equal(recoverySpaceClear({x:0,y:.53,z:-30},[approaching]),true,'spawn behind the approaching AI is clear');
 assert.equal(recoverySpaceClear({x:4,y:.53,z:0},[approaching]),false,'small lane shift still overlaps the swept body');
 assert.equal(recoverySpaceClear({x:0,y:.53,z:0},[{position:{x:0,y:.53,z:5}}]),false,'a stopped car must block recovery');
 assert.equal(recoveryProgressChange(100,90,6840),-10);
 assert.equal(recoveryProgressChange(100,110,6840),0);
 assert.equal(recoveryProgressChange(3,6838,6840),-5);
});

test('recovering behind fast traffic stays on its tyres instead of being launched by a rear-end hit',()=>{
 const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;
 world.createCollider(RAPIER.ColliderDesc.cuboid(50,.5,150).setTranslation(0,-.5,0));
 const options={sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec:specs.supra,raceTuning:RACE_TUNING.supra};
 const player=createVehiclePhysics(options),ai=createVehiclePhysics({...options,start:{x:0,y:.53,z:-20}});
 try{
  for(let i=0;i<120;i++){player.step({brake:1},false);ai.step({brake:1},false);stepVehicleWorld(world);player.finishStep();ai.finishStep();}
  ai.body.setLinvel({x:0,y:0,z:30},true);
  const candidate=[0,-10,-30].find(z=>recoverySpaceClear({x:0,y:.53,z},[ai.snapshot()]));assert.equal(candidate,-30);
  const pose=roadRecoveryPose({x:0,y:0,z:candidate},{x:0,y:1,z:0},0,specs.supra);
  player.reset(pose.position,0,{stepWorld:false,rotation:pose.rotation,preserveCharge:true});
  for(let i=0;i<240;i++){
   player.step({brake:1},false);ai.step({throttle:1},false);stepVehicleWorld(world);const s=player.finishStep();ai.finishStep();
   if(i>12)assert.equal(s.contacts,4);
   assert.ok(s.kmh<1,'recovered player was hit/launched by passing AI');
   assert.ok(s.position.y<.56);
  }
 }finally{player.dispose();ai.dispose();world.free();}
});

test('side-by-side solver separation protects the authored wide shoulders in all cars',()=>{
 for(const id of Object.keys(specs)){
  const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;world.numSolverIterations=8;
  world.createCollider(RAPIER.ColliderDesc.cuboid(30,.5,30).setTranslation(0,-.5,0));
  const options={sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec:specs[id],raceTuning:RACE_TUNING[id]};
  const a=createVehiclePhysics({...options,start:{x:0,y:.53,z:0}}),b=createVehiclePhysics({...options,start:{x:1.7,y:.53,z:0}});
  try{
   for(let i=0;i<240;i++){a.step({brake:1},false);b.step({brake:1},false);stepVehicleWorld(world);a.finishStep();b.finishStep();}
   const separation=b.snapshot().position.x-a.snapshot().position.x;
   assert.ok(separation>=RACE_TUNING[id].collisionWidth-.015,`${id}: painted body is outside the collision envelope (${separation}m)`);
   assert.equal(a.snapshot().contacts,4);assert.equal(b.snapshot().contacts,4);
  }finally{a.dispose();b.dispose();world.free();}
 }
});
