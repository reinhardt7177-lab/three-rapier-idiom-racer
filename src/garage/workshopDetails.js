import * as THREE from 'three';
import { box, mesh, rod, canvasMap, randomSeed } from './procedural.js';

export function addWorkshopDetails(root) {
  const rng = randomSeed(513);
  const steel = new THREE.MeshStandardMaterial({ color: '#34453e', metalness: .55, roughness: .7 });
  const cap = new THREE.MeshStandardMaterial({ color: '#7b806b', roughness: .92 });
  const clay = new THREE.MeshStandardMaterial({ color: '#746454', roughness: .92 });
  const seam = new THREE.MeshStandardMaterial({ color: '#354138', roughness: 1 });
  // Staggered coping and shallow ribs provide silhouette detail without covering the car.
  for (let x = -6.1; x <= 6.1; x += .66) {
    const block = box(root, [.61, .11 + rng() * .05, .58], cap, [x, 3.96, -4.49]);
    block.rotation.y = (rng() - .5) * .045;
  }
  for (let z = -4.1; z < 4.2; z += .68) box(root, [.6, .12, .63], cap, [-6.22, 3.96, z]);
  for (const z of [-3.3, -.3, 2.7]) {
    box(root, [.2, 3.9, .24], steel, [-6.02, 1.92, z]);
    box(root, [1.3, .14, .16], steel, [-5.43, 3.78, z]);
    rod(root, [-6, 3.13, z], [-4.83, 3.76, z], .045, steel);
  }
  box(root, [7.6, .25, .09], seam, [-2.45, .2, -4.23]);
  box(root, [.09, .25, 9.2], seam, [-6.0, .2, -.03]);
  // A code-drawn alpha texture suggests contact/age; it is not a baked external image.
  const shadowMap = canvasMap((ctx, size) => {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, size * .08, size / 2, size / 2, size * .5);
    gradient.addColorStop(0, 'rgba(13,23,19,.48)'); gradient.addColorStop(.5, 'rgba(13,23,19,.28)'); gradient.addColorStop(1, 'rgba(13,23,19,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
  }, 128);
  const contact = new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false, toneMapped: false });
  for (const [x, z, w, d] of [[-.1, .65, 3.05, 5.5], [-3.7, -3.25, 4.6, 1.8], [-4.45, -.4, 3, 1.8], [5.45, -.8, 1.3, 1.3]]) {
    const shade = mesh(root, new THREE.PlaneGeometry(w, d), contact, x, .013, z);
    shade.rotation.x = -Math.PI / 2; shade.castShadow = false;
  }
  const streakMap = canvasMap((ctx, size) => {
    for (let i = 0; i < 30; i++) {
      const x = rng() * size, y = rng() * size * .35, length = size * (.2 + rng() * .6);
      const gradient = ctx.createLinearGradient(x, y, x, y + length);
      gradient.addColorStop(0, 'rgba(26,38,30,.3)'); gradient.addColorStop(1, 'rgba(26,38,30,0)');
      ctx.fillStyle = gradient; ctx.fillRect(x, y, 1 + rng() * 8, length);
    }
  }, 256);
  const streak = new THREE.MeshBasicMaterial({ map: streakMap, transparent: true, depthWrite: false, toneMapped: false });
  for (const x of [-4.8, -2.6, .2, 5.6]) {
    const stain = mesh(root, new THREE.PlaneGeometry(x > 5 ? .9 : 1.3, 1.3), streak, x, 2.93, -4.28);
    stain.castShadow = false;
  }
  const fan = new THREE.Group(); fan.position.set(-5.91, 2.28, .62); root.add(fan);
  const ring = mesh(fan, new THREE.TorusGeometry(.38, .045, 8, 24), steel); ring.rotation.y = Math.PI / 2;
  const disc = mesh(fan, new THREE.CylinderGeometry(.35, .35, .08, 24), seam); disc.rotation.z = Math.PI / 2;
  const rotor = new THREE.Group(); rotor.position.x = .055; rotor.userData.dynamic = true; fan.add(rotor);
  for (let i = 0; i < 4; i++) {
    const blade = box(rotor, [.025, .15, .29], cap, [0, 0, .16]);
    const pivot = new THREE.Group(); rotor.remove(blade); pivot.add(blade); pivot.rotation.x = i * Math.PI / 2; rotor.add(pivot);
  }
  for (let i = -2; i <= 2; i++) rod(fan, [.095, -.3, i * .11], [.095, .3, i * .11], .01, steel, 4);
  // A low foreground shipping crate and wheel chocks leave the central bay unobstructed.
  box(root, [.83, .56, .73], clay, [-4.75, .29, 3.35]);
  for (const z of [3.03, 3.67]) for (const x of [-5.05, -4.45]) box(root, [.075, .6, .04], cap, [x, .3, z]);
  for (const x of [2.3, 2.55]) {
    const chock = mesh(root, new THREE.CylinderGeometry(.12, .12, .19, 3), new THREE.MeshStandardMaterial({ color: '#9c8c54', roughness: .86 }), x, .09, -1.65);
    chock.rotation.z = Math.PI / 2;
  }
  return { update: dt => { rotor.rotation.x += dt * 1.25; } };
}
