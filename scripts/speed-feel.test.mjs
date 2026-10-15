import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { createChaseCamera, drivingMotionEnabled } from '../src/driving/chaseCamera.js';
import { createDrivingAudio } from '../src/driving/drivingAudio.js';

test('explicit camera choice is honored while an unset choice respects reduced motion', () => {
  assert.equal(drivingMotionEnabled(undefined, true), false);
  assert.equal(drivingMotionEnabled(undefined, false), true);
  assert.equal(drivingMotionEnabled(false, false), false);
  assert.equal(drivingMotionEnabled(false, true), false);
  assert.equal(drivingMotionEnabled(true, true), true);
});

test('230 km/h camera translation does not accumulate trailing lag at 30/60/120 FPS', () => {
  for (const fps of [30, 60, 120]) for (const compact of [false, true]) {
    const camera = new PerspectiveCamera(57, 1, .1, 1000), chase = createChaseCamera(camera), p = new Vector3(), forward = new Vector3(0, 0, 1);
    for (let i = 0; i < fps * 10; i++) { p.z += 230 / 3.6 / fps; chase.update(p, forward, 230, 1 / fps, { compact, snap: i === 0 }); }
    const desired = (compact ? 8.2 : 7.2) + .2 * 230 / 240;
    assert.ok(Math.abs((p.z - camera.position.z) - desired) < .001);
    assert.ok(camera.position.distanceTo(p) < (compact ? 9.1 : 8));
  }
});
test('reduced motion fixes FOV and reset snaps to the new position', () => {
  const c = new PerspectiveCamera(57), chase = createChaseCamera(c);
  chase.update(new Vector3(0, 1, 500), new Vector3(0, 0, 1), 230, 1 / 60, { motion: false });
  assert.equal(c.fov, 54);
  chase.update(new Vector3(0, 1, -720), new Vector3(0, 0, 1), 0, 1 / 60, { snap: true });
  assert.ok(Math.abs(c.position.z + 727.2) < .001);
});
test('full boost and acceleration stay within nine metres even after prolonged 300 km/h travel',()=>{
 for(const fps of [30,60,120])for(const compact of [false,true]){
  const camera=new PerspectiveCamera(),chase=createChaseCamera(camera),p=new Vector3(),f=new Vector3(0,0,1);
  for(let i=0;i<fps*20;i++){
   p.z+=300/3.6/fps;const result=chase.update(p,f,300,1/fps,{compact,push:1,boost:true,snap:i===0});
   assert.ok(result.distance<9.4);assert.ok(result.fov<=(compact?65.5:59.5)+1e-8);
  }
 }
});
test('audio defaults to silent, clamps volume and fails safely without Web Audio', async () => {
  const a = createDrivingAudio(); assert.equal(a.status().enabled, false); assert.equal(a.status().state, 'uninitialized');
  a.setVolume(5); assert.equal(a.status().volume, 1); a.setVolume(-1); assert.equal(a.status().volume, 0);
  assert.equal(await a.setEnabled(true), false); assert.equal(a.status().failed, true); a.dispose(); assert.equal(await a.setEnabled(true), false);
});
