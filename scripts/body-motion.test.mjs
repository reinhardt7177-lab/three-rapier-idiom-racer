import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBodyMotion,applyBodyMotion,BODY_MOTION} from '../src/rebuild/bodyMotion.js';
import {createVehicleView,poseVehicle} from '../src/rebuild/assets.js';
import {createFirstPersonCamera} from '../src/rebuild/firstPersonCamera.js';
import {ghostVelocity,ghostVisibleFromCamera} from '../src/rebuild/raceGhost.js';
const state=(velocity={x:0,y:0,z:0})=>({velocity,rotation:{x:0,y:0,z:0,w:1},position:{x:0,y:.55,z:0},wheels:Array.from({length:4},()=>({y:.33,steering:0,rotation:0}))});
function hold(motion,a,b,options={}){for(let i=0;i<180;i++)motion.update(a,b,1/60,{sampleSeconds:.1,...options});return motion.snapshot();}
test('chassis acceleration/braking and left/right corner lean have the correct driver-relative signs',()=>{
 for(const [velocity,axis,sign] of [[{x:0,y:0,z:1},'pitch',-1],[{x:0,y:0,z:-1},'pitch',1],[{x:1,y:0,z:0},'roll',1],[{x:-1,y:0,z:0},'roll',-1]]){
  const result=hold(createBodyMotion(),state(),state(velocity));assert.ok(result[axis]*sign>0);
 }
 const a=state(),b=state({x:1,y:0,z:0});a.rotation=b.rotation={x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2};
 assert.ok(hold(createBodyMotion(),a,b).pitch<0,'world +X is forward when heading east');
});
test('visual springs obey limits, settle at rest, freeze in pause, and preserve physics snapshots',()=>{
 const motion=createBodyMotion(),a=state(),b=state({x:100,y:0,z:100}),before=JSON.stringify([a,b]);
 for(let i=0;i<500;i++){const p=motion.update(a,b,1/60);assert.ok(Math.abs(p.pitch)<=BODY_MOTION.pitchLimit);assert.ok(Math.abs(p.roll)<=BODY_MOTION.rollLimit);}
 const frozen=motion.snapshot();motion.update(b,a,0);assert.deepEqual(motion.snapshot(),frozen);assert.equal(JSON.stringify([a,b]),before);
 for(let i=0;i<300;i++)motion.update(a,a,1/60);
 assert.ok(Math.abs(motion.snapshot().pitch)<1e-8&&Math.abs(motion.snapshot().roll)<1e-8);
 const reduced=hold(createBodyMotion(),a,b,{reducedMotion:true});assert.ok(Math.abs(reduced.pitch)<=BODY_MOTION.pitchLimit*.25);assert.ok(Math.abs(reduced.roll)<=BODY_MOTION.rollLimit*.25);
});
test('the chassis pivot leaves all tyre/steering/suspension world positions and the first-person camera unchanged',()=>{
 const root=new THREE.Group(),rig=new THREE.Group();root.add(rig);rig.rotation.y=.2;
 const paint=new THREE.MeshStandardMaterial(),chassis=new THREE.Mesh(new THREE.BoxGeometry(1.9,.7,4.4),paint);chassis.position.y=.85;rig.add(chassis);
 for(const code of ['FL','FR','RL','RR']){
  const suspension=new THREE.Group(),steering=new THREE.Group(),wheel=new THREE.Mesh(new THREE.BoxGeometry(.25,.62,.62),paint);suspension.name='Suspension_'+code;steering.name='Steering_'+code;wheel.name='Wheel_'+code;
  suspension.position.set(code.endsWith('L')?.8:-.8,.33,code.startsWith('F')?1.3:-1.3);rig.add(suspension);suspension.add(steering);steering.add(wheel);
 }
 const view=createVehicleView(root,'supra'),a=state(),b=state({x:-1,y:0,z:1});poseVehicle(view,a);
 const before=view.wheels.map(w=>w.spin.getWorldPosition(new THREE.Vector3()).toArray()),q=view.root.quaternion.clone(),position=view.root.position.clone();
 const camera=new THREE.PerspectiveCamera(),first=createFirstPersonCamera(camera);first.update(view.root.position,view.root.quaternion,1/60,{snap:true});const cameraBefore=camera.quaternion.clone();
 for(let i=0;i<180;i++)applyBodyMotion(view,a,b,1/60,{sampleSeconds:.1});view.root.updateMatrixWorld(true);
 assert.deepEqual(view.wheels.map(w=>w.spin.getWorldPosition(new THREE.Vector3()).toArray()),before);assert.ok(view.root.quaternion.equals(q)&&view.root.position.equals(position));assert.ok(view.body.rotation.x<0&&view.body.rotation.z<0);
 first.update(view.root.position,view.root.quaternion,1/60,{snap:true});assert.ok(camera.quaternion.angleTo(cameraBefore)<1e-8,'visual chassis does not add camera roll or pitch');view.dispose();
});
test('existing seven-value ghost recordings provide smooth render motion without data mutation',()=>{
 const ghost={interval:.1,data:[]};for(let i=0;i<5;i++)ghost.data.push(0,0,i*i*.1,0,0,0,1);
 const before=JSON.stringify(ghost),a=ghostVelocity(ghost,.19),b=ghostVelocity(ghost,.21);assert.ok(b.z>a.z);assert.ok(b.z-a.z<.5);assert.equal(JSON.stringify(ghost),before);
});

test('the low-quality fallback clears visual lean without changing physical state',()=>{
 const motion=createBodyMotion(),a=state(),b=state({x:10,y:0,z:10}),before=JSON.stringify([a,b]);
 hold(motion,a,b);assert.ok(Math.abs(motion.snapshot().pitch)>0&&Math.abs(motion.snapshot().roll)>0);
 motion.update(a,b,1/60,{enabled:false});assert.equal(motion.snapshot().pitch,0);assert.equal(motion.snapshot().roll,0);
 assert.equal(JSON.stringify([a,b]),before);
});

test('a matching replay does not put its roof inside the cockpit, without changing replay positions',()=>{
 const player={x:12,y:3,z:-8},same={...player},near={x:15,y:3,z:-8},far={x:17,y:3,z:-8},before=JSON.stringify([player,same,near,far]);
 assert.equal(ghostVisibleFromCamera('first-person',same,player),false);
 assert.equal(ghostVisibleFromCamera('first-person',near,player),false);
 assert.equal(ghostVisibleFromCamera('first-person',far,player),true);
 assert.equal(ghostVisibleFromCamera('chase',same,player),true);
 assert.equal(JSON.stringify([player,same,near,far]),before);
});
