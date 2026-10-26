import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import {initPhysics,createVehiclePhysics,stepVehicleWorld,STEP} from '../src/driving/physics.js';
import {VEHICLES} from '../src/rebuild/fleet.js';
import {playerRaceTuning} from '../src/rebuild/vehicleDynamics.js';
await initPhysics();

function fixture(id='supra'){
 const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;
 world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,400).setTranslation(0,-.5,0));
 world.createCollider(RAPIER.ColliderDesc.cuboid(30,2,.5).setTranslation(0,2,75));
 const car=createVehiclePhysics({sharedWorld:world,arcade:true,progressiveAcceleration:true,launchEnabled:false,
  spec:VEHICLES.find(v=>v.id===id),raceTuning:playerRaceTuning(id),start:{x:0,y:1.3,z:0}});
 return {world,car,dispose(){car.dispose();world.free();}};
}
test('shared preparation preserves every state field and collision response for all eight cars',()=>{
 for(const {id} of VEHICLES){
  const a=fixture(id),b=fixture(id);
  try{for(let tick=0;tick<1800;tick++){
   const input=tick<120?{brake:1}:tick<900?{throttle:1}:tick<1080?{brake:1}:tick<1320?{throttle:1,steer:.6,handbrake:true}:tick<1560?{reverse:1}:{throttle:1,steer:-.7};
   const old=a.car.step(input,false);assert.ok(old.wheels.length===4,'legacy step still returns its sample');
   assert.equal(b.car.prepareStep(input),undefined);
   stepVehicleWorld(a.world);stepVehicleWorld(b.world);
   assert.deepEqual(b.car.finishStep(),a.car.finishStep(),`${id}, tick ${tick}`);
  }}finally{a.dispose();b.dispose();}
 }
});
test('snapshot reads contact and suspension length exactly once per wheel',()=>{
 const f=fixture();
 try{
  for(let i=0;i<120;i++){f.car.prepareStep({brake:1});stepVehicleWorld(f.world);f.car.finishStep();}
  const counts={};
  for(const name of ['wheelIsInContact','wheelSuspensionLength']){
   const read=f.car.controller[name].bind(f.car.controller);counts[name]=0;
   f.car.controller[name]=(...args)=>{counts[name]++;return read(...args);};
  }
  const state=f.car.snapshot();assert.equal(state.contacts,4);
  assert.deepEqual(counts,{wheelIsInContact:4,wheelSuspensionLength:4});
  for(const wheel of state.wheels){assert.ok(wheel.point);assert.ok(wheel.normal);assert.equal(wheel.y,.7-wheel.suspensionLength);}
 }finally{f.dispose();}
});
test('preparation avoids render-only wheel queries before the common solve',()=>{
 const f=fixture();
 try{
  for(const name of ['wheelRotation','wheelSteering','wheelSuspensionForce']){
   f.car.controller[name]=()=>{throw new Error(`intermediate sample queried ${name}`);};
  }
  assert.equal(f.car.prepareStep({throttle:1,steer:.3}),undefined);
 }finally{f.dispose();}
});
