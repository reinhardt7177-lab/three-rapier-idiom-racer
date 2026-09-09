import * as THREE from 'three';
import { box, mesh, panel, rod } from './procedural.js';
import { GT_SPEC } from '../vehicleSpec.js';
import { createBodyGeometry, deckHeight } from './gtBody.js';
import { batchStaticMeshes } from './batchStatic.js';

// One metre per unit, +Z forward, +Y up. Geometry and wheel hubs share this specification.
export { GT_SPEC };

export function createGT() {
  const car = new THREE.Group(); car.name = 'procedural-gt';
  const wheels = [];
  const paint = new THREE.MeshPhysicalMaterial({ color: '#286963', metalness: .48, roughness: .39, clearcoat: .5, clearcoatRoughness: .3 });
  const dark = new THREE.MeshStandardMaterial({ color: '#131c1c', roughness: .56, metalness: .25 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#151819', roughness: .92 });
  const metal = new THREE.MeshStandardMaterial({ color: '#ae9a6b', metalness: .78, roughness: .29 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#162d37', metalness: .28, roughness: .15, clearcoat: 1, side: THREE.DoubleSide });
  const light = new THREE.MeshStandardMaterial({ color: '#fff1cc', emissive: '#fff0cf', emissiveIntensity: 1.1 });
  const red = new THREE.MeshStandardMaterial({ color: '#a3261b', emissive: '#ff2518', emissiveIntensity: .7 });
  const trim = new THREE.MeshStandardMaterial({ color: '#d5c9a5', metalness: .48, roughness: .38 });

  mesh(car, createBodyGeometry(), paint).name = 'closed-gt-shell';
  // Dark wheel-house backing prevents an empty see-through underside.
  for (const side of [-1,1]) for (const z of [-GT_SPEC.wheelbase/2, GT_SPEC.wheelbase/2]) {
    const liner=mesh(car,new THREE.CylinderGeometry(.515,.515,.025,32),dark,side*.755,.43,z);
    liner.rotation.z=Math.PI/2;
  }

  box(car, [1.72, .35, .1], paint, [0, .59, 2.28]);
  box(car, [1.78, .38, .1], paint, [0, .59, -2.28]);
  box(car, [1.94, .075, .31], dark, [0, .29, 2.18]);
  box(car, [1.9, .11, .3], dark, [0, .32, -2.17]);
  box(car, [.82, .19, .02], dark, [0, .54, 2.338]);
  for (let x = -.35; x <= .36; x += .1) box(car, [.024, .15, .024], metal, [x, .54, 2.352]);
  for (const side of [-1, 1]) {
    box(car, [.48, .15, .065], dark, [side * .65, .735, 2.3]);
    box(car, [.4, .047, .074], light, [side * .65, .75, 2.32]);
    box(car, [.58, .14, .045], dark, [side * .55, .745, -2.345]);
    for (const y of [.72,.775]) box(car, [.51, .025, .025], red, [side * .55, y, -2.38]);
    box(car, [.055, .055, .028], light, [side * .79, .72, -2.38]);
    box(car, [.065, .1, 1.7], dark, [side * 1.025, .35, 0]);
    const exhaust = mesh(car, new THREE.CylinderGeometry(.075, .075, .22, 12), metal, side * .7, .34, -2.32);
    exhaust.rotation.x = Math.PI / 2;
    const exhaustOpening=mesh(car,new THREE.CircleGeometry(.058,12),dark,side*.7,.34,-2.44); exhaustOpening.rotation.y=Math.PI;
  }
  // Readable rear identity in the chase camera: light panel, plate, diffuser.
  box(car,[1.66,.22,.035],dark,[0,.735,-2.325]);
  box(car,[.39,.105,.04],trim,[0,.515,-2.345]);
  for (const x of [-.12,0,.12]) box(car,[.045,.04,.045],dark,[x,.515,-2.37]);
  box(car,[.19,.028,.03],metal,[0,.835,-2.335]);
  for (const x of [-.45,-.22,0,.22,.45]) box(car,[.035,.13,.29],dark,[x,.3,-2.18]);
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
    // Door outline is intentionally on the flat centre flank, clear of arches.
    rod(car,[side*1.045,.42,.7],[side*1.04,.87,.7],.008,dark,4);
    rod(car,[side*1.045,.42,-.78],[side*1.04,.88,-.78],.008,dark,4);
    rod(car,[side*1.045,.42,-.78],[side*1.045,.42,.7],.008,dark,4);
    box(car,[.045,.045,.16],metal,[side*1.042,.78,.87]);
    for (let j = 0; j < 4; j++) box(car, [.17, .012, .028], dark, [side * .45, deckHeight(1.09+j*.09)+.007, 1.09 + j * .09]);
  }
  for (const side of [-1,1]) rod(car,[side*.67,1.047,.82],[side*.22,1.115,.72],.012,dark,6);
  box(car, [2.0, .075, .37], paint, [0, 1.24, -1.98]);
  for (const s of [-1, 1]) {
    box(car, [.055, .32, .12], dark, [s * .6, 1.07, -1.98]);
    box(car, [.055, .21, .43], dark, [s * 1.0, 1.3, -1.98]);
  }
  for (const x of [-.12, .12]) {
    const positions = [], triangles = [];
    for (let i = 0; i <= 30; i++) {
      const z = 1.02 + i / 30 * 1.14;
      const y = deckHeight(z) + .007;
      positions.push(x - .035, y, z, x + .035, y, z);
      if (i) { const a = (i - 1) * 2; triangles.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const stripe = new THREE.BufferGeometry();
    stripe.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    stripe.setIndex(triangles); stripe.computeVertexNormals(); mesh(car, stripe, trim);
  }
  for (const side of [-1, 1]) for (const z of [-GT_SPEC.wheelbase / 2, GT_SPEC.wheelbase / 2]) {
    const pivot = new THREE.Group(); pivot.userData.dynamic=true; pivot.position.set(side * GT_SPEC.track / 2, GT_SPEC.hubHeight, z); car.add(pivot);
    const wheel = new THREE.Group(); pivot.add(wheel);
    wheels.push({ pivot, spin: wheel, front: z > 0 });
    const tire = mesh(wheel, new THREE.CylinderGeometry(GT_SPEC.wheelRadius, GT_SPEC.wheelRadius, .28, 32, 1), rubber);
    tire.rotation.z = Math.PI / 2;
    const rim = mesh(wheel, new THREE.CylinderGeometry(.275, .275, .292, 24), dark);
    rim.rotation.z = Math.PI / 2;
    const ring = mesh(wheel, new THREE.TorusGeometry(.273, .018, 6, 32), metal, side * .154, 0, 0);
    ring.rotation.y = Math.PI / 2;
    const disc=mesh(wheel,new THREE.CylinderGeometry(.225,.225,.012,24),trim,side*.152,0,0);disc.rotation.z=Math.PI/2;
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
    // Merge within each spinning wheel, never across its steering pivot.
    pivot.userData.dynamic=false; batchStaticMeshes(wheel); pivot.userData.dynamic=true;
  }
  batchStaticMeshes(car);
  car.rotation.y = -.25;
  return { root: car, paint, wheels, brakeLight: red, setColor: (color) => paint.color.set(color) };
}
