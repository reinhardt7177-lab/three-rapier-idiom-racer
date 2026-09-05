import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { box, mesh, rod, randomSeed, concreteMap, labelMap } from './procedural.js';
import { createShutter } from './harbor.js';
import { addWorkshopDetails } from './workshopDetails.js';

export function createWorkshop() {
  const root = new THREE.Group(); root.name = 'harbor-workshop';
  const rng = randomSeed(92);
  const steel = new THREE.MeshStandardMaterial({ color: '#26332f', metalness: .6, roughness: .6 });
  const edge = new THREE.MeshStandardMaterial({ color: '#6c7060', metalness: .3, roughness: .7 });
  const timber = new THREE.MeshStandardMaterial({ color: '#887050', roughness: .84 });
  const rust = new THREE.MeshStandardMaterial({ color: '#946442', metalness: .45, roughness: .76 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#1c2221', roughness: .95 });
  const yellow = new THREE.MeshStandardMaterial({ color: '#c9b36b', roughness: .8 });
  const floorTexture = concreteMap();
  const floorMaterial = new THREE.MeshStandardMaterial({ map: floorTexture, color: '#a4aaa0', roughness: .82 });
  const mortar = new THREE.MeshStandardMaterial({ color: '#323b34', roughness: 1 });

  box(root, [13.4, .46, 10.3], steel, [0, -.27, 0]);
  const tileMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(.976, .045, .976), floorMaterial, 130);
  const dummy = new THREE.Object3D(); let tile = 0;
  for (let x = -6; x <= 6; x++) for (let z = -4.5; z <= 4.5; z++) {
    dummy.position.set(x, -.022, z); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    tileMesh.setMatrixAt(tile, dummy.matrix);
    tileMesh.setColorAt(tile++, new THREE.Color().setScalar(.83 + rng() * .17));
  }
  tileMesh.receiveShadow = true; root.add(tileMesh);

  // A single instanced draw for masonry; windows are real openings in the back wall.
  box(root, [7.5, 3.7, .22], mortar, [-2.55, 1.82, -4.65]);
  box(root, [3.95, .42, .22], mortar, [3.2, 3.48, -4.65]);
  box(root, [1.08, 3.7, .22], mortar, [5.76, 1.82, -4.65]);
  box(root, [.22, 3.7, 9.45], mortar, [-6.4, 1.82, -.1]);
  const brickGeo = new THREE.BoxGeometry(.55, .22, .32);
  const brickMat = new THREE.MeshStandardMaterial({ color: '#697971', roughness: .91 });
  const bricks = new THREE.InstancedMesh(brickGeo, brickMat, 1600);
  let count = 0;
  const addBrick = (x, y, z, angle) => {
    dummy.position.set(x, y, z); dummy.rotation.set(0, angle, 0);
    dummy.scale.set(.93 + rng() * .1, .92 + rng() * .1, .92 + rng() * .14); dummy.updateMatrix();
    bricks.setMatrixAt(count, dummy.matrix);
    bricks.setColorAt(count++, new THREE.Color().setHSL(.13 + rng() * .035, .09 + rng() * .09, .23 + rng() * .14));
  };
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 23; col++) {
      const x = -6.17 + col * .55 + (row % 2) * .275;
      if (x > 6.3) continue;
      const y = .12 + row * .235;
      if (x > 1.27 && x < 5.2 && y < 3.31) continue;
      addBrick(x, y, -4.48, 0);
    }
    for (let col = 0; col < 17; col++) addBrick(-6.22, .12 + row * .235, -4.22 + col * .55 + (row % 2) * .275, Math.PI / 2);
  }
  bricks.count = count; bricks.castShadow = bricks.receiveShadow = true; root.add(bricks);
  box(root, [13.2, .16, .58], edge, [0, 3.82, -4.48]);
  box(root, [.58, .16, 9.8], edge, [-6.22, 3.82, -.1]);

  for (const x of [-5.8, -.9, 5.95]) {
    box(root, [.24, 4.1, .36], steel, [x, 2, -4.05]);
    box(root, [.5, .12, .55], steel, [x, .08, -4.05]);
    box(root, [.48, .12, .55], steel, [x, 4.02, -4.05]);
    for (const y of [.2, .42, 3.5]) for (const s of [-1, 1]) mesh(root, new THREE.SphereGeometry(.035, 6, 4), edge, x + s * .16, y, -3.85);
  }
  box(root, [12.5, .25, .34], steel, [.05, 3.6, -3.95]);
  rod(root, [-5.75, 3.55, -3.92], [-4.8, 2.7, -3.92], .055, steel);
  rod(root, [5.95, 3.55, -3.92], [4.95, 2.7, -3.92], .055, steel);

  const shutter = createShutter(root, steel, edge);

  // Pipes and their brackets make the side wall more than a flat backdrop.
  for (const y of [2.9, 3.15]) {
    rod(root, [-6.0, y, -3.5], [-6.0, y, 3.9], .045, rust);
    for (let z = -3; z < 4; z += 1.5) box(root, [.2, .18, .075], steel, [-6.06, y, z]);
  }
  rod(root, [-5.98, .3, 3.8], [-5.98, 3.16, 3.8], .055, rust);
  const valve = mesh(root, new THREE.TorusGeometry(.19, .022, 6, 16), rust, -5.8, 1.3, 3.8); valve.rotation.y = Math.PI / 2;
  box(root, [.12, 1.1, .75], steel, [-5.95, 1.5, 1.6]);
  box(root, [.03, .55, .46], edge, [-5.87, 1.55, 1.6]);

  // Workbench, tool board and drawers.
  box(root, [3.65, .14, 1.1], timber, [-3.66, 1.01, -3.3]);
  for (const x of [-5.26, -2.09]) for (const z of [-3.7, -2.9]) box(root, [.11, 1, .11], steel, [x, .5, z]);
  box(root, [3.1, 1.35, .09], timber, [-3.6, 2.11, -4.03]);
  for (let i = 0; i < 12; i++) {
    const x = -4.95 + i * .245;
    rod(root, [x, 1.75, -3.94], [x, 2.1 + rng() * .48, -3.94], .024, edge);
    const handle = box(root, [.085, .15, .035], i % 3 ? steel : rust, [x, 1.8, -3.93]);
    handle.rotation.z = -.08 + rng() * .16;
  }
  const redBox = new THREE.MeshStandardMaterial({ color: '#844633', roughness: .6, metalness: .36 });
  box(root, [1.2, .77, .85], redBox, [-3.8, .4, -3.27]);
  for (let i = 0; i < 4; i++) {
    box(root, [1.1, .014, .025], darkMaterial(), [-3.8, .17 + i * .165, -2.825]);
    box(root, [.64, .025, .05], edge, [-3.8, .23 + i * .165, -2.795]);
  }
  for (let i = 0; i < 3; i++) {
    mesh(root, new THREE.CylinderGeometry(.085, .085, .27 + i * .06, 10), i === 1 ? yellow : rust, -4.6 + i * .22, 1.22, -3.45);
  }
  box(root, [.6, .21, .34], steel, [-2.7, 1.18, -3.2]);
  rod(root, [-2.88, 1.3, -3.2], [-2.55, 1.3, -3.2], .027, edge);

  // Tire rack and an upright pressure tank.
  for (const x of [-5.5, -3.4]) for (const z of [-.85, .1]) box(root, [.075, 2.5, .075], steel, [x, 1.25, z]);
  for (const y of [.25, 1.35, 2.45]) box(root, [2.22, .08, 1.05], edge, [-4.45, y, -.36]);
  for (const y of [.69, 1.8]) for (let i = 0; i < 4; i++) {
    const tire = mesh(root, new THREE.TorusGeometry(.32, .115, 10, 24), rubber, -5.26 + i * .53, y, -.35);
    tire.rotation.y = Math.PI / 2;
  }
  mesh(root, new THREE.CylinderGeometry(.32, .32, 1.05, 16), redBox, 5.45, .58, -.8);
  mesh(root, new THREE.SphereGeometry(.32, 16, 8), redBox, 5.45, 1.1, -.8);
  box(root, [.57, .22, .45], steel, [5.45, 1.34, -.8]);
  const hose = new THREE.CatmullRomCurve3([new THREE.Vector3(5.5, 1.3, -.6), new THREE.Vector3(5.85, .3, .1), new THREE.Vector3(4.9, .03, .5), new THREE.Vector3(4.7, .03, -.3)]);
  mesh(root, new THREE.TubeGeometry(hose, 24, .022, 5, false), rubber);

  const signMaterial = new THREE.MeshStandardMaterial({ map: labelMap('BAY 01', 'MUMU / HARBOR MOTOR WORKS'), roughness: .65 });
  box(root, [1.9, 1.15, .075], signMaterial, [-.25, 2.65, -4.12]);
  // Bay lines are painted into the scene rather than screen-space decoration.
  for (const x of [-1.85, 1.85]) box(root, [.055, .006, 5.4], yellow, [x, .006, .5]);
  for (const z of [-2.2, 3.2]) for (const x of [-1.45, 1.45]) box(root, [.8, .006, .055], yellow, [x, .006, z]);
  box(root, [2.5, .015, .28], steel, [3.3, .009, 2.4]);
  for (let x = 2.1; x < 4.55; x += .12) box(root, [.032, .02, .24], edge, [x, .02, 2.4]);
  for (let i = 0; i < 12; i++) {
    const stain = mesh(root, new THREE.CircleGeometry(.1 + rng() * .18, 10), new THREE.MeshStandardMaterial({ color: '#444b41', transparent: true, opacity: .2, roughness: .52, depthWrite: false }), -5 + rng() * 10, .012, -3 + rng() * 7);
    stain.rotation.x = -Math.PI / 2; stain.scale.y = .35 + rng() * .7; stain.castShadow = false;
  }

  const puddleShape = new THREE.Shape();
  for (let i = 0; i <= 32; i++) {
    const a = i / 32 * Math.PI * 2, r = 1 + .13 * Math.sin(a * 3) + .08 * Math.cos(a * 7);
    const x = Math.cos(a) * r * 2.35, y = Math.sin(a) * r * .78;
    if (!i) puddleShape.moveTo(x, y); else puddleShape.lineTo(x, y);
  }
  const puddle = new Reflector(new THREE.ShapeGeometry(puddleShape), { color: 0x858c81, textureWidth: 512, textureHeight: 512, clipBias: .003, multisample: 0 });
  // Blend a soft reflection over visible concrete, rather than cut a dark mirror into it.
  puddle.material.fragmentShader = puddle.material.fragmentShader
    .replace('vec4 base = texture2DProj( tDiffuse, vUv );', `
      vec2 uv = vUv.xy / vUv.w;
      vec4 base = texture2D(tDiffuse, uv) * .4;
      base += texture2D(tDiffuse, uv + vec2(.003, 0.)) * .15;
      base += texture2D(tDiffuse, uv - vec2(.003, 0.)) * .15;
      base += texture2D(tDiffuse, uv + vec2(0., .003)) * .15;
      base += texture2D(tDiffuse, uv - vec2(0., .003)) * .15;
    `)
    .replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );', 'gl_FragColor = vec4( blendOverlay( base.rgb, color ), 0.24 );');
  puddle.material.transparent = true; puddle.material.depthWrite = false;
  puddle.rotation.x = -Math.PI / 2; puddle.position.set(.5, .014, 3.68); root.add(puddle);

  const lampMaterial = new THREE.MeshStandardMaterial({ color: '#fff0be', emissive: '#ffd59b', emissiveIntensity: 2 });
  const lamps = [];
  for (const x of [-4.3, .3, 4.4]) {
    box(root, [.84, .11, .22], steel, [x, 3.25, -3.75]);
    box(root, [.73, .038, .16], lampMaterial, [x, 3.18, -3.75]);
    const lamp = new THREE.PointLight('#ffc887', 16, 6, 2); lamp.position.set(x, 2.97, -3.25); root.add(lamp); lamps.push(lamp);
  }
  // Small plants soften the masonry without filling the central work area.
  for (const [x, z] of [[-5.5, 3.8], [5.7, -4]]) {
    mesh(root, new THREE.CylinderGeometry(.23, .16, .38, 8), rust, x, .19, z);
    const green = new THREE.MeshStandardMaterial({ color: '#5e714c', roughness: .95 });
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      rod(root, [x, .35, z], [x + Math.cos(a) * .3, .7 + rng() * .35, z + Math.sin(a) * .3], .035, green, 4);
    }
  }
  const details = addWorkshopDetails(root);
  return { root, puddle, lamps, lampMaterial, shutter, details };
}

function darkMaterial() { return new THREE.MeshStandardMaterial({ color: '#17231e', roughness: .75 }); }
