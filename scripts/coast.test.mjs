import test from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics, createVehiclePhysics, STEP } from '../src/driving/physics.js';
import { COAST_ROADS, COAST_SURFACES, COAST_BARRIERS, COAST_PADS, COAST_START, nearestRoad, offsetPoint, tourWaypoints, coastStatus, coastMapPoint } from '../src/driving/coastRoute.js';
await initPhysics();
test('route has continuous samples, broad curves and physically usable widths', () => {
  for (const points of Object.values(COAST_ROADS)) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], d = Math.hypot(b.x - a.x, b.z - a.z);
      assert.ok(d > .01 && d < 3.1); assert.ok(b.halfWidth >= 6 && b.halfWidth <= 10);
      const angle = Math.acos(Math.max(-1, Math.min(1, a.tx * b.tx + a.tz * b.tz)));
      assert.ok(angle < .09, `sharp sample ${b.id} ${b.s}`);
      assert.ok(d / Math.max(angle, 1e-9) > 28, 'minimum design bend radius');
    }
  }
  assert.deepEqual([COAST_ROADS.lookout[0].x, COAST_ROADS.lookout[0].z], [COAST_ROADS.harbor.at(-1).x, COAST_ROADS.harbor.at(-1).z]);
  assert.deepEqual([COAST_ROADS.rest[0].x, COAST_ROADS.rest[0].z], [COAST_ROADS.harbor.at(-1).x, COAST_ROADS.harbor.at(-1).z]);
});
test('road triangles point upwards and are finite; no old straight-world wall crosses the route', () => {
  for (const { vertices: v, indices } of COAST_SURFACES) {
    assert.ok([...v].every(Number.isFinite));
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = [indices[i] * 3, indices[i + 1] * 3, indices[i + 2] * 3];
      const up = (v[b + 2] - v[a + 2]) * (v[c] - v[a]) - (v[b] - v[a]) * (v[c + 2] - v[a + 2]);
      assert.ok(up > 0, 'upward nondegenerate road face');
    }
  }
  for (const b of COAST_BARRIERS) { const n = nearestRoad(b); assert.ok(n.distance > n.halfWidth + 1.8, `rail crosses lane ${JSON.stringify(b)}`); }
});
test('wheel contact is valid along every branch, both lanes, junction and turn pads', () => {
  const sim = createVehiclePhysics({ coast: true, harbor: true, start: COAST_START });
  try {
    for (const points of Object.values(COAST_ROADS)) for (let i = 8; i < points.length; i += 23) for (const side of [-1, 1]) {
      const p = points[i], q = offsetPoint(p, side * 3.5);
      sim.reset({ ...q, y: .8 }, Math.atan2(p.tx, p.tz)); let s;
      for (let j = 0; j < 120; j++) s = sim.step();
      assert.equal(s.contacts, 4, `contact ${p.id} ${p.s} ${side}`); assert.ok(s.position.y > .3);
    }
    for (const p of COAST_PADS) { sim.reset({ x: p.x, y: .8, z: p.z }); let s; for (let i = 0; i < 120; i++) s = sim.step(); assert.equal(s.contacts, 4); }
  } finally { sim.dispose(); }
});
test('continuous real-physics round trips reach both endpoints and return, without transform writes', () => {
  for (const branch of ['lookout', 'rest']) {
    const path = tourWaypoints(branch), sim = createVehiclePhysics({ coast: true, harbor: true, start: COAST_START });
    let index = 0, maxDeviation = 0, minUp = 1, steps = 0, touchedEnd = false;
    try {
      for (; steps < 120 * 320 && index < path.length - 1; steps++) {
        const s = sim.snapshot(), p = s.position;
        while (index < path.length - 1 && Math.hypot(path[index].x - p.x, path[index].z - p.z) < 4) index++;
        let targetIndex = index, accumulated = 0;
        const lookahead = 6 + s.kmh / 3.6 * .3;
        while (targetIndex < path.length - 1 && accumulated < lookahead) { accumulated += Math.hypot(path[targetIndex + 1].x - path[targetIndex].x, path[targetIndex + 1].z - path[targetIndex].z); targetIndex++; }
        const target = path[targetIndex], q = s.rotation;
        const yaw = Math.atan2(2 * (q.x * q.z + q.w * q.y), 1 - 2 * (q.x * q.x + q.y * q.y));
        const heading = Math.atan2(target.x - p.x, target.z - p.z), error = Math.atan2(Math.sin(heading - yaw), Math.cos(heading - yaw));
        const steeringLimit = s.steeringLimit;
        const desired = Math.atan(2 * 2.84 * Math.sin(error) / Math.max(3, Math.hypot(target.x - p.x, target.z - p.z)));
        const speed = Math.min(path[index].speed, target.speed);
        const result = sim.step({ steer: Math.max(-1, Math.min(1, -desired / steeringLimit)), throttle: s.kmh < speed ? .55 : 0, brake: s.kmh > speed + 2 ? .3 : 0 });
        const near = nearestRoad(result.position), atPad = COAST_PADS.some(pad => Math.hypot(pad.x - p.x, pad.z - p.z) < pad.radius);
        if (!atPad) maxDeviation = Math.max(maxDeviation, near.distance);
        minUp = Math.min(minUp, 1 - 2 * (result.rotation.x ** 2 + result.rotation.z ** 2));
        if (Math.hypot(COAST_ROADS[branch].at(-1).x - p.x, COAST_ROADS[branch].at(-1).z - p.z) < 20) touchedEnd = true;
        assert.ok(result.position.y > .2, `fell through surface: ${branch} ${index} ${JSON.stringify(result.position)}`);
      }
      const last = sim.snapshot();
      console.log(JSON.stringify({ branch, seconds: +(steps * STEP).toFixed(1), index, total: path.length, maxDeviation: +maxDeviation.toFixed(2), minUp: +minUp.toFixed(3), end: last.position }));
      assert.ok(touchedEnd); assert.ok(index >= path.length - 2, `route incomplete: ${branch} ${index}/${path.length}`);
      assert.ok(Math.hypot(last.position.x - COAST_START.x, last.position.z - COAST_START.z) < 20);
      assert.ok(maxDeviation < 6, 'stays inside asphalt on curves'); assert.ok(minUp > .97);
    } finally { sim.dispose(); }
  }
});
test('lookout/return require stopped contact and preserve visit state; wrong fork is not lookout', () => {
  const s = (p, kmh = 0) => ({ position: p, contacts: 4, kmh });
  assert.equal(coastStatus(s(COAST_PADS[1])).lookout, false);
  assert.equal(coastStatus(s(COAST_PADS[0], 40)).lookout, false);
  const visit = coastStatus(s(COAST_PADS[0])); assert.equal(visit.lookout, true); assert.equal(visit.returned, false);
  assert.equal(coastStatus(s(COAST_START), visit).returned, true);
});
test('orientation of map agrees with driver-right at the harbor and lookout branch', () => {
  assert.ok(coastMapPoint({ x: -10, z: -720 }).x > coastMapPoint({ x: 0, z: -720 }).x);
  assert.ok(coastMapPoint(COAST_PADS[0]).x > coastMapPoint(COAST_PADS[1]).x);
});
test('curved-road guardrail stops a real lateral impact; no invisible old x=51 wall', () => {
  const b = COAST_BARRIERS.find(b => b.z > -250 && b.z < -220), near = nearestRoad(b);
  const dx = (b.x - near.x) / near.distance, dz = (b.z - near.z) / near.distance;
  const sim = createVehiclePhysics({ coast: true, harbor: true, start: { x: b.x - dx * 6, y: .8, z: b.z - dz * 6 } });
  try {
    sim.reset({ x: b.x - dx * 6, y: .8, z: b.z - dz * 6 }, Math.atan2(dx, dz));
    for (let i = 0; i < 120; i++) sim.step();
    sim.body.setLinvel({ x: dx * 32, y: 0, z: dz * 32 }, true);
    let s; for (let i = 0; i < 80; i++) s = sim.step();
    assert.ok((s.position.x - b.x) * dx + (s.position.z - b.z) * dz < .3, JSON.stringify(s.position));
    assert.ok(s.kmh < 55);
  } finally { sim.dispose(); }
});
