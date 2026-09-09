import test from 'node:test';
import assert from 'node:assert/strict';
import { newJourney, continueJourney, updateJourney, journeyLocked, journeyHint, interruptJourney, JOURNEY_GATES, JOURNEY_HOME, saveJourney, loadJourney, JOURNEY_KEY } from '../src/driving/journey.js';
import { COAST_PADS, nearestRoad } from '../src/driving/coastRoute.js';
import { SIGNAL_STATION } from '../src/driving/journey.js';
const snapshot = (position, kmh = 0, contacts = 4) => ({ position: { y: .6, ...position }, kmh, contacts });
function cross(j, g, direction = 1) {
  return updateJourney(j, snapshot({ x: g.x - g.tx * direction, z: g.z - g.tz * direction }, 40), snapshot({ x: g.x + g.tx * direction, z: g.z + g.tz * direction }, 40), 1 / 120);
}
function stop(j, p, seconds = 2.1, speed = 0, contacts = 4) { for (let i = 0; i < seconds * 120; i++) j = updateJourney(j, snapshot(p, speed, contacts), snapshot(p, speed, contacts), 1 / 120); return j; }
test('briefing and signal are explicit locked transitions; no driving during a scene', () => {
  const j = newJourney(); assert.ok(journeyLocked(j)); assert.equal(stop(j, COAST_PADS[0]), j);
  assert.equal(continueJourney(j).phase, 'outbound'); assert.equal(continueJourney(continueJourney(j)).phase, 'outbound');
});
test('complete outbound, stop, signal acknowledgement, reverse gates and home stop', () => {
  let j = continueJourney(newJourney()); for (const g of JOURNEY_GATES) j = cross(j, g);
  j = stop(j, COAST_PADS[0]); assert.equal(j.phase, 'signal');
  assert.equal(stop(j, JOURNEY_HOME).phase, 'signal');
  j = continueJourney(j); for (const g of [...JOURNEY_GATES].reverse()) j = cross(j, g, -1);
  j = stop(j, JOURNEY_HOME); assert.equal(j.phase, 'complete'); assert.ok(j.elapsed > 4); assert.ok(j.distance > 0);
});
test('wrong order, wrong direction, off-road and teleport do not grant a gate', () => {
  const j = continueJourney(newJourney()), g = JOURNEY_GATES[0];
  assert.equal(cross(j, JOURNEY_GATES[1]).gate, 0); assert.equal(cross(j, g, -1).gate, 0);
  assert.equal(cross(j, { ...g, x: g.x + 40 }).gate, 0);
  assert.equal(updateJourney(j, snapshot({ x: g.x, z: g.z - 100 }), snapshot({ x: g.x, z: g.z + 1 }), 1 / 120).gate, 0);
  assert.equal(stop(j, COAST_PADS[0]).phase, 'outbound');
});
test('two continuous grounded seconds required; recovery clears partial hold', () => {
  let j = { ...continueJourney(newJourney()), gate: 3 };
  assert.equal(stop(j, COAST_PADS[0], 3, 2).phase, 'outbound');
  assert.equal(stop(j, COAST_PADS[0], 3, 0, 2).phase, 'outbound');
  j = stop(j, COAST_PADS[0], 1); assert.ok(j.hold > .9);
  j = interruptJourney(j); assert.equal(j.hold, 0); assert.equal(stop(j, COAST_PADS[0], 1).phase, 'outbound');
  assert.equal(updateJourney(j, snapshot(COAST_PADS[0]), snapshot(COAST_PADS[0]), 100).phase, 'outbound');
});
test('return cannot be completed by resetting to the harbor; wrong branch gives recovery guidance', () => {
  const j = { ...continueJourney(newJourney()), phase: 'return' };
  assert.equal(stop(j, JOURNEY_HOME, 5).phase, 'return');
  assert.match(journeyHint(continueJourney(newJourney()), snapshot(COAST_PADS[1])).objective, /솔숲/);
});
test('completion storage is scoped, validated, and failures do not throw', () => {
  const m = new Map([['user-save', 'keep']]), storage = { getItem: k => m.get(k), setItem: (k, v) => m.set(k, v) };
  assert.equal(loadJourney(storage), false); assert.equal(saveJourney(storage), true); assert.equal(loadJourney(storage), true); assert.equal(m.get('user-save'), 'keep');
  m.set(JOURNEY_KEY, '{bad'); assert.equal(loadJourney(storage), false);
  assert.equal(saveJourney({ setItem() { throw Error('blocked'); } }), false); assert.equal(loadJourney(null), false);
});
test('journey storage preserves other-version and route-tagged records and refuses unreadable storage', () => {
  for (const changed of [{ version: 2 }, { version: 0 }, { route: 'future-route' }]) {
    const raw = JSON.stringify({ version: 1, signalRunComplete: true, ...changed, progress: ['keep'] });
    let stored = raw, writes = 0;
    const storage = { getItem: () => stored, setItem(key, value) { stored = value; writes++; } };
    assert.equal(loadJourney(storage), false);
    assert.equal(saveJourney(storage), false);
    assert.equal(stored, raw);
    assert.equal(writes, 0);
  }
  let writes = 0;
  const unreadable = { getItem() { throw Error('read denied'); }, setItem() { writes++; } };
  assert.equal(saveJourney(unreadable), false);
  assert.equal(writes, 0);
});
test('journey save success requires read-back and preserves an existing completed record without rewriting', () => {
  const silent = { getItem: () => null, setItem() {} };
  assert.equal(saveJourney(silent), false);
  let reads = 0;
  const unreadableAfterWrite = { getItem() { if (reads++) throw Error('read-back denied'); return null; }, setItem() {} };
  assert.equal(saveJourney(unreadableAfterWrite), false);
  const raw = JSON.stringify({ version: 1, signalRunComplete: true, note: 'keep' });
  let writes = 0;
  const completed = { getItem: () => raw, setItem() { writes++; throw Error('write denied'); } };
  assert.equal(saveJourney(completed), true);
  assert.equal(writes, 0);
  assert.equal(completed.getItem(JOURNEY_KEY), raw);
});
test('signal station platform clears road shoulders and the drivable turnaround', () => {
  for (let x = -7.7; x <= 7.7; x += .7) for (let z = -6.7; z <= 6.7; z += .7) {
    const p = { x: SIGNAL_STATION.x + x, z: SIGNAL_STATION.z + z }, near = nearestRoad(p);
    assert.ok(near.distance > near.halfWidth + 4, 'platform overlaps road/rail');
    assert.ok(Math.hypot(p.x - COAST_PADS[0].x, p.z - COAST_PADS[0].z) > COAST_PADS[0].radius + 1, 'platform overlaps turning area');
  }
});
