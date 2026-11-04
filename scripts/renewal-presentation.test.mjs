import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3,Quaternion} from 'three';
import {createChaseCamera} from '../src/driving/chaseCamera.js';
import {createImpactPresentation,validImpactState,impactDirectionForCar} from '../src/rebuild/impactPresentation.js';
import {createFirstPersonCamera} from '../src/rebuild/firstPersonCamera.js';
import {loadMotionSetting,saveMotionSetting,reducedDrivingMotion,normalizeMotionSetting} from '../src/rebuild/drivingMotionPreference.js';

const hit=(count=1,extra={})=>({count,age:0,intensity:.8,deltaV:6,kind:'impact',otherVehicle:true,point:{x:2,y:.6,z:5},normal:{x:1,y:0,z:0},velocity:{x:8,z:20},...extra});

test('a chase orbit preserves radius through crash yaw, wrapped headings and countersteering',()=>{
 for(const fps of [30,60,120]){
  const camera=new PerspectiveCamera(),chase=createChaseCamera(camera),position=new Vector3(30,2,-40),forward=new Vector3(0,0,1);
  chase.update(position,forward,100,1/fps,{stableRide:true,pedalResponse:true,snap:true});
  const radius=Math.hypot(camera.position.x-position.x,camera.position.z-position.z);
  for(const target of [Math.PI,-Math.PI+.01,Math.PI-.01,0,-Math.PI/2,Math.PI/2])for(let i=0;i<fps;i++){
   forward.set(Math.sin(target),0,Math.cos(target));
   chase.update(position,forward,100,1/fps,{stableRide:true,pedalResponse:true});
   assert.ok(Math.abs(Math.hypot(camera.position.x-position.x,camera.position.z-position.z)-radius)<1e-8);
   assert.ok(camera.position.distanceTo(position)>7&&camera.position.distanceTo(position)<8);
   camera.updateMatrixWorld();const projected=position.clone().project(camera);
   assert.ok(Math.abs(projected.x)<1&&Math.abs(projected.y)<1&&projected.z<1&&projected.z>-1,'the car stays inside the view through the yaw change');
  }
 }
});

test('orbit pause is exact and recovery snap follows heading immediately',()=>{
 const camera=new PerspectiveCamera(),chase=createChaseCamera(camera),p=new Vector3(),f=new Vector3(0,0,1),base={stableRide:true};
 chase.update(p,f,100,1/60,{...base,snap:true});f.set(1,0,0);chase.update(p,f,100,1/60,base);
 const before=camera.position.clone(),rotation=camera.quaternion.clone();chase.update(p,f,100,0,base);
 assert.ok(camera.position.distanceTo(before)<1e-12);assert.ok(camera.quaternion.angleTo(rotation)<1e-7);
 chase.update(p,f,0,1/60,{...base,snap:true});assert.ok(Math.abs(camera.position.x+7.2)<1e-9);assert.ok(Math.abs(camera.position.z)<1e-9);
});

test('a remote contact plays once; duplicates, old packets, paused and late events do not replay',()=>{
 const playback=createImpactPresentation(),source=hit(),before=JSON.stringify(source);
 const first=playback.consume(source);assert.equal(first.intensity,.8);assert.notEqual(first,source);assert.notEqual(first.point,source.point);
 assert.equal(playback.consume(hit()),null);assert.equal(playback.consume(hit(0,{intensity:0})),null);
 assert.equal(playback.consume(hit(2),{active:false}),null);assert.equal(playback.consume(hit(2)),null);
 assert.equal(playback.consume(hit(3,{age:.5})),null);assert.equal(playback.consume(hit(3)),null);
 assert.equal(playback.consume(hit(4)).count,4);assert.equal(JSON.stringify(source),before);
});

test('recovery and rematch reset impact identity without old contact bursts',()=>{
 const playback=createImpactPresentation();assert.ok(playback.consume(hit(9)));
 assert.equal(playback.consume(hit(0,{intensity:0}),{recoveryCount:1}),null);
 assert.ok(playback.consume(hit(1),{recoveryCount:1}));assert.equal(playback.consume(hit(1),{recoveryCount:1}),null);
 playback.reset();assert.ok(playback.consume(hit(1)));
 assert.ok(playback.consume(hit(1),{recoveryCount:2}),'a fresh first collision after recovery is not dropped');
});

test('unsafe optional peer contact fields cannot reach sparks, audio or the camera',()=>{
 assert.equal(validImpactState(undefined),true);
 assert.equal(validImpactState({count:0,intensity:0,deltaV:0,age:100}),true);
 for(const extra of [{count:NaN},{intensity:Infinity},{intensity:-1},{deltaV:1001},{age:-1},{kind:'floor'},{normal:{x:0,y:0,z:0}},{point:{x:Infinity,y:0,z:0}},{velocity:{x:NaN,z:0}}]){
  const bad=hit(1,extra);assert.equal(validImpactState(bad),false);assert.equal(createImpactPresentation().consume(bad),null);
 }
});

test('the same manifold contact yields opposite sides for the two cars and rotates with their headings',()=>{
 const state=(x,yaw=0)=>({position:{x,y:.6,z:5},rotation:new Quaternion().setFromAxisAngle(new Vector3(0,1,0),yaw)});
 assert.deepEqual(impactDirectionForCar(hit(),state(1)),{side:1,forward:0});
 assert.deepEqual(impactDirectionForCar(hit(),state(3)),{side:-1,forward:0});
 const rotated=impactDirectionForCar(hit(),state(1,Math.PI/2));assert.ok(rotated.forward>.999);assert.ok(Math.abs(rotated.side)<1e-8);
 assert.deepEqual(impactDirectionForCar({point:null},state(1)),{side:0,forward:0});
});

test('directional impacts mirror, keep driver eyes fixed, stay below one degree and decay fully',()=>{
 const p=new Vector3(),q=new Quaternion(),base={pedalResponse:true,motion:true,kmh:90};
 const sample=side=>{const c=new PerspectiveCamera(),rig=createFirstPersonCamera(c);rig.update(p,q,1/60,{...base,snap:true});const eye=c.position.clone(),rest=c.quaternion.clone();rig.update(p,q,1/60,{...base,impact:1,impactDirection:{side,forward:.6}});assert.equal(c.position.distanceTo(eye),0);assert.ok(c.quaternion.angleTo(rest)<Math.PI/180);const kicked=c.quaternion.clone();rig.update(p,q,0,base);assert.ok(c.quaternion.angleTo(kicked)<1e-7);for(let i=0;i<180;i++)rig.update(p,q,1/60,base);assert.ok(c.quaternion.angleTo(rest)<1e-7);return kicked;};
 const left=sample(1),right=sample(-1);assert.ok(left.angleTo(right)>.005);
});

test('chase collision direction is bounded and never creates ambient wobble',()=>{
 const p=new Vector3(),f=new Vector3(0,0,1),base={stableRide:true,contactResponse:true,pedalResponse:true};
 const positions=[];
 for(const side of [-1,1]){
  const c=new PerspectiveCamera(),chase=createChaseCamera(c);chase.update(p,f,90,1/60,{...base,snap:true});
  chase.update(p,f,90,1/60,{...base,impact:1,impactDirection:{side,forward:0}});positions.push(c.position.x);
  assert.ok(Math.abs(c.position.x)<.08);assert.ok(c.position.distanceTo(p)>7);
  for(let i=0;i<180;i++)chase.update(p,f,90,1/60,base);assert.ok(Math.abs(c.position.x)<1e-9);
 }
 assert.ok(positions[0]<0&&positions[1]>0);
});

test('a recovery snap clears old recoil but accepts a fresh collision in that same packet',()=>{
 for(const firstPerson of [false,true]){
  const camera=new PerspectiveCamera(),reference=new PerspectiveCamera(),rig=firstPerson?createFirstPersonCamera(camera):createChaseCamera(camera),still=firstPerson?createFirstPersonCamera(reference):createChaseCamera(reference);
  const p=new Vector3(),orientation=firstPerson?new Quaternion():new Vector3(0,0,1),options={snap:true,motion:true,pedalResponse:true,stableRide:true,contactResponse:true,kmh:90};
  const update=(view,extra)=>firstPerson?view.update(p,orientation,1/60,{...options,...extra}):view.update(p,orientation,90,1/60,{...options,...extra});
  update(still,{});update(rig,{impact:1,impactDirection:{side:1,forward:0}});
  assert.ok(camera.quaternion.angleTo(reference.quaternion)>.001,'new collision survives the reset');
  if(firstPerson)assert.equal(camera.position.distanceTo(reference.position),0);
  update(rig,{});assert.ok(camera.quaternion.angleTo(reference.quaternion)<1e-7,'a later recovery without a new collision clears recoil');
 }
});

test('a deliberate driving-motion choice overrides the system preference while auto honors it',()=>{
 assert.equal(reducedDrivingMotion('auto',true),true);assert.equal(reducedDrivingMotion('auto',false),false);
 assert.equal(reducedDrivingMotion('standard',true),false);assert.equal(reducedDrivingMotion('reduced',false),true);
 assert.equal(normalizeMotionSetting('injected'), 'auto');assert.equal(reducedDrivingMotion('invalid',true),true);
});

test('driving-motion choices survive reload and blocked storage fails safely',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 assert.equal(loadMotionSetting(storage),'auto');assert.equal(saveMotionSetting(storage,'standard'),true);assert.equal(loadMotionSetting(storage),'standard');
 assert.equal(saveMotionSetting(storage,'invalid'),true);assert.equal(loadMotionSetting(storage),'auto');
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 assert.equal(loadMotionSetting(blocked),'auto');assert.equal(saveMotionSetting(blocked,'reduced'),false);
});
