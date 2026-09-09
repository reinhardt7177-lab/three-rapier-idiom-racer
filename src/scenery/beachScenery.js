import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { box, mesh, rod, canvasMap } from '../garage/procedural.js';
import { BEACH } from './beachPalette.js';

export function createBeachSky(radius = 1400) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, toneMapped: false,
    uniforms: { topColor: { value: new THREE.Color(BEACH.sky) }, bottomColor: { value: new THREE.Color(BEACH.horizon) } },
    vertexShader: 'varying vec3 vDirection; void main(){ vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; varying vec3 vDirection;
      void main(){ float h=smoothstep(0.0,0.65,normalize(vDirection).y); gl_FragColor=vec4(mix(bottomColor,topColor,h),1.0);
      #include <colorspace_fragment>
      }`,
  }));
  sky.name = 'beach-daylight-sky'; sky.renderOrder = -1000; sky.frustumCulled = false;
  return sky;
}

// A folded, tapered leaf instead of cones or flat rectangular cards.
export function createPalmFrond() {
  const p = [], uv = [], indices = [], steps = 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, x = 4.2 * t, y = Math.sin(t * Math.PI) * .85 - t * t * 1.4;
    const width = .48 * Math.sin(Math.PI * t) + .008;
    for (const side of [-1, 0, 1]) { p.push(x, y - Math.abs(side) * width * .27, side * width); uv.push(t, (side + 1) / 2); }
    if (i) for (let j = 0; j < 2; j++) { const a = (i - 1) * 3 + j, b = i * 3 + j; indices.push(a, b, a + 1, a + 1, b, b + 1); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals();
  return g;
}

// Four draws regardless of tree count; no per-frame foliage animation on tablets.
export function createPalms(entries) {
  const root = new THREE.Group(); root.name = 'beach-palms'; root.userData.palmCount = entries.length;
  if (!entries.length) return root;
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const t = i / 6, next = (i + 1) / 6;
    const a = new THREE.Vector3(.7 * t * t, t * 8, 0), b = new THREE.Vector3(.7 * next * next, next * 8, 0);
    const g = new THREE.CylinderGeometry(.19 - next * .075, .19 - t * .075, a.distanceTo(b) + .025, 7);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
    g.translate(...a.add(b).multiplyScalar(.5).toArray()); parts.push(g);
  }
  const trunkGeo = mergeGeometries(parts); parts.forEach(g => g.dispose());
  const leafGeo = createPalmFrond();
  const trunk = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: BEACH.trunk, roughness: 1 }), entries.length);
  const leaves = [BEACH.leaf, '#6b9f65'].map(color => new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: .92 }), entries.length * 5));
  const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.3, 0), new THREE.MeshStandardMaterial({ color: '#527749', roughness: 1 }), entries.length);
  const tree = new THREE.Object3D(), part = new THREE.Object3D(), matrix = new THREE.Matrix4();
  entries.forEach((e, i) => {
    tree.position.set(e.x, e.y || 0, e.z); tree.rotation.y = e.yaw || 0; tree.scale.setScalar((e.height || 8) / 8); tree.updateMatrix(); trunk.setMatrixAt(i, tree.matrix);
    part.position.set(.7, 7.93, 0); part.rotation.set(0, 0, 0); part.scale.setScalar(1); part.updateMatrix(); crown.setMatrixAt(i, matrix.multiplyMatrices(tree.matrix, part.matrix));
    for (let j = 0; j < 10; j++) {
      part.position.set(.7, 8, 0); part.rotation.set(0, j * Math.PI / 5, j % 2 ? .2 : -.03); part.scale.setScalar(j % 2 ? .83 : 1); part.updateMatrix();
      leaves[j % 2].setMatrixAt(i * 5 + Math.floor(j / 2), matrix.multiplyMatrices(tree.matrix, part.matrix));
    }
  });
  for (const m of [trunk, crown, ...leaves]) { m.castShadow = m.receiveShadow = true; root.add(m); }
  return root;
}

// Original Tropical Deco frontage; retains the existing building footprint.
export function addDecoFront(parent, { x = 23.4, z, index }, materials, textures) {
  const { ivory, steel, glass, coral } = materials;
  const colors = [BEACH.mint, BEACH.coral, BEACH.blue, BEACH.peach];
  const wall = new THREE.MeshStandardMaterial({ color: colors[index % colors.length], roughness: .9 });
  const height = 8.2 + index % 3 * 1.6, front = x - 7;
  box(parent, [14, height, 28], wall, [x, height / 2, z]);
  box(parent, [14.4, .35, 28.5], ivory, [x, height, z]);
  // Stepped central parapet and horizontal 'eyebrow' sunshades.
  for (let level = 0; level < 3; level++) box(parent, [.5, .5, 8 - level * 1.4], ivory, [front - .1, height + .4 + level * .5, z]);
  for (let floor = 0; floor < 3; floor++) {
    const y = 1.6 + floor * 2.35;
    for (const dz of [-10, -5, 5, 10]) {
      box(parent, [.1, 1.65, 3.15], glass, [front - .08, y, z + dz]);
      box(parent, [.14, 1.7, .075], ivory, [front - .16, y, z + dz]);
      box(parent, [.95, .14, 3.7], ivory, [front - .38, y + .94, z + dz]);
    }
    box(parent, [.18, .12, 28.2], ivory, [front - .12, y + 1.18, z]);
    // Approaching drivers see these end walls before the main frontage.
    for (const side of [-1, 1]) {
      for (const dx of [-4.5, 0, 4.5]) {
        box(parent, [2.8, 1.65, .12], glass, [x + dx, y, z + side * 14.08]);
        box(parent, [.07, 1.7, .16], ivory, [x + dx, y, z + side * 14.16]);
        box(parent, [3.4, .14, .85], ivory, [x + dx, y + .94, z + side * 14.3]);
      }
      box(parent, [14.2, .12, .18], ivory, [x, y + 1.18, z + side * 14.1]);
    }
  }
  box(parent, [.17, 2.9, 3.1], glass, [front - .1, 1.5, z]);
  box(parent, [1.5, .16, 5.2], coral, [front - .65, 3.08, z]);
  for (const dz of [-2.45, 2.45]) box(parent, [.09, 2.9, .09], steel, [front - 1.1, 1.5, z + dz]);
  const ring = mesh(parent, new THREE.TorusGeometry(.8, .1, 6, 24), ivory, front - .23, 5.8, z); ring.rotation.y = -Math.PI / 2;
  const disc = mesh(parent, new THREE.CircleGeometry(.7, 24), glass, front - .25, 5.8, z); disc.rotation.y = -Math.PI / 2;
  const names = ['PALM HOUSE', 'CORAL CLUB', 'OCEAN RADIO', 'SEA BREEZE', 'SUN COAST', 'BAY STUDIO'];
  const texture = canvasMap((ctx, s) => { ctx.fillStyle = BEACH.ivory; ctx.fillRect(0, 0, s, s); ctx.fillStyle = BEACH.steel; ctx.textAlign = 'center'; ctx.font = 'bold 54px sans-serif'; ctx.fillText(names[(index - 1) % names.length], s / 2, s * .5); ctx.font = '24px sans-serif'; ctx.fillText('MUMU / BEACH AVENUE', s / 2, s * .65); }); textures.push(texture);
  const sign = mesh(parent, new THREE.PlaneGeometry(6.8, 1.5), new THREE.MeshStandardMaterial({ map: texture, roughness: .9 }), front - .3, height - .8, z); sign.rotation.y = -Math.PI / 2;
}

export function addBeachUmbrella(root, x, z, color, materials) {
  rod(root, [x, 0, z], [x, 2.7, z], .045, materials.ivory);
  const top = mesh(root, new THREE.ConeGeometry(1.8, .65, 12, 1, true), color, x, 2.5, z); top.material.side = THREE.DoubleSide;
  for (const dx of [-.7, .7]) {
    box(root, [.65, .08, 1.65], materials.ivory, [x + dx, .35, z + .8]);
    const back = box(root, [.65, .08, .8], materials.ivory, [x + dx, .62, z + 1.65]); back.rotation.x = -.6;
  }
}
