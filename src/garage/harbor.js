import * as THREE from 'three';
import { box, rod, mesh, canvasMap, randomSeed, concreteMap } from './procedural.js';

export function createHarbor() {
  const root = new THREE.Group(); root.name = 'harbor-exterior';
  const steel = new THREE.MeshStandardMaterial({ color: '#3d514a', roughness: .8, metalness: .35 });
  const stone = new THREE.MeshStandardMaterial({ color: '#778476', map: concreteMap(), roughness: .96 });
  const rust = new THREE.MeshStandardMaterial({ color: '#947352', roughness: .77, metalness: .35 });
  const rope = new THREE.MeshStandardMaterial({ color: '#9c936f', roughness: 1 });
  const rng = randomSeed(281);
  box(root, [10, .52, 5.8], stone, [2, -.29, -7.6]);
  box(root, [10, .22, .38], steel, [2, -.05, -10.5]);
  for (let x = -2.5; x < 7; x += 1.6) {
    box(root, [.018, .007, 5.45], steel, [x, -.022, -7.6]);
    mesh(root, new THREE.CylinderGeometry(.1, .12, .48, 8), rust, x, .2, -10.3);
    box(root, [.32, .1, .13], steel, [x, .45, -10.3]);
  }
  for (let x = -2.5; x < 6; x += 1.6) {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, .4, -10.3), new THREE.Vector3(x + .8, .16, -10.3), new THREE.Vector3(x + 1.6, .4, -10.3));
    mesh(root, new THREE.TubeGeometry(curve, 10, .024, 4, false), rope);
  }
  const waterTexture = canvasMap((ctx, size) => {
    ctx.fillStyle = '#467b82'; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 1800; i++) {
      ctx.fillStyle = `rgba(178,210,189,${rng() * .12})`;
      ctx.fillRect(rng() * size, rng() * size, rng() * 45 + 4, .5 + rng());
    }
  });
  waterTexture.wrapS = waterTexture.wrapT = THREE.RepeatWrapping; waterTexture.repeat.set(5, 6);
  const water = mesh(root, new THREE.PlaneGeometry(90, 70), new THREE.MeshStandardMaterial({ map: waterTexture, color: '#a0c4c0', roughness: .38, metalness: .15 }), 0, -.38, -44.5);
  water.rotation.x = -Math.PI / 2; water.castShadow = false;
  // A small distant quay carries the crane; it is scenery, not a traversable map.
  box(root, [4, .48, 5.6], stone, [-4.8, -.28, -10.5]);
  const crane = new THREE.Group(); crane.position.set(-4.8, 0, -11.2); crane.scale.setScalar(.6); root.add(crane);
  for (const x of [-.7, .7]) for (const z of [-.6, .6]) rod(crane, [x, .1, z], [x * .55, 7, z * .55], .085, steel);
  for (let y = 1; y < 7; y += 1.2) {
    rod(crane, [-.65, y, .57], [.65, y + .9, .57], .037, rust);
    rod(crane, [.65, y, -.57], [-.65, y + .9, -.57], .037, rust);
  }
  rod(crane, [-4, 7.2, 0], [4, 7.2, 0], .14, steel);
  rod(crane, [-3.8, 7.2, 0], [0, 8.9, 0], .05, rust);
  rod(crane, [0, 8.9, 0], [4, 7.2, 0], .05, rust);
  rod(crane, [-3.4, 7.1, 0], [-3.4, 3.6, 0], .02, steel);
  const hook = mesh(crane, new THREE.TorusGeometry(.14, .035, 6, 12, Math.PI * 1.5), rust, -3.4, 3.46, 0);
  hook.rotation.z = .6;
  box(crane, [1.3, .85, 1], steel, [.2, 6.6, 0]);
  const containerColors = ['#69765b', '#77604d', '#4b7370'];
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshStandardMaterial({ color: containerColors[i], roughness: .82, metalness: .2 });
    const x = -6.1 + i * 1.25, z = -7.5;
    box(root, [1.05, .9, 1.5], mat, [x, .44, z]);
    for (let j = 0; j < 5; j++) box(root, [.03, .86, 1.52], mat, [x - .45 + j * .225, .44, z]);
  }
  return { root, update: dt => { waterTexture.offset.x += dt * .006; waterTexture.offset.y += dt * .002; } };
}

export function createShutter(parent, steel, edge) {
  const group = new THREE.Group(); group.name = 'working-shutter'; group.userData.dynamic = true; parent.add(group);
  const slatMaterial = new THREE.MeshStandardMaterial({ color: '#53675d', metalness: .48, roughness: .65 });
  const width = 3.68, center = 3.25, top = 3.37, z = -4.27;
  for (const x of [1.33, 5.17]) {
    box(group, [.2, 3.65, .42], steel, [x, 1.78, z]);
    box(group, [.08, 3.5, .1], edge, [x + (x < center ? .095 : -.095), 1.75, z + .23]);
  }
  box(group, [4.2, .35, .55], steel, [center, 3.58, z]);
  const roller = mesh(group, new THREE.CylinderGeometry(.22, .22, 3.88, 16), edge, center, 3.85, z); roller.rotation.z = Math.PI / 2;
  box(group, [3.88, .055, .72], edge, [center, .03, z]);
  const slats = [];
  for (let i = 0; i < 17; i++) slats.push(box(group, [width, .185, .065], slatMaterial, [center, top - i * .19, z]));
  const lowerRail = box(group, [width, .1, .13], steel, [center, top, z + .02]);
  const handle = box(group, [.45, .035, .065], edge, [center, top, z + .13]);
  let target = 1, value = 1;
  function apply() {
    const height = .16 + (1 - value) * 3.1;
    for (let i = 0; i < slats.length; i++) {
      const section = THREE.MathUtils.clamp(height - i * .19, 0, .185);
      slats[i].visible = section > .001; slats[i].scale.y = Math.max(.001, section / .185);
      slats[i].position.y = top - i * .19 - section / 2;
    }
    lowerRail.position.y = top - height; handle.position.y = top - height + .06;
    group.userData.openFraction = value;
  }
  apply();
  return {
    setOpen(open, immediate = false) { target = open ? 1 : 0; if (immediate) { value = target; apply(); } },
    update(dt, reducedMotion = false) { value = reducedMotion ? target : THREE.MathUtils.damp(value, target, 4, dt); if (Math.abs(target - value) < .001) value = target; apply(); },
  };
}
