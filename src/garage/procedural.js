import * as THREE from 'three';

export function randomSeed(seed = 17) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

export function canvasMap(draw, size = 512, color = true) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  map.anisotropy = 4;
  return map;
}

export function concreteMap() {
  const rng = randomSeed(431);
  return canvasMap((ctx, size) => {
    ctx.fillStyle = '#727870'; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 32000; i++) {
      const v = 75 + Math.floor(rng() * 90);
      ctx.fillStyle = `rgba(${v},${v + 3},${v},${rng() * .2})`;
      ctx.fillRect(rng() * size, rng() * size, 1 + rng() * 3, 1 + rng() * 3);
    }
    for (let i = 0; i < 50; i++) {
      const x = rng() * size, y = rng() * size;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 15 + rng() * 65);
      grad.addColorStop(0, 'rgba(36,44,39,.12)'); grad.addColorStop(1, 'rgba(36,44,39,0)');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size);
    }
  });
}

export function labelMap(title, subtitle = '') {
  return canvasMap((ctx, s) => {
    ctx.fillStyle = '#233731'; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#9b9e7c'; ctx.lineWidth = 5; ctx.strokeRect(16, 16, s - 32, s - 32);
    ctx.fillStyle = '#e7dfbc'; ctx.textAlign = 'center';
    ctx.font = 'bold 90px sans-serif'; ctx.fillText(title, s / 2, s * .48);
    ctx.font = '24px sans-serif'; ctx.fillText(subtitle, s / 2, s * .65);
  });
}

export function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(x, y, z); item.castShadow = true; item.receiveShadow = true;
  parent.add(item); return item;
}

export function box(parent, size, material, position = [0, 0, 0]) {
  return mesh(parent, new THREE.BoxGeometry(...size), material, ...position);
}

export function rod(parent, a, b, radius, material, sides = 8) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
  const item = mesh(parent, new THREE.CylinderGeometry(radius, radius, start.distanceTo(end), sides), material);
  item.position.copy(start).add(end).multiplyScalar(.5);
  item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
  return item;
}

export function panel(parent, points, material) {
  const shape = new THREE.BufferGeometry();
  shape.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  const indices = [];
  for (let i = 1; i < points.length - 1; i++) indices.push(0, i, i + 1);
  shape.setIndex(indices); shape.computeVertexNormals();
  return mesh(parent, shape, material);
}
