import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { createDrivingSignals, emptySignals } from '../src/driving/drivingSignals.js';
import { createTireFeedback, TRAIL_LIMIT } from '../src/driving/tireFeedback.js';
import { audioMix, createDrivingAudio } from '../src/driving/drivingAudio.js';
import { createChaseCamera } from '../src/driving/chaseCamera.js';
import { createVehiclePhysics, initPhysics, STEP } from '../src/driving/physics.js';

const state = (speed = 15, lateral = 0, z = 0, fields = {}) => ({
  position: { x: 0, y: .6, z }, rotation: { x: 0, y: 0, z: 0, w: 1 },
  velocity: { x: lateral, y: 0, z: speed }, angularVelocity: { x: 0, y: 0, z: 0 },
  speed, kmh: Math.hypot(speed, lateral) * 3.6, contacts: 4, drive: 0, brake: 0, handbrake: false,
  wheels: [-1, 1].flatMap(x => [-1.42, 1.42].map(dz => ({ steering: 0, contact: true, point: { x, y: 0, z: z + dz }, normal: { x: 0, y: 1, z: 0 } }))), ...fields,
});
test('stationary pedals cannot create acceleration, brake scrub or drift; yaw is not deceleration', () => {
  const reader = createDrivingSignals(), stopped = state(0, 0, 0, { drive: 1, brake: 1, handbrake: true, drifting: true });
  for (let i = 0; i < 100; i++) reader.update(stopped, stopped, STEP);
  const s = reader.snapshot(); assert.equal(s.push, 0); assert.equal(s.braking, 0); assert.equal(s.scrub, 0); assert.equal(s.sliding, false);
  const previous = state(), current = state(); current.rotation = { x: 0, y: .2, z: 0, w: Math.sqrt(.96) };
  assert.equal(reader.update(previous, current, STEP).acceleration, 0);
});
test('actual velocity changes create acceleration/braking and grounded slip has entry/exit hysteresis', () => {
  const reader = createDrivingSignals(); let previous = state(8);
  for (let i = 1; i <= 60; i++) { const current = state(8 + i * STEP * 5, 0, i * .1, { drive: 1 }); reader.update(previous, current, STEP); previous = current; }
  assert.ok(reader.snapshot().push > .8); assert.equal(reader.snapshot().braking, 0);
  for (let i = 0; i < 45; i++) { const current = state(previous.speed - STEP * 8, 0, previous.position.z + .1, { brake: 1 }); reader.update(previous, current, STEP); previous = current; }
  assert.ok(reader.snapshot().braking > .7);
  reader.reset(); const sliding = state(15, 4);
  for (let i = 0; i < 20; i++) reader.update(sliding, sliding, STEP);
  assert.equal(reader.snapshot().sliding, true); assert.ok(reader.snapshot().scrub > .6);
  const airborne = state(15, 4, 0, { contacts: 0 }); reader.update(sliding, airborne, STEP);
  assert.equal(reader.snapshot().sliding, false); assert.equal(reader.snapshot().scrub, 0); assert.equal(reader.snapshot().braking, 0);
  assert.deepEqual(reader.update(previous, state(10, 0, 500), STEP), emptySignals());
});
test('real Rapier drive/brake/corner signals do not change the simulation trajectory', async () => {
  await initPhysics(); const observed = createVehiclePhysics({ barriers: false }), control = createVehiclePhysics({ barriers: false }), reader = createDrivingSignals();
  let previous = observed.snapshot(), push = 0, braking = 0, scrub = 0;
  try {
    for (let i = 0; i < 1100; i++) {
      const input = i < 600 ? { throttle: 1 } : i < 770 ? { steer: .8, handbrake: true } : { brake: 1 };
      const current = observed.step(input), baseline = control.step(input), s = reader.update(previous, current, STEP); previous = current;
      assert.deepEqual(current.position, baseline.position); assert.deepEqual(current.rotation, baseline.rotation);
      push = Math.max(push, s.push); braking = Math.max(braking, s.braking); scrub = Math.max(scrub, s.scrub);
      for (const w of current.wheels) if (w.contact) assert.ok(w.point && Number.isFinite(w.point.y) && w.normal.y > .9);
    }
    assert.ok(push > .5 && braking > .5 && scrub > .2, JSON.stringify({ push, braking, scrub }));
    observed.reset(); assert.equal(observed.snapshot().drive, 0); assert.equal(observed.snapshot().handbrake, false);
    console.log(JSON.stringify({ push, braking, scrub }));
  } finally { observed.dispose(); control.dispose(); }
});
test('tire trails have a bounded pool, fade, and never bridge reset/airborne gaps', () => {
  const trails = createTireFeedback(), s = { grounded: true, wheelSlip: [1, 1, 1, 1] };
  for (let i = 0; i < 1500; i++) trails.update(state(15, 3, i * .2), s, STEP);
  assert.equal(trails.stats().used, TRAIL_LIMIT); assert.equal(trails.root.geometry.attributes.position.count, TRAIL_LIMIT * 4);
  for (const v of trails.root.geometry.attributes.position.array) assert.ok(Number.isFinite(v));
  for (let i = 0; i < 1450; i++) trails.update(state(0), emptySignals(), STEP);
  assert.equal(trails.stats().live, 0); assert.equal(trails.root.visible, false);
  trails.clear(); assert.equal(trails.root.geometry.drawRange.count, 0);
  trails.update(state(15, 3, 0), s, STEP); trails.update(state(15, 3, 100), s, STEP); assert.equal(trails.stats().used, 0);
  trails.update(state(15, 3, 100.2), { grounded: false, wheelSlip: [1, 1, 1, 1] }, STEP); assert.equal(trails.stats().used, 0);
  trails.dispose();
});
test('load/brake/tire audio layers and bounded camera response follow signals, not handbrake flag', () => {
  const idle = audioMix({ kmh: 0, gear: 'N', handbrake: true }), fast = audioMix({ kmh: 100, gear: '3', drive: 1 }, { braking: .6, scrub: .8 });
  assert.equal(idle.tire, 0); assert.equal(idle.brake, 0); assert.equal(fast.gear, 3); assert.ok(fast.wind > idle.wind && fast.brake > 0 && fast.tire > 0);
  const camera = new PerspectiveCamera(), chase = createChaseCamera(camera), p = new Vector3(), f = new Vector3(0, 0, 1);
  chase.update(p, f, 120, 1 / 60, { snap: true, push: 1 }); assert.equal(camera.fov, 61.8); assert.ok(camera.position.distanceTo(p) < 10.5);
  chase.update(p, f, 120, 1 / 60, { motion: false, push: 1, braking: 1 }); assert.equal(camera.fov, 57); assert.equal(camera.position.y, 3.3);
});
test('pending audio resume cannot undo mute or reopen a disposed graph', async () => {
  const native = globalThis.AudioContext, instances = [];
  class MockAudio {
    constructor() { this.state = 'suspended'; this.currentTime = 0; this.sampleRate = 100; this.sources = []; instances.push(this); }
    param() { return { value: 0, setTargetAtTime(v) { assert.ok(Number.isFinite(v)); this.value = v; }, cancelScheduledValues() {} }; }
    createGain() { const gain = { gain: this.param(), connect() {}, disconnect() {} }; this.master ||= gain; return gain; }
    createBiquadFilter() { return { frequency: this.param(), Q: this.param(), connect() {} }; }
    source() { const source = { frequency: this.param(), connect() {}, start() {}, stop() { this.stopped = true; } }; this.sources.push(source); return source; }
    createOscillator() { return this.source(); } createBufferSource() { return this.source(); }
    createBuffer() { return { getChannelData: () => new Float32Array(200) }; }
    resume() { return new Promise(resolve => { this.finish = () => { if (this.state !== 'closed') this.state = 'running'; resolve(); }; }); }
    async close() { this.state = 'closed'; }
  }
  globalThis.AudioContext = MockAudio;
  try {
    const a = createDrivingAudio(), pending = a.setEnabled(true); await a.setEnabled(false); instances[0].finish(); await pending;
    assert.equal(a.status().enabled, false); assert.equal(instances[0].master.gain.value, 0);
    const second = a.setEnabled(true); a.dispose(); instances[0].finish(); await second;
    assert.equal(a.status().enabled, false); assert.equal(instances[0].state, 'closed'); assert.ok(instances[0].sources.every(s => s.stopped));
  } finally { globalThis.AudioContext = native; }
});
