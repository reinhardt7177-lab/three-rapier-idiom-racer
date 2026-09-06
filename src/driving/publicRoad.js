import * as THREE from 'three';
import { box, canvasMap, mesh } from '../garage/procedural.js';
import { STORY_STOP } from './story.js';

// Road markings, furniture and narrative destination; all assets generated here.
export function createPublicRoad({ harborOnly = false } = {}) {
  const root = new THREE.Group(); root.name = 'harbor-public-road';
  const textures = [], white = new THREE.MeshStandardMaterial({ color: '#dedbc6', roughness: .94 });
  const yellow = new THREE.MeshStandardMaterial({ color: '#c9ad63', roughness: .94 });
  if (harborOnly) yellow.dispose();
  const steel = new THREE.MeshStandardMaterial({ color: '#304740', roughness: .7, metalness: .4 });
  const mapMaterial = draw => { const map = canvasMap(draw, 512); textures.push(map); return new THREE.MeshStandardMaterial({ map, roughness: .8 }); };
  if (!harborOnly) for (const x of [-.2, .2]) box(root, [.12, .012, 1798], yellow, [x, .026, 0]);
  const matrix = new THREE.Matrix4(), dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(.13, .012, 3), white, 300);
  for (let i = 0; i < 300; i++) dashes.setMatrixAt(i, matrix.makeTranslation(i % 2 ? -5 : 5, .027, -895 + Math.floor(i / 2) * 12));
  if (!harborOnly) root.add(dashes); else dashes.geometry.dispose();
  for (const z of [-614, -515]) {
    for (let x = -9; x <= 9; x += 1.4) box(root, [.65, .014, 4], white, [x, .029, z]);
    box(root, [9.5, .012, .35], white, [-5, .029, z - 5]);
    box(root, [9.5, .012, .35], white, [5, .029, z + 5]);
  }
  function sign(z, heading, detail, x = -12) {
    const material = mapMaterial((ctx, s) => {
      ctx.fillStyle = '#294c43'; ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = '#dcd8bc'; ctx.lineWidth = 8; ctx.strokeRect(18, 18, s - 36, s - 36);
      ctx.textAlign = 'center'; ctx.fillStyle = '#ebe5c9'; ctx.font = 'bold 74px sans-serif'; ctx.fillText(heading, s / 2, s * .41);
      ctx.font = '29px sans-serif'; ctx.fillText(detail, s / 2, s * .59);
      ctx.font = '76px sans-serif'; ctx.fillText('↑', s / 2, s * .81);
    });
    box(root, [.13, 3.5, .13], steel, [x, 1.75, z]);
    const board = mesh(root, new THREE.PlaneGeometry(2.5, 2.5), material, x, 3.1, z); board.rotation.y = Math.PI;
  }
  sign(-682, '항만대로', 'HARBOR AVENUE · 60');
  sign(-576, '라디오 쉼터', 'RADIO 03 · 100 m');
  sign(-423, '해안도로', harborOnly ? 'COAST ROAD · 전망대 방면' : 'COAST ROAD · 시안 구간 끝');
  // Street benches and a shelter live on the existing raised pavement, not in a lane.
  box(root, [2.2, .16, 7], steel, [-12.5, 2.9, STORY_STOP.z]);
  for (const z of [STORY_STOP.z - 3, STORY_STOP.z + 3]) box(root, [.14, 2.8, .14], steel, [-13.4, 1.5, z]);
  box(root, [.65, .15, 3.4], white, [-13.2, .6, STORY_STOP.z]);
  box(root, [.13, .7, 3.4], steel, [-13.55, .9, STORY_STOP.z]);
  sign(STORY_STOP.z + 5, 'RADIO 03', '라디오 쉼터 · 만남의 장소', -12.5);
  // A marked stopping bay within the outer (right-hand) lane, clear of the curb.
  for (const x of [STORY_STOP.x - 2, STORY_STOP.x + 2]) box(root, [.1, .014, 24], white, [x, .03, STORY_STOP.z]);
  for (const z of [STORY_STOP.z - 12, STORY_STOP.z + 12]) box(root, [4, .014, .12], white, [STORY_STOP.x, .03, z]);
  const markerMaterial = new THREE.MeshBasicMaterial({ color: '#d9c792', transparent: true, opacity: .22, depthWrite: false, side: THREE.DoubleSide });
  const marker = mesh(root, new THREE.PlaneGeometry(3.6, 23), markerMaterial, STORY_STOP.x, .04, STORY_STOP.z);
  marker.rotation.x = -Math.PI / 2; marker.castShadow = false; marker.visible = false;
  return { root, setDestination(active) { marker.visible = active; }, dispose() { textures.forEach(t => t.dispose()); } };
}
