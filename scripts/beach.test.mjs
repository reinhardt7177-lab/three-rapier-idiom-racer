import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { coastPalmLayout, beachPropClear } from '../src/driving/beachLayout.js';
import { COAST_START, COAST_ROADS, COAST_PADS, FORK } from '../src/driving/coastRoute.js';
import { createPalms, createPalmFrond, createBeachSky } from '../src/scenery/beachScenery.js';
import { BEACH } from '../src/scenery/beachPalette.js';

test('beach scenery is deterministic and clears roads, junction and turn pads', () => {
  const palms = coastPalmLayout();
  assert.deepEqual(palms, coastPalmLayout());
  assert.ok(palms.length > 25 && palms.length < 150);
  for (const p of palms) { assert.ok(beachPropClear(p, 5)); assert.ok(p.height >= 7 && p.height < 10); }
  for (const p of [COAST_START, FORK, ...COAST_PADS, COAST_ROADS.harbor[100]]) assert.equal(beachPropClear(p), false);
});

test('palms keep finite fronds and four instanced meshes without per-tree draws', () => {
  const frond = createPalmFrond();
  for (const value of frond.attributes.position.array) assert.ok(Number.isFinite(value));
  frond.computeBoundingBox(); assert.ok(frond.boundingBox.max.x < 4.3);
  const palms = createPalms(coastPalmLayout());
  assert.equal(palms.children.length, 4);
  const matrix = new THREE.Matrix4();
  for (const m of palms.children) {
    assert.ok(m.isInstancedMesh && m.castShadow);
    for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, matrix); assert.ok(matrix.elements.every(Number.isFinite)); }
  }
  assert.equal(createPalms([]).children.length, 0);
  const geometries = new Set(palms.children.map(m => m.geometry)); geometries.forEach(g => g.dispose()); palms.children.forEach(m => m.material.dispose()); frond.dispose();
});

test('daylight sky does not write depth and paint retains contrast against road', () => {
  const sky = createBeachSky();
  assert.equal(sky.material.depthWrite, false); assert.equal(sky.material.toneMapped, false); assert.equal(sky.material.side, THREE.BackSide);
  const luminance = hex => { const c = new THREE.Color(hex); return .2126 * c.r + .7152 * c.g + .0722 * c.b; };
  assert.ok((luminance(BEACH.white) + .05) / (luminance(BEACH.asphalt) + .05) > 5);
  assert.ok((luminance(BEACH.yellow) + .05) / (luminance(BEACH.asphalt) + .05) > 4);
  // Material colors only; final lit screen visibility is checked in screenshots.
  sky.geometry.dispose(); sky.material.dispose();
});
