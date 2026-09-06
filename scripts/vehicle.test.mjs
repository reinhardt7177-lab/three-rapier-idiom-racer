import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { initPhysics, createVehiclePhysics, STEP } from '../src/driving/physics.js';
await initPhysics();
function run(sim, seconds, input) { let s; for (let i = 0; i < Math.round(seconds / STEP); i++) s = sim.step(input); return s; }
test('stationary vehicle settles on four wheels without sinking or drifting', () => {
  const sim = createVehiclePhysics(); try { const s = run(sim, 4, {}); assert.equal(s.contacts, 4); assert.ok(s.position.y > .4 && s.position.y < .9, JSON.stringify(s)); assert.ok(s.kmh < .1); } finally { sim.dispose(); }
});
test('actual 200+ km/h forward motion, bounded top speed and braking', () => {
  const sim = createVehiclePhysics(); try {
    run(sim, 1, {}); const start = sim.snapshot().position;
    const s = run(sim, 18, { throttle: 1 });
    console.log('18s acceleration:', s.kmh.toFixed(1), 'km/h, z:', s.position.z.toFixed(1));
    assert.ok(s.kmh > 200 && s.kmh <= 242); assert.ok(s.position.z > start.z + 450, 'model +Z must be actual forward');
    const end = run(sim, 8, { brake: 1 }); assert.ok(end.kmh < 1, `braking ${end.kmh}`); assert.ok(end.position.z > s.position.z);
  } finally { sim.dispose(); }
});
test('reverse, correct steering direction, reset and finite suspension', () => {
  const sim = createVehiclePhysics(); try {
    run(sim, 1, {}); const rev = run(sim, 5, { reverse: 1 }); assert.ok(rev.speed < -1 && rev.kmh <= 31); assert.ok(rev.position.z < -720);
    sim.reset(); run(sim, 1, {}); run(sim, 2, { throttle: 1 }); const turn = run(sim, 1.5, { throttle: 1, steer: 1 });
    assert.ok(turn.position.x < -1, 'driver-right is local -X with +Z forward'); assert.ok(turn.rotation.w > .5); assert.ok(turn.contacts >= 2);
    sim.reset(); const reset = run(sim, 2, {}); assert.ok(reset.kmh < .1); assert.ok(Math.abs(reset.position.x) < .05); assert.ok(reset.wheels.every(w => Number.isFinite(w.y)));
  } finally { sim.dispose(); }
});
test('CCD stops a 210 km/h impact at a solid barrier', () => {
  const sim = createVehiclePhysics({ start: { x: 0, y: .8, z: 875 } }); try {
    run(sim, 1, {}); sim.body.setLinvel({ x: 0, y: 0, z: 210 / 3.6 }, true);
    const s = run(sim, 1, {}); assert.ok(s.position.z < 900); assert.ok(s.kmh < 80); assert.ok(Number.isFinite(s.rotation.w));
  } finally { sim.dispose(); }
});
test('high-speed full steering remains upright and handbrake lowers rear grip', () => {
  for (const handbrake of [false, true]) {
    const sim = createVehiclePhysics(); try {
      run(sim, 1, {}); const before = run(sim, 6, { throttle: 1 });
      const s = run(sim, 2, { throttle: handbrake ? 0 : 1, steer: 1, handbrake });
      const up = 1 - 2 * (s.rotation.x ** 2 + s.rotation.z ** 2);
      assert.ok(up > .95); assert.equal(s.contacts, 4); assert.ok(s.position.x < -5);
      assert.equal(s.drifting, handbrake);
      if (handbrake) { assert.ok(s.kmh < before.kmh); assert.ok(sim.controller.wheelFrictionSlip(0) < sim.controller.wheelFrictionSlip(1)); }
    } finally { sim.dispose(); }
  }
});
test('coasting loses speed and airborne throttle cannot propel the car', () => {
  const sim = createVehiclePhysics(); try {
    run(sim, 1, {}); const before = run(sim, 4, { throttle: 1 }); const coast = run(sim, 2, {}); assert.ok(coast.kmh < before.kmh);
    sim.reset({ x: 0, y: 20, z: 0 }); const air = run(sim, .5, { throttle: 1, steer: 1 }); assert.equal(air.contacts, 0); assert.ok(air.kmh < .1);
  } finally { sim.dispose(); }
});
test('left and right inputs project to the matching screen side at multiple headings', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI]) for (const direction of [-1, 1]) {
    const sim = createVehiclePhysics({ barriers: false, start: { x: 0, y: .8, z: 0 } });
    try {
      sim.reset({ x: 0, y: .8, z: 0 }, yaw); run(sim, 1, {}); const start = run(sim, 1.5, { throttle: 1 });
      const p = new Vector3(start.position.x, start.position.y, start.position.z);
      const f = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const camera = new PerspectiveCamera(57, 1.6, .1, 1000);
      camera.position.copy(p).addScaledVector(f, -10); camera.position.y += 4.4;
      camera.lookAt(p.clone().addScaledVector(f, 10)); camera.updateMatrixWorld();
      const end = run(sim, .8, { throttle: 1, steer: direction });
      const screenX = new Vector3(end.position.x, end.position.y, end.position.z).project(camera).x;
      assert.ok(screenX * direction > .01, `heading ${yaw}, input ${direction}, projected x ${screenX}`);
      assert.ok(end.wheels[1].steering * direction < 0, 'front wheel steering matches the corrected yaw convention');
      assert.equal(end.wheels[0].steering, 0);
    } finally { sim.dispose(); }
  }
});
test('harbor stone walls stop both lateral impacts while the centre lane stays clear', () => {
  for (const side of [-1, 1]) {
    const sim = createVehiclePhysics({ harbor: true });
    try {
      sim.reset({ x: side * 11.5, y: 1, z: -690 }, side * Math.PI / 2); run(sim, 1, {});
      sim.body.setLinvel({ x: side * 40, y: 0, z: 0 }, true);
      const end = run(sim, .5, {}); assert.ok(side * end.position.x < 14.35); assert.ok(Number.isFinite(end.position.y));
      sim.reset(); run(sim, 1, {}); const fast = run(sim, 12, { throttle: 1 }); assert.ok(fast.kmh > 230); assert.ok(Math.abs(fast.position.x) < .1);
    } finally { sim.dispose(); }
  }
});
