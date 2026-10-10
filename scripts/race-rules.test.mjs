import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import {initPhysics,createVehiclePhysics,STEP,stepVehicleWorld} from '../src/driving/physics.js';
import {createArcadeAction} from '../src/driving/arcadeAction.js';
import {RACE_TUNING} from '../src/rebuild/vehicleDynamics.js';
import {VEHICLES} from '../src/rebuild/fleet.js';
import {RACE_NITRO,OVERTAKE_RANGE,slipstream,createOvertakeCounter,loadAssist,saveAssist} from '../src/rebuild/raceRules.js';
await initPhysics();
const supra=VEHICLES.find(v=>v.id==='supra');

function charge(options,input,seconds=4){
 const action=createArcadeAction(options);action.reset({charge:0});let s;
 for(let i=0;i<seconds/STEP;i++)s=action.step({speed:40,contacts:4,throttle:1,...input},STEP);
 return s.charge;
}
test('race nitro is earned: slow trickle, faster from drifting and drafting',()=>{
 const race={passiveCharge:RACE_NITRO.passiveCharge,draftCharge:RACE_NITRO.draftCharge};
 const cruise=charge(race,{}),draft=charge(race,{draft:1}),drift=charge(race,{lateral:8});
 assert.ok(Math.abs(cruise-4*RACE_NITRO.passiveCharge)<.01,`${cruise}`);
 assert.ok(draft>cruise*5&&drift>cruise*5,`cruise ${cruise} draft ${draft} drift ${drift}`);
 // Free-drive defaults are unchanged.
 assert.ok(Math.abs(charge({},{})-24)<.01);
 assert.ok(RACE_NITRO.startCharge<100);
});
test('overtake charge is clamped and the slide assist can be switched off live',()=>{
 const action=createArcadeAction();action.reset({charge:95});
 assert.equal(action.addCharge(12),100);assert.equal(action.addCharge(-500),0);
 const slide={speed:30,lateral:15,contacts:4};
 assert.ok(action.step(slide,STEP).recovery>0);
 action.setRecoveryAssist(false);assert.equal(action.step(slide,STEP).recovery,0);
 action.setRecoveryAssist(true);assert.ok(action.step(slide,STEP).recovery>0);
});

const car=(z,x=0,kmh=180)=>({position:{x,y:0,z},rotation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:kmh/3.6}});
test('slipstream only exists close behind a moving car in the same lane',()=>{
 const me=car(0);
 assert.ok(slipstream(me,[car(6)])>.8);
 assert.ok(slipstream(me,[car(20)])>0&&slipstream(me,[car(20)])<slipstream(me,[car(8)]));
 for(const other of [car(40),car(-10),car(10,3),car(10,0,10),car(2)])assert.equal(slipstream(me,[other]),0,JSON.stringify(other.position));
 assert.equal(slipstream(car(0,0,40),[car(10)]),0,'too slow to draft');
 assert.equal(slipstream(me,[{...car(10),position:{x:0,y:6,z:10}}]),0,'bridge deck above');
});
test('passing a nearby rival counts once; recovery setbacks and finishers do not',()=>{
 const counter=createOvertakeCounter(),player={progress:100},near={progress:110,finish:null},far={progress:500,finish:null},done={progress:2000,finish:30};
 assert.equal(counter.update(player,[near,far,done]),0);
 player.progress=115;assert.equal(counter.update(player,[near,far,done]),1);
 assert.equal(counter.update(player,[near,far,done]),0,'counted once');
 // A rival recovered far behind the player was not passed on the road.
 far.progress=140;counter.update(player,[near,far,done]);far.progress=60;assert.equal(counter.update(player,[near,far,done]),0,'sent back by recovery, not passed');
 near.progress=120;player.progress=118;counter.update(player,[near]);player.progress=121;
 assert.equal(counter.update(player,[near]),1,'re-passing after being re-passed counts');
 assert.ok(OVERTAKE_RANGE<=30);
});
test('assist preference defaults on and survives blocked storage',()=>{
 const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
 assert.equal(loadAssist(storage),true);saveAssist(storage,false);assert.equal(loadAssist(storage),false);
 const blocked={getItem(){throw new Error('x');},setItem(){throw new Error('x');}};
 assert.equal(loadAssist(blocked),true);assert.doesNotThrow(()=>saveAssist(blocked,false));
});
test('drafting halves aero drag on a real chassis and starts with a partial nitro tank',()=>{
 const run=draft=>{
  const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;world.numSolverIterations=8;
  world.createCollider(RAPIER.ColliderDesc.cuboid(60,.5,900).setTranslation(0,-.5,0).setFriction(1));
  const sim=createVehiclePhysics({sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec:supra,raceTuning:RACE_TUNING.supra,nitro:RACE_NITRO});
  try{
   sim.reset({x:0,y:.55,z:-800},0,{stepWorld:false});
   assert.equal(sim.snapshot().action.charge,RACE_NITRO.startCharge);
   for(let i=0;i<120;i++){sim.step({brake:1},false);stepVehicleWorld(world);sim.finishStep();}
   sim.body.setLinvel({x:0,y:0,z:200/3.6},true);
   let s;for(let i=0;i<3/STEP;i++){sim.step({draft},false);stepVehicleWorld(world);s=sim.finishStep();}
   return s;
  }finally{sim.dispose();world.free();}
 };
 const open=run(0),tow=run(1);
 // Half of .42v² at 200 km/h is ~.43 m/s² on a 1480 kg car: ~4.6 km/h over 3 s.
 assert.ok(tow.kmh>open.kmh+3,`tow ${tow.kmh} open ${open.kmh}`);assert.equal(tow.draft,1);
 assert.ok(tow.action.charge>open.action.charge+20,`charge ${tow.action.charge} vs ${open.action.charge}`);
});
