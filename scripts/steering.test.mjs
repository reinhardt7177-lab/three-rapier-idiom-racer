import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { createGT } from '../src/garage/gt.js';
import { GT_SPEC } from '../src/vehicleSpec.js';
import { steeringLimit, updateSteering, wheelSteering, applyWheelPose } from '../src/driving/steering.js';
import { initPhysics, createVehiclePhysics, STEP } from '../src/driving/physics.js';
await initPhysics();
const run = (sim, count, input = {}) => { let s; for (let i = 0; i < count; i++) s = sim.step(input); return s; };
const yaw = q => Math.atan2(2 * (q.x * q.z + q.w * q.y), 1 - 2 * (q.x ** 2 + q.y ** 2));
const disposeGT = gt => { const materials = new Set(); gt.root.traverse(o => { o.geometry?.dispose(); if (o.material) materials.add(o.material); }); materials.forEach(m => m.dispose()); };

test('Ackermann inside/outside angles share a turning centre, mirror correctly and never steer the rear', () => {
  for (const a of [.05, .2, .52]) {
    const left = wheelSteering(a), right = wheelSteering(-a);
    assert.ok(left[3] > left[1]); assert.ok(Math.abs(right[1]) > Math.abs(right[3]));
    assert.equal(left[0], 0); assert.equal(left[2], 0);
    assert.equal(left[1], -right[3]); assert.equal(left[3], -right[1]);
    const innerR = GT_SPEC.wheelbase / Math.tan(left[3]) + GT_SPEC.track / 2;
    const outerR = GT_SPEC.wheelbase / Math.tan(left[1]) - GT_SPEC.track / 2;
    assert.ok(Math.abs(innerR - outerR) < 1e-10);
    assert.ok(left[3] < .64, 'physical steering package below 37 degrees');
  }
});

test('rack responds within 0.2 seconds, centres and reverses smoothly; speed limit remains bounded', () => {
  let value = 0;
  for (let i = 0; i < 24; i++) value = updateSteering(value, 1, STEP);
  assert.ok(value < -.9);
  for (let i = 0; i < 24; i++) value = updateSteering(value, 0, STEP);
  assert.ok(Math.abs(value) < .04);
  value = -1;
  for (let i = 0; i < 24; i++) value = updateSteering(value, -1, STEP);
  assert.ok(value > .9);
  assert.equal(steeringLimit(-20), steeringLimit(20));
  assert.ok(steeringLimit(60 / 3.6) > .12); assert.ok(steeringLimit(230 / 3.6) < .01);
});

test('measured 20/40/60 km/h turns improve over baseline without yaw or position writes', () => {
  for (const [kmh, oldRadius] of [[20, 6.418], [40, 13.989], [60, 23.014]]) {
    const results = [];
    for (const direction of [-1, 1]) {
      const sim = createVehiclePhysics({ barriers: false, start: { x: 0, y: .8, z: 0 } });
      try {
        let s = run(sim, 120), distance = 0, turn = 0, minUp = 1;
        for (let i = 0; i < 720; i++) {
          const old = s;
          s = sim.step({ throttle: s.kmh < kmh ? .5 : 0, brake: s.kmh > kmh + 1 ? .2 : 0, steer: direction });
          if (i > 360) {
            const d = yaw(s.rotation) - yaw(old.rotation);
            turn += Math.atan2(Math.sin(d), Math.cos(d));
            distance += Math.hypot(s.position.x - old.position.x, s.position.z - old.position.z);
            minUp = Math.min(minUp, 1 - 2 * (s.rotation.x ** 2 + s.rotation.z ** 2));
            assert.equal(s.contacts, 4);
          }
        }
        const radius = Math.abs(distance / turn); results.push(radius);
        assert.ok(radius < oldRadius * .97, `${kmh}: ${radius} vs ${oldRadius}`);
        assert.ok(turn * direction < 0); assert.ok(minUp > .97); assert.ok(Math.abs(s.kmh - kmh) < 2);
      } finally { sim.dispose(); }
    }
    assert.ok(Math.abs(results[0] - results[1]) < .05);
    console.log(JSON.stringify({ kmh, oldRadius, newRadius: +results[0].toFixed(3) }));
  }
});

test('230 km/h full steering remains grounded and upright without rotating the body directly', () => {
  for (const direction of [-1, 1]) {
    const sim = createVehiclePhysics({ barriers: false });
    try {
      run(sim, 120); run(sim, 12 * 120, { throttle: 1 });
      assert.ok(sim.snapshot().kmh > 230);
      const s = run(sim, 120, { throttle: 1, steer: direction });
      assert.equal(s.contacts, 4); assert.ok(1 - 2 * (s.rotation.x ** 2 + s.rotation.z ** 2) > .97);
      assert.ok(s.position.x * direction < -1); assert.ok(s.kmh > 225);
    } finally { sim.dispose(); }
  }
});

test('reversing changes yaw response but not the actual front-wheel steering direction', () => {
  for (const direction of [-1, 1]) {
    const sim = createVehiclePhysics({ barriers: false });
    try {
      run(sim, 120); const s = run(sim, 180, { reverse: 1, steer: direction });
      assert.ok(s.speed < -1); assert.ok(yaw(s.rotation) * direction > .1);
      assert.ok(s.wheels[1].steering * direction < 0);
    } finally { sim.dispose(); }
  }
});

test('wheel roll follows forward/reverse distance with the correct +X axle sign', () => {
  for (const input of [{ throttle: 1 }, { reverse: 1 }]) {
    const sim = createVehiclePhysics({ barriers: false });
    const gt = createGT();
    try {
      const start = run(sim, 120), end = run(sim, 240, input);
      const travel = end.position.z - start.position.z;
      const angle = end.wheels[1].rotation - start.wheels[1].rotation;
      assert.ok(Math.abs(angle * GT_SPEC.wheelRadius - travel) < .3);
      applyWheelPose(gt.wheels, start.wheels, end.wheels, 1);
      assert.equal(gt.wheels[1].spin.rotation.x, end.wheels[1].rotation);
      const treadVelocity = new Vector3(Math.sign(angle), 0, 0).cross(new Vector3(0, -GT_SPEC.wheelRadius, 0));
      assert.ok(treadVelocity.z * travel < 0, 'bottom tread cancels forward body movement');
    } finally { sim.dispose(); disposeGT(gt); }
  }
});

test('wheel suspension, steering and unwrapped spin interpolate on the same clock as the body', () => {
  const gt = createGT();
  try {
    const before = Array.from({ length: 4 }, () => ({ y: .4, steering: .1, rotation: 6.2 }));
    const after = Array.from({ length: 4 }, () => ({ y: .46, steering: .2, rotation: 6.5 }));
    for (const alpha of [0, .25, .5, .75, 1]) {
      applyWheelPose(gt.wheels, before, after, alpha);
      gt.wheels.forEach(w => {
        assert.ok(Math.abs(w.pivot.position.y - (.4 + .06 * alpha)) < 1e-8);
        assert.ok(Math.abs(w.pivot.rotation.y - (.1 + .1 * alpha)) < 1e-8);
        assert.ok(Math.abs(w.spin.rotation.x - (6.2 + .3 * alpha)) < 1e-8);
        assert.equal(w.spin.parent, w.pivot, 'steer parent, rolling child');
        assert.equal(Math.abs(w.pivot.position.x), GT_SPEC.track / 2);
        assert.equal(Math.abs(w.pivot.position.z), GT_SPEC.wheelbase / 2);
      });
    }
  } finally { disposeGT(gt); }
});

test('reset clears steering, handbrake state and rear grip immediately', () => {
  const sim = createVehiclePhysics();
  try {
    run(sim, 120); run(sim, 240, { throttle: 1 }); run(sim, 50, { steer: 1, handbrake: true });
    sim.reset(); const s = sim.snapshot();
    assert.equal(s.drifting, false); assert.equal(s.steer, 0); assert.equal(s.steerInput, 0);
    assert.ok(s.wheels.every(w => w.steering === 0));
    assert.equal(sim.controller.wheelFrictionSlip(0), sim.controller.wheelFrictionSlip(1));
  } finally { sim.dispose(); }
});
