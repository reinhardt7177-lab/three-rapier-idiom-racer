import test from 'node:test';
import assert from 'node:assert/strict';
import {createArcadeAction} from '../src/driving/arcadeAction.js';
import {initPhysics,createVehiclePhysics,STEP} from '../src/driving/physics.js';
const moving={speed:20,contacts:4,throttle:1};
test('real Rapier short handbrake corner slides then recovers four-wheel contact',async()=>{
  await initPhysics();const s=createVehiclePhysics({arcade:true,barriers:false});
  try{
    for(let i=0;i<420;i++)s.step({throttle:1});let peak=0;
    for(let i=0;i<90;i++){const x=s.step({steer:1,handbrake:true});peak=Math.max(peak,x.action.slip);}
    assert.ok(peak>.1&&peak<.65);
    for(let i=0;i<240;i++)s.step({throttle:1});
    const x=s.snapshot();assert.ok(x.action.slip<.02);assert.equal(x.contacts,4);assert.ok(x.action.grip>.99);
  }finally{s.dispose();}
});
test('nitro consumes four seconds, never pulses on an empty held trigger',()=>{
  const c=createArcadeAction();let s;
  for(let i=0;i<480;i++)s=c.step({...moving,boost:true},STEP);
  assert.ok(s.charge<1e-8);
  for(let i=0;i<240;i++)s=c.step({...moving,boost:true},STEP);
  assert.equal(s.active,false);assert.equal(s.charge,0);
  s=c.step(moving,.05);assert.ok(s.charge>0);
});
test('braking, reverse, airborne, handbrake and excessive sideways slip block boost',()=>{
  for(const patch of [{brake:1},{reverse:1},{contacts:2},{handbrake:true},{lateral:20},{speed:2}]){
    const s=createArcadeAction().step({...moving,boost:true,...patch},STEP);
    assert.equal(s.active,false);assert.equal(s.charge,100);
  }
});
test('rear grip ramps in and recovers smoothly; drift requires actual slip',()=>{
  const c=createArcadeAction();let s=c.step({...moving,handbrake:true},STEP);
  assert.ok(s.grip<1&&s.grip>.9);assert.equal(s.drifting,false);
  for(let i=0;i<60;i++)s=c.step({...moving,handbrake:true,lateral:4},STEP);
  assert.equal(s.drifting,true);const previous=s.grip;
  s=c.step(moving,STEP);assert.ok(s.grip>previous&&s.grip<.5);
  for(let i=0;i<240;i++)s=c.step(moving,STEP);
  assert.ok(s.grip>.99);c.reset();assert.equal(c.step(moving,0).charge,100);
});
test('real sliding recharges faster than straight travel',()=>{
  const a=createArcadeAction(),b=createArcadeAction();let x,y;
  for(let i=0;i<240;i++){a.step({...moving,boost:true},STEP);b.step({...moving,boost:true},STEP);}
  for(let i=0;i<120;i++){x=a.step(moving,STEP);y=b.step({...moving,lateral:4},STEP);}
  assert.ok(y.charge>x.charge+10);
});
test('Rapier boost increases measured travel, while standard physics ignores boost',async()=>{
  await initPhysics();
  const make=arcade=>createVehiclePhysics({arcade,barriers:false,start:{x:0,y:.8,z:-700}});
  const standard=make(false),ignored=make(false),normal=make(true),boosted=make(true);
  try{
    for(let i=0;i<480;i++){standard.step({throttle:1});ignored.step({throttle:1,boost:true});normal.step({throttle:1});boosted.step({throttle:1});}
    for(let i=0;i<240;i++){standard.step({throttle:1});ignored.step({throttle:1,boost:true});normal.step({throttle:1});boosted.step({throttle:1,boost:true});}
    assert.deepEqual(standard.snapshot(),ignored.snapshot());
    const a=normal.snapshot(),b=boosted.snapshot();
    assert.ok(b.kmh>a.kmh+15);assert.ok(b.position.z>a.position.z+3);assert.equal(b.contacts,4);
    assert.ok(b.action.charge<60);boosted.reset();assert.equal(boosted.snapshot().action.charge,100);
  }finally{for(const s of [standard,ignored,normal,boosted])s.dispose();}
});
