import * as THREE from 'three';
import { box, mesh, rod, canvasMap, concreteMap, randomSeed } from '../garage/procedural.js';
import { batchStaticMeshes } from '../garage/batchStatic.js';
import { createHarborSector } from './harborSector.js';
import { createPublicRoad } from './publicRoad.js';
import { createRoadDetails } from './roadDetails.js';
import { COAST_ROADS, COAST_PADS, COAST_BARRIERS, ribbonData, padData, offsetPoint, nearestRoad, FORK } from './coastRoute.js';

export function createCoastWorld() {
  const root = new THREE.Group(); root.name = 'coastal-public-road-network';
  const textures = [], rng = randomSeed(9626);
  const mat = (color, roughness = .9, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const stone = mat('#8e9582'), cream = mat('#d0c5a3'), steel = mat('#33483f', .65, .45), copper = mat('#8e664e', .7, .3), green = mat('#657563');
  const land = mat('#566953'), white = mat('#e5dec3'), yellow = mat('#cdb575'), shoulder = mat('#8d9180'), asphalt = mat('#515a53');
  const generated = createRoadDetails(); asphalt.map = generated.texture; asphalt.map.repeat.set(1, 1);
  // The old straight detail meshes are not part of this curved scene.
  generated.root.traverse(o => { o.geometry?.dispose(); if (o.material) o.material.dispose(); });
  const concrete = concreteMap(); textures.push(concrete); stone.map = concrete;
  const harbor = createHarborSector(); root.add(harbor.root);
  const publicRoad = createPublicRoad({ harborOnly: true }); root.add(publicRoad.root);
  function surface(data, material, name) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(data.vertices, 3)); g.setAttribute('uv', new THREE.BufferAttribute(data.uv, 2)); g.setIndex(new THREE.BufferAttribute(data.indices, 1)); g.computeVertexNormals();
    const m = mesh(root, g, material); m.name = name; m.castShadow = false; return m;
  }
  const seaMap = canvasMap((ctx, s) => { ctx.fillStyle = '#4c8078'; ctx.fillRect(0, 0, s, s); for (let i = 0; i < 320; i++) { ctx.fillStyle = '#c0cdae12'; ctx.fillRect(rng() * s, rng() * s, 8 + rng() * 55, .6); } });
  seaMap.wrapS = seaMap.wrapT = THREE.RepeatWrapping; seaMap.repeat.set(80, 80); textures.push(seaMap);
  const water = mesh(root, new THREE.PlaneGeometry(2800, 2800), new THREE.MeshStandardMaterial({ map: seaMap, roughness: .4, metalness: .12 }), -350, -.2, -100); water.rotation.x = -Math.PI / 2; water.castShadow = false;
  for (const [id, points] of Object.entries(COAST_ROADS)) {
    // Inland terrain is a shaped ribbon, not the old enormous flat runway.
    surface(ribbonData(points, p => -(id === 'harbor' && p.s < 420 ? 150 : 75), p => p.halfWidth + 17, -.06), land, 'coastal-land');
    surface(ribbonData(points, p => -p.halfWidth - 2.5, p => p.halfWidth + 2.5), shoulder, 'physical-road-shoulder');
    surface(ribbonData(points, p => -p.halfWidth, p => p.halfWidth, .012), asphalt, 'asphalt-ribbon');
    const paintPoints = points.filter(p => !(id !== 'harbor' && p.s < 40) && !COAST_PADS.some(pad => Math.hypot(p.x - pad.x, p.z - pad.z) < pad.radius - 6));
    for (const side of [-1, 1]) {
      surface(ribbonData(paintPoints, () => side * .18 - .055, () => side * .18 + .055, .03), yellow, 'centre-line');
      surface(ribbonData(paintPoints, p => side * (p.halfWidth - .2) - .06, p => side * (p.halfWidth - .2) + .06, .03), white, 'road-edge-line');
    }
    if (id === 'harbor') for (let i = 0; i < points.length - 1; i += 4) {
      const p = points[i]; if (p.s > 550) break;
      for (const side of [-1, 1]) { const q = offsetPoint(p, side * 5); const dash = box(root, [.12, .012, 3], white, [q.x, .03, q.z]); dash.rotation.y = Math.atan2(p.tx, p.tz); }
    }
  }
  for (const pad of COAST_PADS) { surface(padData(pad, 5, -.06), land, 'turnaround-land'); surface(padData(pad), shoulder, 'turnaround-collider-surface'); surface(padData(pad, -.4, .017), asphalt, 'turnaround-asphalt'); }
  // Each instance has exactly the dimensions/orientation used by the physics box.
  const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), steel, COAST_BARRIERS.length);
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(.2, 1.1, .2), stone, COAST_BARRIERS.length);
  const reflectors = new THREE.InstancedMesh(new THREE.BoxGeometry(.45, .14, .12), cream, COAST_BARRIERS.length);
  const dummy = new THREE.Object3D();
  COAST_BARRIERS.forEach((b, i) => {
    dummy.position.set(b.x, .85, b.z); dummy.rotation.y = b.yaw; dummy.scale.set(b.hx * 2, .5, b.hz * 2); dummy.updateMatrix(); rails.setMatrixAt(i, dummy.matrix);
    dummy.position.y = .55; dummy.scale.set(1, 1, 1); dummy.updateMatrix(); posts.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 1.08; dummy.updateMatrix(); reflectors.setMatrixAt(i, dummy.matrix);
  });
  for (const m of [rails, posts, reflectors]) { m.castShadow = true; m.receiveShadow = true; root.add(m); }
  function sign(point, heading, title, subtitle, arrow = '') {
    const texture = canvasMap((ctx, s) => { ctx.fillStyle = '#284d43'; ctx.fillRect(0, 0, s, s); ctx.strokeStyle = '#ddd1ad'; ctx.lineWidth = 6; ctx.strokeRect(15, 15, s - 30, s - 30); ctx.textAlign = 'center'; ctx.fillStyle = '#f1e5c6'; ctx.font = 'bold 59px sans-serif'; ctx.fillText(title, s / 2, s * .4); ctx.font = '28px sans-serif'; ctx.fillText(subtitle, s / 2, s * .58); ctx.font = '85px sans-serif'; ctx.fillText(arrow, s / 2, s * .83); }); textures.push(texture);
    box(root, [.15, 3.9, .15], steel, [point.x, 1.9, point.z]);
    const panel = mesh(root, new THREE.PlaneGeometry(3.2, 2.8), new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, roughness: .85 }), point.x, 3.25, point.z); panel.rotation.y = heading + Math.PI;
  }
  function routeSign(id, s, title, subtitle, arrow, reverse = false) {
    const p = COAST_ROADS[id].reduce((a, b) => Math.abs(b.s - s) < Math.abs(a.s - s) ? b : a);
    sign(offsetPoint(p, (reverse ? -1 : 1) * (p.halfWidth + 4.5)), Math.atan2(p.tx, p.tz) + (reverse ? Math.PI : 0), title, subtitle, arrow);
  }
  routeSign('harbor', 445, '해안 굽잇길', '왕복 2차로 · 감속 60', '↱');
  routeSign('harbor', 560, '바람곶 해안길', '전방 굽은 길 · 60', '↰');
  routeSign('harbor', COAST_ROADS.harbor.at(-1).s - 95, '해안 갈림길', '전망대 →    ← 회차 쉼터', '↗  ↖');
  routeSign('lookout', 100, '바람곶 전망대', '회차장 · 천천히 진입', '↑');
  routeSign('rest', 90, '솔숲 쉼터', '막다른 길 · 회차 가능', '↑');
  routeSign('lookout', 55, '항구 정비소', '갈림길에서 항만대로', '↑', true);
  routeSign('rest', 55, '항구 정비소', '갈림길에서 항만대로', '↑', true);
  routeSign('harbor', 560, '항구 정비소', '항만대로 · 400 m', '↑', true);
  // Repeated human-scale roadside details: drain slots, masonry bases and bolts.
  // Batched below; these stay below/behind the existing collider line.
  for (let i = 0; i < COAST_BARRIERS.length; i += 5) {
    const b = COAST_BARRIERS[i], pocket = new THREE.Group(); root.add(pocket); pocket.position.set(b.x, 0, b.z); pocket.rotation.y = b.yaw;
    box(pocket, [.55, .22, 1.8], stone, [0, .11, 0]);
    for (const z of [-.6, .6]) { box(pocket, [.48, .05, .06], copper, [0, .59, z]); box(pocket, [.05, .1, .1], cream, [.235, .92, z]); }
  }

  // Clear sightlines: rocks and vegetation start beyond shoulder/guardrail.
  const rocks = [], trunks = [], crowns = [];
  for (const points of Object.values(COAST_ROADS)) for (let i = 0; i < points.length; i += 6) {
    const p = points[i]; if (p.id === 'harbor' && p.s < 455) continue;
    for (const side of [-1, 1]) {
      const d = side * (p.halfWidth + 9 + rng() * 16), q = offsetPoint(p, d), near = nearestRoad(q);
      if (near.distance < near.halfWidth + 7 || Math.hypot(q.x - FORK.x, q.z - FORK.z) < 48 || COAST_PADS.some(pad => Math.hypot(q.x - pad.x, q.z - pad.z) < pad.radius + 8)) continue;
      rocks.push([q.x, -.1, q.z, 2 + rng() * 4, 1 + rng() * 2, 2 + rng() * 3, rng() * 6]);
      if (side < 0 && i % 12 === 0) { trunks.push([q.x, 1.9, q.z, 1, 1, 1, 0]); crowns.push([q.x, 4.4, q.z, 1.1 + rng(), 1.1, 1.1 + rng(), rng() * 6]); }
    }
  }
  function instances(geometry, material, entries) {
    const m = new THREE.InstancedMesh(geometry, material, entries.length);
    entries.forEach((p, i) => { dummy.position.set(p[0], p[1], p[2]); dummy.scale.set(p[3], p[4], p[5]); dummy.rotation.y = p[6]; dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); });
    m.castShadow = true; m.receiveShadow = true; root.add(m);
  }
  instances(new THREE.DodecahedronGeometry(1, 0), stone, rocks);
  instances(new THREE.CylinderGeometry(.22, .35, 3.8, 7), copper, trunks);
  instances(new THREE.IcosahedronGeometry(2, 0), green, crowns);
  const leaves = crowns.flatMap(p => [[p[0] + 1.2, p[1] - .7, p[2] + .7, p[3] * .64, .8, p[5] * .64, p[6]], [p[0] - 1.1, p[1] - .4, p[2] - .5, p[3] * .7, .75, p[5] * .7, p[6]]]);
  instances(new THREE.IcosahedronGeometry(2, 0), mat('#526b54'), leaves);
  // Human-scale lookout: tiled viewing deck, brass rail, benches and a small beacon.
  const pad = COAST_PADS[0], deckX = pad.x - 11, deckZ = pad.z + 34;
  box(root, [25, .6, 9], stone, [deckX, -.2, deckZ]);
  for (let x = -11; x <= 11; x += 2) for (let z = -3; z <= 3; z += 2) box(root, [1.96, .07, 1.96], cream, [deckX + x, .13, deckZ + z]);
  for (let x = -12; x <= 12; x += 3) rod(root, [deckX + x, .1, deckZ + 4], [deckX + x, 1.3, deckZ + 4], .07, steel);
  rod(root, [deckX - 12, 1.3, deckZ + 4], [deckX + 12, 1.3, deckZ + 4], .075, copper);
  for (const x of [-7, 5]) { box(root, [3, .16, .7], copper, [deckX + x, .65, deckZ]); for (const dx of [-1, 1]) box(root, [.15, .55, .55], steel, [deckX + x + dx, .3, deckZ]); }
  sign({ x: pad.x + 8, z: pad.z + 24 }, Math.PI, '바람곶 전망대', '천천히 회차 · 항구로 돌아가기', '↶');
  for (let row = 0; row < 5; row++) box(root, [2.8 - row * .2, .65, 2.8 - row * .2], row % 2 ? cream : stone, [pad.x - 29, .4 + row * .65, pad.z + 24]);
  mesh(root, new THREE.CylinderGeometry(1.1, 1.1, 1.5, 10), steel, pad.x - 29, 4.2, pad.z + 24);
  const glass = new THREE.MeshStandardMaterial({ color: '#e1ca86', emissive: '#c5a158', emissiveIntensity: .35, roughness: .45 });
  mesh(root, new THREE.CylinderGeometry(.78, .78, .85, 10), glass, pad.x - 29, 4.25, pad.z + 24);
  mesh(root, new THREE.ConeGeometry(1.4, .8, 10), steel, pad.x - 29, 5.3, pad.z + 24);
  // Quiet inland alternative uses the same materials, no new visual theme.
  const rest = COAST_PADS[1];
  for (const dz of [-7, 7]) { box(root, [4, .2, 1.2], copper, [rest.x + 14, .8, rest.z + dz]); box(root, [.3, .7, 1], steel, [rest.x + 14, .35, rest.z + dz]); }
  sign({ x: rest.x + 17, z: rest.z + 18 }, 0, '솔숲 쉼터', '길 끝 회차장 · 항구 방면 되돌아가기', '↶');
  batchStaticMeshes(root);
  return { root, update(dt, motion) { harbor.update(dt, motion); if (motion) seaMap.offset.x += dt * .001; }, dispose() { harbor.dispose(); publicRoad.dispose(); generated.texture.dispose(); textures.forEach(t => t.dispose()); } };
}
