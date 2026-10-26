import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import {initPhysics,createVehiclePhysics,forwardOf,STEP,stepVehicleWorld} from '../src/driving/physics.js';
import {RACE_TUNING} from '../src/rebuild/vehicleDynamics.js';
import {createRaceContacts} from '../src/rebuild/raceContacts.js';
import {aiInput,nearestRoute} from '../src/rebuild/course.js';
import {createRaceInput,handleRaceKeyDown,raceLayout} from '../src/rebuild/raceInput.js';
import {VEHICLES} from '../src/rebuild/fleet.js';

test('releasing one pedal source preserves another finger or keyboard owner',()=>{
 const input=createRaceInput();input.press('ArrowUp','pointer-1');input.press('ArrowUp','pointer-2');input.press('ArrowUp');
 input.release('ArrowUp','pointer-1');input.release('ArrowUp','pointer-2');assert.equal(input.read().throttle,1);
 input.release('ArrowUp');assert.equal(input.read().throttle,0);
});
test('cancelled steering and pedal pointers release independently during simultaneous driving',()=>{
 const input=createRaceInput();input.press('ArrowUp','pointer-1');input.press('ArrowRight','pointer-2');
 assert.deepEqual([input.read().throttle,input.read().steer],[1,1]);input.release('ArrowRight','pointer-2');
 assert.deepEqual([input.read().throttle,input.read().steer],[1,0]);input.release('ArrowUp','pointer-1');
 assert.deepEqual([input.read().throttle,input.read().steer],[0,0]);
});
function keyboardHarness(){
 const input=createRaceInput();let paused=false,toggles=0;
 const actions={input,inRace:()=>true,canDrive:()=>!paused,pause(){paused=!paused;toggles++;input.clear();},recover:()=>input.clear(),restart:()=>input.clear(),mute(){}};
 function key(code,{repeat=false,button=false,editable=false}={}){
  let prevented=false;handleRaceKeyDown({code,repeat,preventDefault(){prevented=true;},target:{closest(selector){return (selector==='button'?button:editable)?{}:null;}}},actions);return prevented;
 }
 return {input,key,paused:()=>paused,toggles:()=>toggles};
}
test('menu click focus cannot disable ESC; resume rejects a stale held key repeat',()=>{
 const h=keyboardHarness();h.key('KeyW');assert.equal(h.input.read().throttle,1);
 h.key('Escape',{button:true});assert.ok(h.paused());assert.equal(h.input.read().throttle,0);
 h.key('Escape',{button:true,repeat:true});assert.equal(h.toggles(),1);
 h.key('Escape',{button:true});assert.ok(!h.paused());h.key('KeyW',{repeat:true});assert.equal(h.input.read().throttle,0);
 h.key('KeyW');assert.equal(h.input.read().throttle,1);
});
test('typing and Space on menu buttons remain native UI actions',()=>{
 const h=keyboardHarness();assert.equal(h.key('Escape',{editable:true}),false);assert.equal(h.toggles(),0);
 assert.equal(h.key('Space',{button:true}),false);assert.equal(h.input.read().boost,false);
 assert.equal(h.key('KeyW',{editable:true}),false);assert.equal(h.input.read().throttle,0);
});
test('focus or layout clearing releases every control and requires a fresh press',()=>{
 const input=createRaceInput();for(const code of ['KeyW','KeyD','ShiftLeft','Space'])input.press(code);
 input.press('ArrowDown','pointer-1');input.press('TouchBrake','pointer-2');input.clear();
 for(const code of ['KeyW','KeyD','ShiftLeft','Space'])input.press(code,'keyboard',true);
 assert.deepEqual(input.read(),{throttle:0,brake:0,reverse:0,steer:0,handbrake:false,boost:false});
});
test('layout detection changes on rotation or touch controls disappearing, not tiny address-bar resize',()=>{
 assert.notEqual(raceLayout(390,844),raceLayout(844,390));assert.notEqual(raceLayout(844,390),raceLayout(1100,620));
 assert.equal(raceLayout(844,390),raceLayout(1100,390),'the compact HUD also shows pedals above 1000px width');
 assert.equal(raceLayout(390,844),raceLayout(390,800));
});

const straight={length:1500,points:Array.from({length:300},(_,i)=>({x:0,y:0,z:i*5,dx:0,dz:1,distance:i*5}))};

test('holding the touch brake physically stops and stays stopped, while keyboard reverse remains available',async()=>{
 await initPhysics();const input=createRaceInput(),sim=createVehiclePhysics({barriers:false,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec:VEHICLES.find(v=>v.id==='supra'),raceTuning:RACE_TUNING.supra});
 try{
  for(let i=0;i<120;i++)sim.step({brake:1});for(let i=0;i<600;i++)sim.step({throttle:1});assert.ok(sim.snapshot().speed>20);
  input.press('TouchBrake','pointer-1');input.press('TouchBrake','pointer-2');input.release('TouchBrake','pointer-1');assert.equal(input.read().brake,1);assert.equal(input.read().reverse,0);
  let minimumSpeed=Infinity;for(let i=0;i<1200;i++){const s=sim.step(input.read());assert.equal(s.drive,0);minimumSpeed=Math.min(minimumSpeed,s.speed);}
  console.log({touchBrakeMinimumSpeed:minimumSpeed,stoppedKmh:sim.snapshot().kmh});
  assert.ok(sim.snapshot().kmh<.1);assert.ok(minimumSpeed>-.03,'a held brake must never turn into reverse drive');
  input.release('TouchBrake','pointer-2');assert.equal(input.read().brake,0);input.press('KeyS');assert.equal(input.read().reverse,1);
  for(let i=0;i<240;i++)sim.step(input.read());assert.ok(sim.snapshot().speed<-1);input.clear();assert.equal(input.read().reverse,0);
 }finally{sim.dispose();}
});
await initPhysics();
test('AI stops behind a stationary car without impact and follows when it moves',()=>{
 const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;
 world.createCollider(RAPIER.ColliderDesc.cuboid(70,.5,930).setTranslation(0,-.5,0));
 const make=(id,z)=>createVehiclePhysics({sharedWorld:world,arcade:true,progressiveAcceleration:true,launchEnabled:false,raceTuning:RACE_TUNING[id],start:{x:0,y:.85,z},spec:{track:1.59,wheelbase:2.47,wheelRadius:.35}});
 const rear=make('supra',100),front=make('mustang',160),contacts=createRaceContacts(world),cars=[{sim:rear},{sim:front}];let hits=0,minimumGap=Infinity,index=20;
 try{
  for(let i=0;i<120;i++){rear.step({brake:1},false);front.step({brake:1},false);stepVehicleWorld(world);cars.forEach(c=>c.state=c.sim.finishStep());}
  for(let i=0;i<120*14;i++){
   index=nearestRoute(straight,cars[0].state.position,index).index;
   rear.step(aiInput(straight,cars[0].state,index,0,1,[cars[1].state]),false);front.step({brake:1},false);
   stepVehicleWorld(world,contacts.queue);cars.forEach(c=>c.state=c.sim.finishStep());contacts.finish(cars,STEP,()=>hits++);
   minimumGap=Math.min(minimumGap,cars[1].state.position.z-cars[0].state.position.z);
  }
  console.log({stationaryLeadHits:hits,minimumGap,rearKmh:cars[0].state.kmh});
  assert.equal(hits,0,'AI must brake instead of rear-ending the stopped driver');
  assert.ok(minimumGap>5&&cars[0].state.kmh<1,'stop with bumper clearance');
  for(let i=0;i<120*4;i++){
   index=nearestRoute(straight,cars[0].state.position,index).index;
   rear.step(aiInput(straight,cars[0].state,index,0,1,[cars[1].state]),false);front.step({throttle:1},false);
   stepVehicleWorld(world,contacts.queue);cars.forEach(c=>c.state=c.sim.finishStep());contacts.finish(cars,STEP,()=>hits++);
  }
  assert.equal(hits,0);assert.ok(cars[0].state.kmh>35,'following resumes when the lead car drives away');
 }finally{contacts.dispose();rear.dispose();front.dispose();world.free();}
});

test('all three cars can drive away and change direction after an oblique wall impact',()=>{
 for(const id of ['supra','slk','mustang']){
  const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;
  world.createCollider(RAPIER.ColliderDesc.cuboid(100,.5,200).setTranslation(0,-.5,0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(500,2,.5).setTranslation(0,2,30));
  const sim=createVehiclePhysics({sharedWorld:world,arcade:true,progressiveAcceleration:true,launchEnabled:false,raceTuning:RACE_TUNING[id],start:{x:0,y:.85,z:0},spec:{track:1.59,wheelbase:2.47,wheelRadius:.35}});
  const contacts=createRaceContacts(world),car={sim};let impacts=0,maxZ=0,penetration=-Infinity;
  const tick=input=>{sim.step(input,false);stepVehicleWorld(world,contacts.queue);car.state=sim.finishStep();contacts.finish([car],STEP,()=>impacts++);maxZ=Math.max(maxZ,car.state.position.z);
   const q=car.state.rotation,shape=sim.colliders[0].shape;
   const rightZ=2*(q.x*q.z-q.w*q.y),upZ=2*(q.y*q.z+q.w*q.x),forwardZ=1-2*(q.x*q.x+q.y*q.y);
   // Project the rotated round-cuboid onto the wall normal. A sideways car
   // legitimately approaches closer than a car pointing straight at the wall.
   const farZ=sim.colliders[0].translation().z+Math.abs(rightZ)*shape.halfExtents.x+Math.abs(upZ)*shape.halfExtents.y+Math.abs(forwardZ)*shape.halfExtents.z+shape.borderRadius;
   penetration=Math.max(penetration,farZ-29.5);return car.state;};
  try{
   sim.reset({x:0,y:.85,z:0},Math.PI/18,{stepWorld:false});for(let i=0;i<120;i++)tick({brake:1});
   const forward=forwardOf(sim.body.rotation());sim.body.setLinvel({x:forward.x*230/3.6,y:0,z:forward.z*230/3.6},true);
   for(let i=0;i<240;i++)tick({});assert.ok(impacts>0);assert.ok(penetration<.06,`${id}: chassis penetrated wall by ${penetration}m`);
   // The new shoulder envelope can spin the car to face away from the wall.
   // In that case reverse drives INTO the wall, so choose the actual escape
   // direction from its post-impact heading. Head-on reverse is tested separately.
   const escapeReverse=forwardOf(car.state.rotation).z>0,escape=escapeReverse?{reverse:1}:{throttle:1};
   const stopped={...car.state.position};for(let i=0;i<300;i++)tick(escape);
   const retreat=Math.hypot(car.state.position.x-stopped.x,car.state.position.z-stopped.z);
   assert.ok(retreat>3&&(escapeReverse?-car.state.speed:car.state.speed)>.5,`${id}: can drive away in the direction clear of the wall`);
   for(let i=0;i<360;i++){tick(escapeReverse?{throttle:1}:{reverse:1});if((escapeReverse?car.state.speed:-car.state.speed)>2&&car.state.contacts===4)break;}
   assert.ok((escapeReverse?car.state.speed:-car.state.speed)>2&&car.state.contacts===4,`${id}: opposite drive direction resumes after escape`);
   assert.ok(penetration<.06);console.log({id,impacts,maxZ,penetration,retreat,escapeReverse,restartKmh:car.state.kmh});
  }finally{contacts.dispose();sim.dispose();world.free();}
 }
});
