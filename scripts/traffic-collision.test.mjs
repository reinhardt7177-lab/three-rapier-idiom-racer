import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import {initPhysics,createVehiclePhysics,stepVehicleWorld,STEP} from '../src/driving/physics.js';
import {createRoadTraffic} from '../src/rebuild/roadTraffic.js';
import {createRaceContacts} from '../src/rebuild/raceContacts.js';
import {VEHICLES} from '../src/rebuild/fleet.js';
import {RACE_TUNING} from '../src/rebuild/vehicleDynamics.js';

test('civilian cars move through pedals and collide as dynamic chassis, with shared crash feedback',async()=>{
 await initPhysics();const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;
 world.createCollider(RAPIER.ColliderDesc.cuboid(30,.5,600).setTranslation(0,-.5,500));
 const route={length:1000,points:Array.from({length:500},(_,i)=>({x:0,y:0,z:i*2,dx:0,dz:1,distance:i*2}))};
 const traffic=createRoadTraffic(world,route,{count:1}),car=traffic.cars[0],contacts=createRaceContacts(world);
 const playerSim=createVehiclePhysics({sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec:VEHICLES[0],raceTuning:RACE_TUNING.supra});
 const player={sim:playerSim,player:true};
 try{
  playerSim.reset({x:-3.2,y:1.3,z:185},0,{stepWorld:false});
  for(let i=0;i<120;i++){playerSim.step({brake:1},false);traffic.step([],false);stepVehicleWorld(world);traffic.finishStep();}
  const before=car.state.position.z;
  for(let i=0;i<120;i++){playerSim.step({brake:1},false);traffic.step([],true);stepVehicleWorld(world);traffic.finishStep();}
  assert.ok(car.state.position.z>before+1,'pedals move the civilian car');assert.ok(car.state.wheels.some(w=>Math.abs(w.rotation)>.1));
  // Initial impact velocity is a test fixture; the traffic body remains live.
  playerSim.body.setLinvel({x:0,y:0,z:32},true);
  let vehicleHits=0;
  for(let i=0;i<360;i++){
   playerSim.step({throttle:1},false);traffic.step([],false);stepVehicleWorld(world,contacts.queue);traffic.finishStep();player.state=playerSim.finishStep();
   contacts.finish([player,car],STEP,(_,hit)=>{if(hit.otherVehicle)vehicleHits++;});
  }
  assert.ok(vehicleHits>0,'race and civilian contact is classified as a vehicle collision');
  assert.ok(car.impact.count>0);assert.ok(car.state.position.y>0,'collision does not drop the traffic chassis below asphalt');
 }finally{contacts.dispose();playerSim.dispose();traffic.dispose();assert.equal(traffic.cars.length,0);world.free();}
});
