import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { createChaseCamera } from '../src/driving/chaseCamera.js';
import { createDrivingAudio } from '../src/driving/drivingAudio.js';

test('230 km/h camera translation does not accumulate trailing lag at 30/60/120 FPS', () => {
  for (const fps of [30, 60, 120]) for (const compact of [false, true]) {
    const camera = new PerspectiveCamera(57, 1, .1, 1000), chase = createChaseCamera(camera), p = new Vector3(), forward = new Vector3(0, 0, 1);
    for (let i = 0; i < fps * 10; i++) { p.z += 230 / 3.6 / fps; chase.update(p, forward, 230, 1 / fps, { compact, snap: i === 0 }); }
    const desired = (compact ? 12 : 9.4) + .4 * 230 / 240;
    assert.ok(Math.abs((p.z - camera.position.z) - desired) < .001);
    assert.ok(camera.position.distanceTo(p) < (compact ? 13.3 : 10.4));
  }
});
test('reduced motion fixes FOV and reset snaps to the new position', () => {
  const c = new PerspectiveCamera(57), chase = createChaseCamera(c);
  chase.update(new Vector3(0, 1, 500), new Vector3(0, 0, 1), 230, 1 / 60, { motion: false });
  assert.equal(c.fov, 57);
  chase.update(new Vector3(0, 1, -720), new Vector3(0, 0, 1), 0, 1 / 60, { snap: true });
  assert.ok(Math.abs(c.position.z + 729.4) < .001);
});
test('audio defaults to silent, clamps volume and fails safely without Web Audio', async () => {
  const a = createDrivingAudio(); assert.equal(a.status().enabled, false); assert.equal(a.status().state, 'uninitialized');
  a.setVolume(5); assert.equal(a.status().volume, 1); a.setVolume(-1); assert.equal(a.status().volume, 0);
  assert.equal(await a.setEnabled(true), false); assert.equal(a.status().failed, true); a.dispose(); assert.equal(await a.setEnabled(true), false);
});
