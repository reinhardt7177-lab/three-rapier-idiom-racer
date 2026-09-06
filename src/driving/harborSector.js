import * as THREE from 'three';
import { box, rod, mesh, canvasMap, concreteMap, randomSeed } from '../garage/procedural.js';
import { batchStaticMeshes } from '../garage/batchStatic.js';
import { HARBOR_SECTOR } from './harborSectorSpec.js';

export function createHarborSector() {
  const root = new THREE.Group(); root.name = 'harbor-road-art-slice';
  const textures = [], rng = randomSeed(70925), { start, end, wallX } = HARBOR_SECTOR;
  const material = (color, roughness = .88, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const masonry = ['#69756a', '#7c8574', '#929580', '#636f65'].map(c => material(c));
  const cream = material('#c5bea0'), steel = material('#263e39', .55, .45), rust = material('#9a6546', .65, .35);
  const teal = material('#3c665f', .7, .18), roof = material('#43544b', .8, .28), wood = material('#776e56');
  const tire = material('#252e2a'), glass = material('#354f50', .28, .28);
  const lamp = new THREE.MeshStandardMaterial({ color: '#ffeac0', emissive: '#ffe1a2', emissiveIntensity: 1.2, roughness: .5 });
  const concrete = concreteMap(); textures.push(concrete);
  const pavement = material('#a4a38e'); pavement.map = concrete;
  const transform = new THREE.Object3D();
  function instances(geometry, mat, entries, shadow = true) {
    const m = new THREE.InstancedMesh(geometry, mat, entries.length);
    entries.forEach((p, i) => { transform.position.set(p[0], p[1], p[2]); transform.rotation.set(0, p[3] || 0, 0); transform.scale.set(1, 1, 1); transform.updateMatrix(); m.setMatrixAt(i, transform.matrix); });
    m.castShadow = shadow; m.receiveShadow = true; root.add(m); return m;
  }
  const brickSets = masonry.map(() => []), paving = [], cap = [], curb = [], drains = [], drainBars = [], bolts = [], pillars = [];
  for (const side of [-1, 1]) {
    // Bed is continuous; individual stones give seams and depth without road bumps.
    box(root, [3.7, .14, end - start], masonry[0], [side * 12.6, .015, (start + end) / 2]);
    for (let z = start + .5; z < end; z += 1) {
      for (let lane = 0; lane < 3; lane++) paving.push([side * (11.2 + lane * 1.02), .102, z]);
      curb.push([side * 10.45, .075, z]);
    }
    for (let z = start + .4; z < end; z += .8) {
      for (let row = 0; row < 4; row++) {
        const bz = z + (row % 2 ? .35 : 0); if (bz + .38 <= end) brickSets[Math.floor(rng() * masonry.length)].push([side * wallX, .135 + row * .255, bz]);
      }
      cap.push([side * wallX, 1.045, z]);
    }
    for (let z = start + 3; z < end; z += 10) {
      drains.push([side * 10.82, .117, z]);
      for (let n = 0; n < 12; n++) drainBars.push([side * 10.82, .13, z - .79 + n * .145]);
      for (const dz of [-.88, .88]) bolts.push([side * 10.65, .132, z + dz]);
    }
    for (let z = start + 1; z < end; z += 8) pillars.push([side * wallX, .62, z]);
  }
  masonry.forEach((mat, i) => instances(new THREE.BoxGeometry(.88, .24, .77), mat, brickSets[i]));
  instances(new THREE.BoxGeometry(.98, .055, .96), pavement, paving, false);
  instances(new THREE.BoxGeometry(1.04, .11, .77), cream, cap);
  instances(new THREE.BoxGeometry(.38, .15, .96), cream, curb, false);
  instances(new THREE.BoxGeometry(.42, .015, 1.95), tire, drains, false);
  instances(new THREE.BoxGeometry(.38, .025, .045), steel, drainBars, false);
  instances(new THREE.BoxGeometry(.045, .024, .045), rust, bolts, false);
  instances(new THREE.BoxGeometry(1.12, 1.24, .4), steel, pillars);
  // Sea is visible immediately beyond the quay, not hidden under the old 102 m pad.
  const waterMap = canvasMap((ctx, s) => {
    ctx.fillStyle = '#4c807a'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 280; i++) { ctx.strokeStyle = `rgba(191,218,188,${.025 + rng() * .05})`; ctx.beginPath(); const x = rng() * s, y = rng() * s; ctx.moveTo(x, y); ctx.lineTo(x + 12 + rng() * 65, y + rng() * 2); ctx.stroke(); }
  });
  waterMap.wrapS = waterMap.wrapT = THREE.RepeatWrapping; waterMap.repeat.set(24, 20); textures.push(waterMap);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(500, end - start), new THREE.MeshStandardMaterial({ map: waterMap, color: '#94afa3', roughness: .38, metalness: .18 }));
  water.rotation.x = -Math.PI / 2; water.position.set(-266, -.17, (start + end) / 2); water.receiveShadow = true; root.add(water);
  box(root, [1.3, 1.5, end - start], masonry[0], [-15.6, -.6, (start + end) / 2]);

  // Sector lamps and exposed utility pipes share the garage's dark metal / copper.
  for (const side of [-1, 1]) for (let z = start + 10; z < end; z += 24) {
    const x = side * 13.8;
    box(root, [.5, .22, .5], cream, [x, .23, z]);
    rod(root, [x, .3, z], [x, 5.7, z], .085, steel);
    rod(root, [x, 5.5, z], [x - side * 1.25, 5.65, z], .06, steel);
    box(root, [1.1, .15, .34], steel, [x - side * .9, 5.65, z]);
    box(root, [.83, .035, .26], lamp, [x - side * .9, 5.55, z]);
    box(root, [.25, .45, .18], teal, [x, 1.15, z]);
    for (const dx of [-.16, .16]) for (const dz of [-.16, .16]) box(root, [.055, .04, .055], rust, [x + dx, .36, z + dz]);
  }
  // Small warehouse fronts sit outside the collision wall; road sight lines stay clear.
  for (let n = 0; n < 7; n++) {
    const building = new THREE.Group(), z = start + 24 + n * 52, height = n % 3 === 0 ? 7.5 : 6.4; root.add(building);
    box(building, [14, height, 28], masonry[(n + 1) % 4], [23.4, height / 2, z]);
    box(building, [.24, .55, 28.3], cream, [16.3, .36, z]);
    box(building, [.24, .27, 28.5], cream, [16.25, height - .12, z]);
    for (const zz of [-13.7, -7, 0, 7, 13.7]) {
      box(building, [.4, height, .32], steel, [16.1, height / 2, z + zz]);
      for (const yy of [2.1, 4.1]) box(building, [.47, .18, .4], rust, [16.0, yy, z + zz]);
    }
    for (const dz of [-7, 7]) {
      box(building, [.12, 3.7, 5.6], teal, [16.27, 2.05, z + dz]);
      for (let slat = 0; slat < 15; slat++) box(building, [.15, .045, 5.5], steel, [16.17, .3 + slat * .245, z + dz]);
      box(building, [.16, .17, 6], cream, [16.05, 4.04, z + dz]);
      box(building, [.2, .045, 4.7], lamp, [15.99, 4.2, z + dz]);
    }
    for (const dz of [-10.5, -3.5, 3.5, 10.5]) {
      box(building, [.15, 1.1, 2.3], glass, [16.23, height - 1.25, z + dz]);
      box(building, [.19, .045, 2.35], cream, [16.12, height - 1.25, z + dz]);
      box(building, [.19, 1.15, .055], cream, [16.12, height - 1.25, z + dz]);
    }
    for (const side of [-1, 1]) {
      const panel = box(building, [7.5, .16, 29.3], roof, [23.4 + side * 3.55, height + .65, z]); panel.rotation.z = -side * .18;
      for (let line = -14; line <= 14; line += .8) { const rib = box(building, [7.5, .08, .07], steel, [23.4 + side * 3.55, height + .78, z + line]); rib.rotation.z = -side * .18; }
    }
    rod(building, [15.94, .75, z - 13.5], [15.94, .75, z + 13.5], .065, rust);
    rod(building, [15.94, 1.1, z - 13.5], [15.94, 1.1, z + 13.5], .045, steel);
    const sign = canvasMap((ctx, s) => { ctx.fillStyle = '#28443d'; ctx.fillRect(0, 0, s, s); ctx.fillStyle = '#dfd5b3'; ctx.textAlign = 'center'; ctx.font = 'bold 90px sans-serif'; ctx.fillText(`BAY 0${n + 1}`, s / 2, s * .48); ctx.font = '26px sans-serif'; ctx.fillText('MUMU / HARBOR WORKS', s / 2, s * .65); }); textures.push(sign);
    const signMesh = mesh(building, new THREE.PlaneGeometry(3.4, 2.1), new THREE.MeshStandardMaterial({ map: sign, roughness: .9 }), 16.0, height - 1.5, z); signMesh.rotation.y = -Math.PI / 2;
    // Detail pockets at warehouse ends: pallet, drum, cable box and timber slats.
    for (let p = 0; p < 3; p++) {
      const dz = z + 16 + p * 1.3;
      box(building, [1.1, .2, 1], wood, [19, .2, dz]);
      box(building, [.9, .95, .9], p % 2 ? teal : wood, [19, .8, dz]);
      for (let j = 0; j < 4; j++) box(building, [.94, .035, .055], cream, [19, .45 + j * .2, dz - .46]);
    }
    const drum = mesh(building, new THREE.CylinderGeometry(.37, .37, 1.05, 12), rust, 17.5, .64, z + 16);
    drum.name = 'service-drum';
    batchStaticMeshes(building);
  }
  // Quay mooring rings and fenders are beyond the wall, not obstacles in the lane.
  for (let z = start + 14; z < end; z += 32) {
    for (const dz of [-.3, .3]) rod(root, [-16.3, .05, z + dz], [-16.3, .5, z + dz], .11, steel);
    rod(root, [-16.3, .45, z - .55], [-16.3, .45, z + .55], .13, steel);
    const fender = mesh(root, new THREE.TorusGeometry(.42, .12, 6, 14), tire, -16.29, -.03, z); fender.rotation.y = Math.PI / 2;
  }
  // A low, distant crane makes the water side identifiable without a new theme.
  for (const z of [-665, -470]) {
    for (const x of [-65, -71]) { rod(root, [x, -.2, z], [x, 15, z], .16, steel); }
    for (let y = 1; y < 15; y += 2) { rod(root, [-65, y, z], [-71, y + 2, z], .09, cream); rod(root, [-71, y, z], [-65, y + 2, z], .09, cream); }
    rod(root, [-74, 15, z], [-44, 15, z], .19, rust); rod(root, [-71, 18, z], [-44, 15, z], .07, cream);
    rod(root, [-47, 15, z], [-47, 6, z], .035, steel);
    box(root, [25, .6, 12], masonry[0], [-68, -.1, z]);
  }
  // Fine repairs and worn service markings are local decals, never moving scenery.
  const wear = canvasMap((ctx, s) => {
    ctx.clearRect(0, 0, s, s); ctx.strokeStyle = '#171f195c'; ctx.lineWidth = 2;
    for (let k = 0; k < 7; k++) { ctx.beginPath(); let x = rng() * s, y = rng() * s; ctx.moveTo(x, y); for (let j = 0; j < 8; j++) { x += (rng() - .5) * 40; y += 12 + rng() * 30; ctx.lineTo(x, y); } ctx.stroke(); }
  }); textures.push(wear);
  const wearMat = new THREE.MeshStandardMaterial({ map: wear, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 });
  for (let z = start + 8; z < end; z += 18) { const mark = mesh(root, new THREE.PlaneGeometry(3.8, 6), wearMat, (rng() - .5) * 13, .024, z); mark.rotation.x = -Math.PI / 2; mark.castShadow = false; }
  batchStaticMeshes(root);
  return { root, update(dt, motion) { if (motion) waterMap.offset.x += dt * .003; }, dispose() { textures.forEach(t => t.dispose()); } };
}
