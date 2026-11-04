import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import {initPhysics,createVehiclePhysics,STEP,stepVehicleWorld} from '../src/driving/physics.js';
import {RACE_TUNING} from '../src/rebuild/vehicleDynamics.js';
import {createRaceContacts} from '../src/rebuild/raceContacts.js';
import {audioMix} from '../src/driving/drivingAudio.js';
await initPhysics();
const specs={supra:{track:1.59,wheelbase:2.47,wheelRadius:.35},slk:{track:1.55,wheelbase:2.43,wheelRadius:.34},mustang:{track:1.62,wheelbase:2.72,wheelRadius:.365}};
const create=(id='supra',options={})=>createVehiclePhysics({barriers:false,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec:specs[id],raceTuning:RACE_TUNING[id],start:{x:0,y:.85,z:-400},...options});
const run=(sim,ticks,input={})=>{let s;for(let i=0;i<ticks;i++)s=sim.step(input);return s;};

test('three cars accelerate with real gear cuts, roll their tyres by travelled distance and physically brake',()=>{
 for(const id of Object.keys(specs)){
  const sim=create(id);try{
   let s=run(sim,120),zero=s,wheelStart=s.wheels[1].rotation,shifts=0,previousGear=s.gear,peakPitch=0,time100;
   for(let i=0;i<120*12&&s.kmh<110;i++){
    s=sim.step({throttle:1});if(s.kmh>=100&&time100===undefined)time100=(i+1)*STEP;
    if(s.gear!==previousGear&&s.powertrain.shifting)shifts++;previousGear=s.gear;
    peakPitch=Math.max(peakPitch,Math.abs(s.rotation.x));
    assert.equal(s.contacts,4);assert.ok(s.wheels.every(w=>w.load>0));
   }
   assert.ok(time100>3&&time100<9,`${id}: 0-100 ${time100}s`);assert.ok(shifts>=1);
   const distance=s.position.z-zero.position.z,rolling=Math.abs(s.wheels[1].rotation-wheelStart)*specs[id].wheelRadius;
   assert.ok(Math.abs(rolling-distance)<distance*.035,`${id}: rolling ${rolling}, distance ${distance}`);
   assert.ok(peakPitch<.0001,'grounded arcade chassis must not rock under acceleration');
   assert.equal(audioMix(s).rpm,s.powertrain.rpm,'engine audio follows the actual transmission RPM');
   const from=s.position.z;let frontLoad=0,rearLoad=0,stopTime=0;
   for(let i=0;i<120*8&&s.kmh>1;i++){
    s=sim.step({brake:1});stopTime+=STEP;
    if(i>8&&i<40){frontLoad+=s.wheels[1].load+s.wheels[3].load;rearLoad+=s.wheels[0].load+s.wheels[2].load;}
   }
   const stopping=s.position.z-from;
   assert.ok(s.kmh<=1&&stopping>25&&stopping<90,`${id}: braking ${stopping}m, ${stopTime}s`);
   assert.ok(frontLoad>rearLoad,'front suspension bears the larger measured load during braking');
   console.log({id,mass:s.mass,time100,stopping,stopTime,rolling,distance,shifts,peakPitch});
  }finally{sim.dispose();}
 }
});

test('a wheel on a raised kerb compresses independently of the opposite wheel',()=>{
 const sim=create();try{
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(.34,.055,.44).setTranslation(-specs.supra.track/2,.055,-400-specs.supra.wheelbase/2));
  const s=run(sim,240,{brake:1});
  assert.equal(s.contacts,4);assert.ok(Math.abs(s.wheels[0].suspensionLength-s.wheels[2].suspensionLength)>.025);
  assert.ok(Math.abs(s.wheels[0].y-s.wheels[2].y)>.025);
 }finally{sim.dispose();}
});

function shared(){const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;world.numSolverIterations=8;world.createCollider(RAPIER.ColliderDesc.cuboid(70,.5,930).setTranslation(0,-.5,0));return world;}
test('a rear-end collision transfers momentum to another car and reports real solver contact',()=>{
 const world=shared(),contacts=createRaceContacts(world),rear=create('supra',{sharedWorld:world,start:{x:0,y:.85,z:-20}}),front=create('mustang',{sharedWorld:world,start:{x:0,y:.85,z:0}});
 const cars=[{sim:rear},{sim:front}];let hits=0,peakFront=0;
 try{
  for(let i=0;i<120*7;i++){
   rear.step(i<120?{brake:1}:{throttle:1},false);front.step({brake:.08},false);stepVehicleWorld(world,contacts.queue);
   cars.forEach(c=>c.state=c.sim.finishStep());contacts.finish(cars,STEP,(_,hit)=>{assert.ok(hit.point&&Number.isFinite(hit.point.y));assert.ok(hit.deltaV>=.6);hits++;});
   peakFront=Math.max(peakFront,front.snapshot().velocity.z);
  }
  assert.ok(hits>0,'physics solver emitted a real impact');assert.ok(peakFront>3,'struck car receives momentum');
  assert.ok(front.snapshot().position.z>3);assert.ok(front.snapshot().position.z-rear.snapshot().position.z>3.5,'cars do not pass through one another');
  console.log({rearEndHits:hits,peakFront,front:front.snapshot().position,rear:rear.snapshot().position});
 }finally{contacts.dispose();rear.dispose();front.dispose();world.free();}
});

test('CCD stops a 230 km/h wall strike and controls remain usable after impact',()=>{
 const world=shared(),contacts=createRaceContacts(world),sim=create('supra',{sharedWorld:world,start:{x:0,y:.85,z:0}}),car={sim};let hits=0,maxZ=0;
 world.createCollider(RAPIER.ColliderDesc.cuboid(20,2,.5).setTranslation(0,2,30));
 const tick=input=>{sim.step(input,false);stepVehicleWorld(world,contacts.queue);car.state=sim.finishStep();contacts.finish([car],STEP,()=>hits++);maxZ=Math.max(maxZ,car.state.position.z);return car.state;};
 try{
  for(let i=0;i<120;i++)tick({brake:1});sim.body.setLinvel({x:0,y:0,z:230/3.6},true);
  for(let i=0;i<240;i++)tick({});
  assert.ok(hits>0);assert.ok(maxZ<28,'chassis must not tunnel through the wall');
  const stopped=car.state.position.z;for(let i=0;i<300;i++)tick({reverse:1});
  assert.ok(car.state.position.z<stopped-3,'reverse drives away from the collision');
  assert.ok(car.state.speed<0);assert.ok(Number.isFinite(car.state.rotation.w));
  console.log({wallHits:hits,maxZ,reverseDistance:stopped-car.state.position.z});
 }finally{contacts.dispose();sim.dispose();world.free();}
});

test('airborne throttle cannot propel or glue the chassis to the road',()=>{
 const world=new RAPIER.World({x:0,y:-9.81,z:0}),a=create('supra',{sharedWorld:world,start:{x:0,y:20,z:0}}),b=create('supra',{sharedWorld:world,start:{x:10,y:20,z:0}});
 try{
  for(let i=0;i<120;i++){a.step({throttle:1},false);b.step({},false);stepVehicleWorld(world);a.finishStep();b.finishStep();}
  const s=a.snapshot(),t=b.snapshot();assert.equal(s.contacts,0);assert.ok(Math.abs(s.velocity.z)<1e-5);
  assert.ok(Math.abs(s.position.y-t.position.y)<1e-5);assert.ok(s.velocity.y<-9);
 }finally{a.dispose();b.dispose();world.free();}
});
