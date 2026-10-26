import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBodyMotion,sampleBodyMotion,presentBodyMotion,resetBodyMotion,BODY_MOTION} from '../src/rebuild/bodyMotion.js';
import {createVehicleView,poseVehicle} from '../src/rebuild/assets.js';

const STEP=1/120,degrees=value=>value*180/Math.PI;
const state=(z=0,x=0)=>({
 velocity:{x,y:0,z},rotation:{x:0,y:0,z:0,w:1},position:{x:0,y:.55,z:0},
 wheels:Array.from({length:4},()=>({y:.33,steering:0,rotation:0})),
});
const view=()=>({motion:createBodyMotion(),body:new THREE.Group()});

function impulseRun(fps,pulseStep){
 const v=view(),samples=new Map(),every=120/fps;
 let previous=state(20),current=previous,peak=0;
 for(let tick=1;tick<=240;tick++){
  previous=current;current=state(tick>=pulseStep?10:20);
  const unmodified=JSON.stringify([previous,current]);
  sampleBodyMotion(v,previous,current,STEP);
  assert.equal(JSON.stringify([previous,current]),unmodified);
  if(tick%every===0){
   // At exact render/physics boundaries clock.alpha() is zero: the visual
   // pivot and the physical interpolation both display the previous sample.
   const pose=presentBodyMotion(v,0);
   samples.set(tick,pose.pitch);peak=Math.max(peak,Math.abs(pose.pitch));
  }
 }
 return {samples,peak};
}

test('one-step collision impulses survive four phases at 30/60/120fps and match at common physical times',()=>{
 const measured=[];
 for(const phase of [1,2,3,4]){
  const runs=[30,60,120].map(fps=>({fps,...impulseRun(fps,phase)}));
  for(const run of runs){
   assert.ok(run.peak>.001,'the same real impulse cannot disappear between rendered frames');
   assert.ok(run.peak<=BODY_MOTION.pitchLimit);
   for(const [tick,pitch] of run.samples){
    assert.ok(Math.abs(pitch-runs[2].samples.get(tick))<1e-12,`${run.fps}fps phase ${phase} tick ${tick}`);
   }
   measured.push({fps:run.fps,phase,peakPitchDegrees:degrees(run.peak)});
  }
 }
 console.log(JSON.stringify({bodyMotionSampling:measured}));
});

test('render interpolation never integrates a sample again and clamps only its presentation alpha',()=>{
 const v=view();sampleBodyMotion(v,state(20),state(10),STEP);
 const current=v.motion.snapshot(),start={...presentBodyMotion(v,0)},end={...presentBodyMotion(v,1)};
 assert.equal(start.pitch,0);assert.equal(end.pitch,current.pitch);
 for(let i=0;i<100;i++){
  const alpha=i/99,pose=presentBodyMotion(v,alpha);
  assert.ok(Math.abs(pose.pitch-(start.pitch+(end.pitch-start.pitch)*alpha))<1e-15);
 }
 assert.deepEqual(v.motion.snapshot(),current);
 assert.equal(presentBodyMotion(v,-10).pitch,start.pitch);
 assert.equal(presentBodyMotion(v,10).pitch,end.pitch);
});

test('paused samples preserve the spring and both interpolation endpoints; recovery clears every visible history',()=>{
 const v=view();for(let i=0;i<100;i++)sampleBodyMotion(v,state(20),state(19),STEP);
 presentBodyMotion(v,.4);
 const sampled=v.motion.snapshot(),before={...v.motion.pose(0)},after={...v.motion.pose(1)};
 const visible=v.body.rotation.toArray();
 sampleBodyMotion(v,state(0),state(0),0);
 presentBodyMotion(v,1,{paused:true});
 assert.deepEqual(v.motion.snapshot(),sampled);assert.deepEqual({...v.motion.pose(0)},before);assert.deepEqual({...v.motion.pose(1)},after);
 assert.deepEqual(v.body.rotation.toArray(),visible);
 resetBodyMotion(v);
 for(const alpha of [0,.5,1]){const pose=presentBodyMotion(v,alpha);assert.equal(pose.pitch,0);assert.equal(pose.roll,0);}
 assert.equal(v.body.rotation.x,0);assert.equal(v.body.rotation.z,0);
});

test('fixed samples keep the existing full and reduced-motion pitch and roll limits',()=>{
 for(const reducedMotion of [false,true]){
  const v=view(),scale=reducedMotion?.25:1;
  for(let i=0;i<240;i++){
   sampleBodyMotion(v,state(0),state(100,100),STEP,{reducedMotion});
   for(const alpha of [0,.5,1]){
    const pose=presentBodyMotion(v,alpha);
    assert.ok(Math.abs(pose.pitch)<=BODY_MOTION.pitchLimit*scale);
    assert.ok(Math.abs(pose.roll)<=BODY_MOTION.rollLimit*scale);
   }
  }
  assert.ok(v.body.rotation.x<0&&v.body.rotation.z>0);
 }
});

test('a remote 250ms sample measures acceleration over the packet interval and integrates its whole duration',()=>{
 const remote=view(),fixed=view(),seconds=.25,initial=state(10,0),final=state(11,1);
 sampleBodyMotion(remote,initial,final,seconds);
 let previous=initial;
 for(let tick=1;tick<=30;tick++){
  const current=state(10+tick/30,tick/30);
  sampleBodyMotion(fixed,previous,current,STEP);previous=current;
 }
 const packet=remote.motion.snapshot(),reference=fixed.motion.snapshot();
 assert.ok(Math.abs(packet.forwardAcceleration-4)<1e-12);assert.ok(Math.abs(packet.lateralAcceleration-4)<1e-12);
 assert.ok(Math.abs(packet.pitch-reference.pitch)<1e-12);assert.ok(Math.abs(packet.roll-reference.roll)<1e-12);
 // Repainting a repeated packet is not a new simulation sample.
 sampleBodyMotion(remote,final,final,0);assert.deepEqual(remote.motion.snapshot(),packet);
});

test('sampling and presenting preserve all wheel transforms and physical snapshots, with low quality clearing both endpoints',()=>{
 const root=new THREE.Group(),paint=new THREE.MeshStandardMaterial();
 const chassis=new THREE.Mesh(new THREE.BoxGeometry(1.9,.7,4.4),paint);chassis.position.y=.85;root.add(chassis);
 for(const code of ['FL','FR','RL','RR']){
  const suspension=new THREE.Group(),steering=new THREE.Group(),wheel=new THREE.Mesh(new THREE.BoxGeometry(.25,.62,.62),paint);
  suspension.name='Suspension_'+code;steering.name='Steering_'+code;wheel.name='Wheel_'+code;
  suspension.position.set(code.endsWith('L')?.8:-.8,.33,code.startsWith('F')?1.3:-1.3);
  root.add(suspension);suspension.add(steering);steering.add(wheel);
 }
 const v=createVehicleView(root,'supra'),a=state(0),b=state(1,-1),physical=JSON.stringify([a,b]);
 poseVehicle(v,a);root.updateMatrixWorld(true);
 const wheelPositions=v.wheels.map(w=>w.spin.getWorldPosition(new THREE.Vector3()).toArray());
 const transform={position:root.position.toArray(),rotation:root.quaternion.toArray()};
 try{
  for(let i=0;i<120;i++){sampleBodyMotion(v,a,b,STEP);presentBodyMotion(v,.5);}
  assert.ok(v.body.rotation.x<0&&v.body.rotation.z<0);
  assert.deepEqual(v.wheels.map(w=>w.spin.getWorldPosition(new THREE.Vector3()).toArray()),wheelPositions);
  assert.deepEqual(root.position.toArray(),transform.position);assert.deepEqual(root.quaternion.toArray(),transform.rotation);
  assert.equal(JSON.stringify([a,b]),physical);
  presentBodyMotion(v,.5,{enabled:false});
  assert.equal(v.body.rotation.x,0);assert.equal(v.body.rotation.z,0);
  assert.equal(v.motion.pose(0).pitch,0);assert.equal(v.motion.pose(1).roll,0);
  sampleBodyMotion(v,a,b,STEP,{enabled:false});assert.equal(v.motion.snapshot().pitch,0);
 }finally{v.dispose();chassis.geometry.dispose();for(const w of v.wheels)w.spin.geometry?.dispose();paint.dispose();}
});
