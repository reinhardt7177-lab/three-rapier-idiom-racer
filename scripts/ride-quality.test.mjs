import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3,Quaternion} from 'three';
import {initPhysics,createVehiclePhysics,STEP} from '../src/driving/physics.js';
import {RACE_TUNING} from '../src/rebuild/vehicleDynamics.js';
import {createChaseCamera} from '../src/driving/chaseCamera.js';
await initPhysics();
const specs={supra:{track:1.59,wheelbase:2.47,wheelRadius:.35},slk:{track:1.55,wheelbase:2.43,wheelRadius:.34},mustang:{track:1.62,wheelbase:2.72,wheelRadius:.365}};
const orientation=s=>new Quaternion(s.rotation.x,s.rotation.y,s.rotation.z,s.rotation.w);

function suspensionKick(id,legacy=false,kick=.35){
 const sim=createVehiclePhysics({barriers:false,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec:specs[id],raceTuning:{...RACE_TUNING[id],...(legacy?{bodyDamping:0,activeRide:false}:{})},start:{x:0,y:.85,z:0}});
 try{
  if(legacy)for(let i=0;i<4;i++){sim.controller.setWheelSuspensionCompression(i,4.4);sim.controller.setWheelSuspensionRelaxation(i,5.2);}
  let s;for(let i=0;i<240;i++)s=sim.step({brake:1});
  const rest=orientation(s);sim.body.setAngvel({x:kick,y:0,z:kick*.35},true);
  let peak=0,settled=0,lost=0;
  for(let i=0;i<240;i++){
   s=sim.step({brake:1});const angle=orientation(s).angleTo(rest);peak=Math.max(peak,angle);
   if(i>=120)settled=Math.max(settled,angle);if(s.contacts<4)lost++;
  }
  return {peak,settled,lost,contacts:s.contacts};
 }finally{sim.dispose();}
}
test('all three cars reduce real rebound and retain contact recovery under a strong impact',()=>{
 for(const id of Object.keys(specs)){
  for(const kick of [.35,1]){
   const before=suspensionKick(id,true,kick),after=suspensionKick(id,false,kick);
   assert.ok(after.peak<before.peak*.93,`${id}: pitch/roll peak did not improve`);
   assert.ok(after.settled<.003,`${id}: residual rocking after one second`);
   // A strong kick physically lifts a tyre even with the original suspension.
   // Normal road excitation must stay grounded; large impacts must regain it.
   if(kick===.35)assert.equal(after.lost,0,'normal road excitation lost tyre support');
   else assert.ok(after.lost<=before.lost,'strong impact must not prolong loss of support');
   assert.equal(after.contacts,4,'all tyres must regain contact after the kick');
   console.log({id,kick,before,after});
  }
 }
});

test('flat-road acceleration to over 200 km/h has no repeated loss of contact or centimetre heave',()=>{
 for(const id of Object.keys(specs)){
  const sim=createVehiclePhysics({barriers:false,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec:specs[id],raceTuning:RACE_TUNING[id],start:{x:0,y:.85,z:-600}});
  try{
   for(let i=0;i<240;i++)sim.step({brake:1});let low=Infinity,high=-Infinity,s;
   for(let i=0;i<120*24;i++){s=sim.step({throttle:1});low=Math.min(low,s.position.y);high=Math.max(high,s.position.y);assert.equal(s.contacts,4);}
   assert.ok(s.kmh>200);assert.ok(high-low<.012,`${id}: ${high-low}m heave`);
   console.log({id,heaveMetres:high-low,kmh:s.kmh});
  }finally{sim.dispose();}
 }
});

test('chase isolates rapid suspension heave at 30/60/120 FPS without horizontal speed lag',()=>{
 for(const fps of [30,60,120]){
  const camera=new PerspectiveCamera(),chase=createChaseCamera(camera),forward=new Vector3(0,0,1);let low=Infinity,high=-Infinity;
  for(let i=0;i<fps*4;i++){
   const t=i/fps,p=new Vector3(0,2+.015*Math.sin(t*2*Math.PI*6),230/3.6*t);
   chase.update(p,forward,230,1/fps,{stableRide:true,snap:i===0});
   if(i>fps){low=Math.min(low,camera.position.y);high=Math.max(high,camera.position.y);}
   assert.ok(Math.abs(p.z-camera.position.z-(7.2+.2*230/240))<.001);
  }
  assert.ok(high-low<.009,`${fps} FPS: camera bounce ${high-low}m`);
  console.log({fps,cameraHeave:high-low,roadHeave:.03});
 }
});

test('stabilized chase follows steep grades, holds its paused frame and snaps after road recovery',()=>{
 const camera=new PerspectiveCamera(),chase=createChaseCamera(camera),f=new Vector3(0,0,1);
 for(let i=0;i<600;i++){
  const p=new Vector3(0,5+i/60*4,i/60*230/3.6);
  chase.update(p,f,230,1/60,{stableRide:true,snap:i===0});
  assert.ok(Math.abs(camera.position.y-(p.y+2.7))<=.220001,'height delay must stay bounded on hills');
 }
 const p=new Vector3(0,5+599/60*4,599/60*230/3.6),paused=camera.position.clone();
 chase.update(p,f,230,0,{stableRide:true});assert.ok(camera.position.distanceTo(paused)<1e-8);
 const recovery=new Vector3(20,1,-100);chase.update(recovery,f,0,1/60,{stableRide:true,snap:true});
 assert.ok(Math.abs(camera.position.y-3.7)<1e-8);assert.ok(Math.abs(camera.position.z+107.2)<1e-8);
});
