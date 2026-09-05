import * as THREE from 'three';
import { canvasMap, randomSeed } from '../garage/procedural.js';

export function createRoadDetails() {
  const root = new THREE.Group(); root.name = 'speed-reference-details';
  const rng = randomSeed(7601);
  const texture = canvasMap((ctx, size) => {
    ctx.fillStyle = '#777c78'; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 30000; i++) {
      const shade = 65 + Math.floor(rng() * 100);
      ctx.fillStyle = `rgba(${shade},${shade + 3},${shade},.4)`;
      ctx.fillRect(rng() * size, rng() * size, 1 + rng() * 2, 1 + rng() * 2);
    }
    ctx.strokeStyle = '#3c46411c'; ctx.lineWidth = 3;
    for (let i = 0; i < 12; i++) { const x = rng() * size; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + rng() * 10, size); ctx.stroke(); }
  }, 512);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(20 / 6, 1798 / 6);
  const matrix = new THREE.Matrix4();
  const dark = new THREE.MeshStandardMaterial({ color: '#34453e', roughness: .8 });
  const reflector = new THREE.MeshStandardMaterial({ color: '#eadfaf', emissive: '#ae8b48', emissiveIntensity: .15 });
  function instances(geometry, material, count, position) {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    for (let i = 0; i < count; i++) mesh.setMatrixAt(i, matrix.makeTranslation(...position(i)));
    mesh.receiveShadow = true; root.add(mesh);
  }
  // Public-road delineators. No red/white circuit kerbs.
  for (const side of [-1, 1]) {
    // Flexible visual delineators 12 m apart, outside the 20 m driving ribbon.
    instances(new THREE.BoxGeometry(.12, .85, .12), dark, 150, i => [side * 12, .425, -894 + i * 12]);
    instances(new THREE.BoxGeometry(.14, .17, .15), reflector, 150, i => [side * 12, .7, -894 + i * 12]);
    instances(new THREE.BoxGeometry(.14, .018, .28), reflector, 300, i => [side * 9.65, .032, -897 + i * 6]);
  }
  return { root, texture };
}
