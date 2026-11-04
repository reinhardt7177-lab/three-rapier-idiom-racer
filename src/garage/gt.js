import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { box, mesh, panel, rod } from './procedural.js';
import { GT_SPEC } from '../vehicleSpec.js';
import { createBodyGeometry, createRearBumperGeometry, deckHeight } from './gtBody.js';
import { batchStaticMeshes } from './batchStatic.js';

// One metre per unit, +Z forward, +Y up. Geometry and wheel hubs share this specification.
export { GT_SPEC };

export function createGT() {
  const car = new THREE.Group(); car.name = 'procedural-gt';
  const wheels = [];
  const paint = new THREE.MeshPhysicalMaterial({ color: '#286963', metalness: .32, roughness: .24, clearcoat: 1, clearcoatRoughness: .14 });
  const dark = new THREE.MeshStandardMaterial({ color: '#131c1c', roughness: .56, metalness: .25 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#151819', roughness: .92 });
  const metal = new THREE.MeshStandardMaterial({ color: '#ae9a6b', metalness: .78, roughness: .29 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#162d37', metalness: .28, roughness: .15, clearcoat: 1, side: THREE.DoubleSide });
  const light = new THREE.MeshStandardMaterial({ color: '#fff1cc', emissive: '#fff0cf', emissiveIntensity: 1.1 });
  const red = new THREE.MeshStandardMaterial({ color: '#a3261b', emissive: '#ff2518', emissiveIntensity: .7 });
  const trim = new THREE.MeshStandardMaterial({ color: '#d5c9a5', metalness: .48, roughness: .38 });
  const rotor = new THREE.MeshStandardMaterial({ color: '#515b60', metalness: .65, roughness: .6 });

  mesh(car, createBodyGeometry(), paint).name = 'closed-gt-shell';
  // Dark wheel-house backing prevents an empty see-through underside.
  for (const side of [-1,1]) for (const z of [-GT_SPEC.wheelbase/2, GT_SPEC.wheelbase/2]) {
    const liner=mesh(car,new THREE.CylinderGeometry(.515,.515,.025,32,1,false,0,Math.PI),dark,side*.755,.43,z);
    liner.rotation.z=Math.PI/2;
  }

  box(car, [1.72, .35, .1], paint, [0, .59, 2.28]);
  mesh(car,createRearBumperGeometry(),paint);
  box(car, [1.94, .075, .31], dark, [0, .29, 2.18]);
  box(car, [.82, .19, .02], dark, [0, .54, 2.338]);
  // Recessed horizontal grille keeps the thin headlights visually dominant.
  for (const y of [.50,.55,.60]) box(car, [.74, .013, .024], rotor, [0, y, 2.352]);
  box(car,[.12,.035,.025],metal,[0,.635,2.355]);
  for (const side of [-1, 1]) {
    box(car, [.48, .15, .065], dark, [side * .65, .735, 2.3]);
    box(car, [.4, .047, .074], light, [side * .65, .75, 2.32]);
    for (const y of [.71,.765]) box(car, [.66, .025, .025], red, [side * .55, y, -2.463]);
    box(car, [.045, .045, .028], light, [side * .855, .715, -2.465]);
    box(car, [.065, .1, 1.7], dark, [side * 1.025, .35, 0]);
    const exhaust = mesh(car, new THREE.CylinderGeometry(.065, .065, .20, 16), metal, side * .81, .36, -2.44);
    exhaust.rotation.x = Math.PI / 2;
    const exhaustOpening=mesh(car,new THREE.CircleGeometry(.051,16),dark,side*.81,.36,-2.545); exhaustOpening.rotation.y=Math.PI;
  }
  // Readable rear identity in the chase camera: light panel, plate, diffuser.
  box(car,[1.84,.16,.035],dark,[0,.74,-2.438]);
  box(car,[.36,.085,.028],trim,[0,.55,-2.445]);
  for (const x of [-.10,0,.10]) box(car,[.038,.029,.022],dark,[x,.55,-2.469]);
  box(car,[.16,.024,.025],metal,[0,.805,-2.458]);
  // Deep lower recess and projecting fins remain legible from the race camera.
  box(car,[1.42,.185,.045],dark,[0,.385,-2.441]);
  panel(car,[[-.68,.24,-1.94],[-.68,.46,-2.48],[.68,.46,-2.48],[.68,.24,-1.94]],dark);
  for (const x of [-.62,-.31,0,.31,.62]) box(car,[.034,.21,.40],rotor,[x,.30,-2.32]);
  box(car,[.105,.038,.025],red,[0,.455,-2.477]);
  const frontBase = [.76, 1.018, .86], frontRoof = [.56, 1.35, .23];
  const rearRoof = [.56, 1.35, -.55], rearBase = [.70, 1.016, -1.20];
  const mirror = (v, s) => [v[0] * s, v[1], v[2]];
  panel(car, [mirror(frontBase, -1), mirror(frontRoof, -1), frontRoof, frontBase], glass);
  panel(car, [mirror(rearBase, -1), rearBase, rearRoof, mirror(rearRoof, -1)], glass);
  mesh(car,new RoundedBoxGeometry(1.19,.075,.88,2,.03),paint,0,1.3725,-.15);
  for (const side of [-1, 1]) {
    panel(car, [mirror(frontBase, side), mirror(frontRoof, side), mirror(rearRoof, side), mirror(rearBase, side)], glass);
    rod(car, mirror(frontBase, side), mirror(frontRoof, side), .038, paint);
    // Painted rear buttresses narrow the glass and join the broad rear haunches.
    const buttress=[mirror(rearRoof,side),mirror(rearBase,side),[side*.92,deckHeight(-1.32)+.02,-1.32],[side*.72,1.035,-.55]];
    // Mirroring positions reverses winding; both outer panels must face upward.
    panel(car,side>0?[buttress[0],...buttress.slice(1).reverse()]:buttress,paint);
    rod(car, mirror(rearRoof, side), mirror(rearBase, side), .04, paint);
    rod(car, [side * .568, 1.35, -.24], [side * .735, 1.017, -.24], .023, dark);
    rod(car, mirror(frontBase, side), mirror(rearBase, side), .027, paint);
    box(car, [.22, .09, .19], paint, [side * 1.01, 1.06, .61]);
    rod(car, [side * .78, 1.045, .55], [side * 1.03, 1.045, .61], .024, dark);
    box(car, [.025, .036, .19], metal, [side * 1.033, .89, -.47]);
    // Door outline is intentionally on the flat centre flank, clear of arches.
    rod(car,[side*1.045,.42,.7],[side*1.04,.87,.7],.008,dark,4);
    rod(car,[side*1.045,.42,-.78],[side*1.04,.88,-.78],.008,dark,4);
    rod(car,[side*1.045,.42,-.78],[side*1.045,.42,.7],.008,dark,4);
    box(car,[.045,.045,.16],metal,[side*1.042,.78,.87]);
    for (let j = 0; j < 4; j++) box(car, [.17, .012, .028], dark, [side * .45, deckHeight(1.09+j*.09)+.007, 1.09 + j * .09]);
  }
  for (const side of [-1,1]) rod(car,[side*.64,1.035,.83],[side*.22,1.08,.74],.01,dark,6);
  mesh(car,new RoundedBoxGeometry(1.94,.05,.29,1,.018),paint,0,1.12,-2.05);
  for (const s of [-1, 1]) {
    box(car, [.045, .16, .09], dark, [s * .64, 1.02, -2.05]);
    box(car, [.035, .115, .33], dark, [s * .975, 1.13, -2.05]);
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
    const disc=mesh(wheel,new THREE.CylinderGeometry(.225,.225,.012,32),rotor,side*.143,0,0);disc.rotation.z=Math.PI/2;
    // Drilled rotor marks sit behind the gold spokes, retaining visible depth.
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6;
      const hole=mesh(wheel,new THREE.CircleGeometry(.011,6),dark,side*.150,Math.cos(a)*.19,Math.sin(a)*.19);
      hole.rotation.y=side*Math.PI/2;
    }
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
