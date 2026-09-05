import * as THREE from 'three';
import { box, mesh, panel, rod } from './procedural.js';
import { GT_SPEC } from '../vehicleSpec.js';

// One metre per unit, +Z forward, +Y up. Geometry and wheel hubs share this specification.
export { GT_SPEC };

export function createGT() {
  const car = new THREE.Group(); car.name = 'procedural-gt';
  const wheels = [];
  const paint = new THREE.MeshPhysicalMaterial({ color: '#286963', metalness: .58, roughness: .3, clearcoat: .7, clearcoatRoughness: .24 });
  const dark = new THREE.MeshStandardMaterial({ color: '#131c1c', roughness: .56, metalness: .25 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#151819', roughness: .92 });
  const metal = new THREE.MeshStandardMaterial({ color: '#ae9a6b', metalness: .78, roughness: .29 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#162d37', metalness: .28, roughness: .15, clearcoat: 1, side: THREE.DoubleSide });
  const light = new THREE.MeshStandardMaterial({ color: '#fff1cc', emissive: '#fff0cf', emissiveIntensity: 1.1 });
  const red = new THREE.MeshStandardMaterial({ color: '#a3261b', emissive: '#ff2518', emissiveIntensity: .7 });
  const trim = new THREE.MeshStandardMaterial({ color: '#d5c9a5', metalness: .48, roughness: .38 });

  // Lofted shell with wheel openings, rather than stacked rectangular boxes.
  const vertices = [], indices = [], steps = 100, ringSize = 10;
  for (let i = 0; i <= steps; i++) {
    const z = -2.3 + i / steps * 4.6;
    const width = 1.02 - .17 * Math.pow(Math.abs(z) / 2.3, 4);
    const top = .99 - .16 * Math.pow(Math.abs(z) / 2.3, 3);
    let bottom = .32;
    for (const hubZ of [-1.42, 1.42]) {
      const dz = z - hubZ;
      if (Math.abs(dz) < .49) bottom = Math.max(bottom, .43 + Math.sqrt(.49 ** 2 - dz ** 2));
    }
    const shoulder = Math.max(top, bottom + .065);
    const ring = [
      [-width * .9, bottom], [-width, bottom + .025], [-width, shoulder - .035],
      [-width * .84, shoulder + .045], [-width * .58, shoulder + .065],
      [width * .58, shoulder + .065], [width * .84, shoulder + .045],
      [width, shoulder - .035], [width, bottom + .025], [width * .9, bottom],
    ];
    for (const [x, y] of ring) vertices.push(x, y, z);
    if (i > 0) for (let k = 0; k < ringSize; k++) {
      const a = (i - 1) * ringSize + k, b = (i - 1) * ringSize + (k + 1) % ringSize;
      const c = i * ringSize + k, d = i * ringSize + (k + 1) % ringSize;
      indices.push(a, c, b, b, c, d);
    }
  }
  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  bodyGeo.setIndex(indices); bodyGeo.computeVertexNormals();
  mesh(car, bodyGeo, paint);

  box(car, [1.72, .35, .1], paint, [0, .59, 2.28]);
  box(car, [1.78, .38, .1], paint, [0, .59, -2.28]);
  box(car, [1.94, .075, .31], dark, [0, .29, 2.18]);
  box(car, [1.9, .11, .3], dark, [0, .32, -2.17]);
  box(car, [.82, .19, .02], dark, [0, .54, 2.338]);
  for (let x = -.35; x <= .36; x += .1) box(car, [.024, .15, .024], metal, [x, .54, 2.352]);
  for (const side of [-1, 1]) {
    box(car, [.48, .15, .065], dark, [side * .65, .735, 2.3]);
    box(car, [.4, .047, .074], light, [side * .65, .75, 2.32]);
    box(car, [.57, .07, .05], red, [side * .55, .74, -2.35]);
    box(car, [.065, .1, 1.7], dark, [side * 1.025, .35, 0]);
    const exhaust = mesh(car, new THREE.CylinderGeometry(.075, .075, .22, 12), metal, side * .7, .34, -2.32);
    exhaust.rotation.x = Math.PI / 2;
  }
  const frontBase = [.79, 1.025, .83], frontRoof = [.61, 1.55, .28];
  const rearRoof = [.61, 1.55, -.67], rearBase = [.83, 1.065, -1.23];
  const mirror = (v, s) => [v[0] * s, v[1], v[2]];
  panel(car, [mirror(frontBase, -1), mirror(frontRoof, -1), frontRoof, frontBase], glass);
  panel(car, [mirror(rearBase, -1), rearBase, rearRoof, mirror(rearRoof, -1)], glass);
  box(car, [1.25, .075, 1.04], paint, [0, 1.575, -.2]);
  for (const side of [-1, 1]) {
    panel(car, [mirror(frontBase, side), mirror(frontRoof, side), mirror(rearRoof, side), mirror(rearBase, side)], glass);
    rod(car, mirror(frontBase, side), mirror(frontRoof, side), .038, paint);
    rod(car, mirror(rearRoof, side), mirror(rearBase, side), .052, paint);
    rod(car, [side * .65, 1.55, -.32], [side * .82, 1.055, -.32], .025, dark);
    rod(car, mirror(frontBase, side), mirror(rearBase, side), .027, paint);
    box(car, [.26, .12, .19], paint, [side * 1.03, 1.09, .61]);
    rod(car, [side * .82, 1.08, .55], [side * 1.05, 1.08, .61], .026, dark);
    box(car, [.025, .036, .19], metal, [side * 1.033, .89, -.47]);
    for (let j = 0; j < 4; j++) box(car, [.19, .018, .035], dark, [side * .68, .994, 1.09 + j * .09]);
  }
  box(car, [2.0, .075, .37], paint, [0, 1.24, -1.98]);
  for (const s of [-1, 1]) {
    box(car, [.055, .32, .12], dark, [s * .6, 1.07, -1.98]);
    box(car, [.055, .21, .43], dark, [s * 1.0, 1.3, -1.98]);
  }
  for (const x of [-.12, .12]) {
    const positions = [], triangles = [];
    for (let i = 0; i <= 30; i++) {
      const z = 1.02 + i / 30 * 1.14;
      const top = .99 - .16 * Math.pow(z / 2.3, 3);
      const dz = z - 1.42;
      const bottom = Math.abs(dz) < .49 ? .43 + Math.sqrt(.49 ** 2 - dz ** 2) : .32;
      const y = Math.max(top, bottom + .065) + .07;
      positions.push(x - .035, y, z, x + .035, y, z);
      if (i) { const a = (i - 1) * 2; triangles.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const stripe = new THREE.BufferGeometry();
    stripe.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    stripe.setIndex(triangles); stripe.computeVertexNormals(); mesh(car, stripe, trim);
  }
  for (const side of [-1, 1]) for (const z of [-GT_SPEC.wheelbase / 2, GT_SPEC.wheelbase / 2]) {
    const pivot = new THREE.Group(); pivot.position.set(side * GT_SPEC.track / 2, GT_SPEC.hubHeight, z); car.add(pivot);
    const wheel = new THREE.Group(); pivot.add(wheel);
    wheels.push({ pivot, spin: wheel, front: z > 0 });
    const tire = mesh(wheel, new THREE.CylinderGeometry(GT_SPEC.wheelRadius, GT_SPEC.wheelRadius, .28, 32, 1), rubber);
    tire.rotation.z = Math.PI / 2;
    const rim = mesh(wheel, new THREE.CylinderGeometry(.275, .275, .292, 24), dark);
    rim.rotation.z = Math.PI / 2;
    const ring = mesh(wheel, new THREE.TorusGeometry(.273, .018, 6, 32), metal, side * .154, 0, 0);
    ring.rotation.y = Math.PI / 2;
    const hub = mesh(wheel, new THREE.CylinderGeometry(.08, .08, .32, 12), metal);
    hub.rotation.z = Math.PI / 2;
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5;
      rod(wheel, [side * .16, Math.cos(a) * .055, Math.sin(a) * .055], [side * .16, Math.cos(a + .13) * .25, Math.sin(a + .13) * .25], .017, metal, 5);
    }
    for (const offset of [-.105, .105]) {
      const seam = mesh(wheel, new THREE.TorusGeometry(.378, .009, 4, 32), dark, offset, 0, 0);
      seam.rotation.y = Math.PI / 2;
    }
  }
  car.rotation.y = -.25;
  return { root: car, paint, wheels, brakeLight: red, setColor: (color) => paint.color.set(color) };
}
