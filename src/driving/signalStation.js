import * as THREE from 'three';
import { box, mesh, rod, canvasMap, randomSeed } from '../garage/procedural.js';
import { batchStaticMeshes } from '../garage/batchStatic.js';
import { SIGNAL_STATION, JOURNEY_HOME } from './journey.js';

// All solid props stay behind the existing turnaround guardrail, not on the course.
export function createSignalStation() {
  const root = new THREE.Group(), building = new THREE.Group(), textures = [];
  root.name = 'old-coastal-signal-station'; root.add(building);
  building.position.set(SIGNAL_STATION.x, 0, SIGNAL_STATION.z);
  const rng = randomSeed(1703);
  const mat = (color, roughness = .85, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const stones = ['#727d6c', '#87907a', '#939980', '#7b8671'].map(c => mat(c));
  const cream = mat('#c8c2a1'), dark = mat('#263d36', .65, .35), copper = mat('#a07850', .5, .45), wood = mat('#695943');
  const lamp = new THREE.MeshStandardMaterial({ color: '#f0ddaa', emissive: '#e7ba68', emissiveIntensity: .55 });
  box(building, [15, 2.6, 13], stones[0], [0, -1.1, 0]);
  box(building, [15.4, .2, 13.4], cream, [0, .06, 0]);
  for (let x = -6; x <= 6; x += 1.5) for (let z = -5; z <= 5; z += 1.5) box(building, [1.46, .06, 1.46], stones[Math.floor(rng() * 4)], [x, .11, z]);
  // The front faces west, toward arriving cars and the viewing court.
  for (let row = 0; row < 10; row++) for (let col = 0; col < 8; col++) {
    const z = -3.5 + col + (row % 2) * .2;
    if (!(z > -1.7 && z < 1.7 && row < 7)) box(building, [.65, .46, .96], stones[(row + col) % 4], [-3, .45 + row * .48, z]);
    box(building, [.65, .46, .96], stones[(row + col + 1) % 4], [3, .45 + row * .48, z]);
  }
  for (const z of [-4.2, 4.2]) for (let row = 0; row < 10; row++) for (let x = -2.5; x <= 2.5; x++) box(building, [.96, .46, .65], stones[(row + Math.round(x + 2.5)) % 4], [x, .45 + row * .48, z]);
  for (const x of [-3.5, 3.5]) for (const z of [-4.4, 4.4]) {
    box(building, [.35, 5.5, .35], dark, [x, 2.7, z]); box(building, [.9, .3, .9], cream, [x, 5.35, z]);
  }
  box(building, [7.8, .24, 9.8], dark, [0, 5.05, 0]);
  for (let z = -4.5; z <= 4.5; z += .6) box(building, [7.5, .08, .47], stones[1], [0, 5.22, z]);
  box(building, [.15, 3.3, 2.7], dark, [-3.05, 1.85, 0]);
  for (let z = -1.1; z <= 1.1; z += .3) box(building, [.18, 2.4, .1], copper, [-3.18, 2.05, z]);
  box(building, [2.7, .14, 4], dark, [-4.1, 3.8, 0]);
  for (const z of [-1.7, 1.7]) rod(building, [-5.1, .1, z], [-5.1, 3.8, z], .07, copper);
  for (const z of [-3, 3]) {
    rod(building, [-3.5, .2, z], [-3.5, 4.7, z], .07, copper);
    box(building, [.3, .7, .5], dark, [-3.6, 3.1, z]); box(building, [.33, .46, .3], lamp, [-3.78, 3.1, z]);
  }
  rod(building, [-3.5, 4.5, -3], [-3.5, 4.5, 3], .065, copper);
  // Service hatch, meter, cable, stacked boxes and a workbench: garage vocabulary.
  box(building, [1.1, 1.4, .7], dark, [-4.2, .9, 3.6]);
  mesh(building, new THREE.TorusGeometry(.23, .035, 6, 16), copper, -4.79, 1.1, 3.6).rotation.y = Math.PI / 2;
  box(building, [1.8, .14, 2.2], wood, [-4.5, 1.05, -3.4]);
  for (const z of [-4.2, -2.6]) box(building, [.12, 1, .12], dark, [-4.7, .5, z]);
  for (let i = 0; i < 3; i++) box(building, [.7, .6, .65], i % 2 ? wood : cream, [-1 + i * .8, .45, -5]);
  for (let i = 0; i < 12; i++) box(building, [.18, .03, .75], dark, [-5.8, .15, -3 + i * .5]);
  // Antenna silhouette; not a flashing screen or expensive extra light source.
  rod(building, [1.7, 5.3, 1.5], [1.7, 10.5, 1.5], .065, copper);
  for (const y of [8.5, 9.3, 10.1]) rod(building, [.6, y, 1.5], [2.8, y, 1.5], .04, dark);
  const signTexture = canvasMap((ctx, s) => {
    ctx.fillStyle = '#243b33'; ctx.fillRect(0, 0, s, s); ctx.strokeStyle = '#cbb985'; ctx.lineWidth = 6; ctx.strokeRect(12, 12, s - 24, s - 24);
    ctx.textAlign = 'center'; ctx.fillStyle = '#ebe0bf'; ctx.font = 'bold 64px sans-serif'; ctx.fillText('SIGNAL 03', s / 2, 195); ctx.font = '40px sans-serif'; ctx.fillText('바람곶 신호소', s / 2, 285); ctx.font = '25px sans-serif'; ctx.fillText('KEEP THE LIGHT ON', s / 2, 360);
  }); textures.push(signTexture);
  const sign = mesh(building, new THREE.PlaneGeometry(3.1, 1.65), new THREE.MeshStandardMaterial({ map: signTexture, roughness: .9 }), -3.4, 4.48, 0); sign.rotation.y = -Math.PI / 2;
  // A discreet home finish stencil is on the return lane, never a solid obstacle.
  for (const x of [-2, 2]) box(root, [.09, .02, 17], cream, [JOURNEY_HOME.x + x, .05, JOURNEY_HOME.z]);
  for (const z of [-8.5, 8.5]) box(root, [4.1, .02, .09], cream, [JOURNEY_HOME.x, .05, JOURNEY_HOME.z + z]);
  const homeTexture = canvasMap((ctx, s) => { ctx.fillStyle = '#273c34'; ctx.fillRect(0, 0, s, s); ctx.fillStyle = '#e4d6af'; ctx.textAlign = 'center'; ctx.font = 'bold 85px sans-serif'; ctx.fillText('BAY 01', s / 2, 230); ctx.font = '40px sans-serif'; ctx.fillText('정비소 귀환', s / 2, 320); }); textures.push(homeTexture);
  const home = mesh(root, new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshStandardMaterial({ map: homeTexture }), 13, 2.2, JOURNEY_HOME.z - 9);
  box(root, [.12, 2.8, .12], dark, [13, 1.4, JOURNEY_HOME.z - 9]);
  home.name = 'workshop-return-sign';
  batchStaticMeshes(root);
  return { root, setConfirmed(value) { lamp.emissiveIntensity = value ? 1.1 : .55; }, dispose() { textures.forEach(t => t.dispose()); } };
}
