import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Keep moving shutter/fan parts separate; batch only opaque, static workshop props.
export function batchStaticMeshes(root) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert(), buckets = new Map();
  root.traverse(object => {
    if (!object.isMesh || object.isInstancedMesh || object.isReflector || Array.isArray(object.material) || object.material.transparent) return;
    for (let parent = object; parent; parent = parent.parent) if (parent.userData.dynamic) return;
    if (!object.geometry.attributes.normal || !object.geometry.attributes.uv) return;
    const key = `${object.material.uuid}:${object.castShadow}:${object.receiveShadow}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(object);
  });
  const retired = new Set();
  for (const objects of buckets.values()) {
    if (objects.length < 2) continue;
    const geometries = objects.map(object => {
      const source = object.geometry.clone();
      const normalized = source.index ? source.toNonIndexed() : source;
      if (normalized !== source) source.dispose();
      for (const name of Object.keys(normalized.attributes)) if (!['position', 'normal', 'uv'].includes(name)) normalized.deleteAttribute(name);
      return normalized.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
    });
    const merged = mergeGeometries(geometries, false); geometries.forEach(geometry => geometry.dispose());
    if (!merged) continue;
    const batch = new THREE.Mesh(merged, objects[0].material);
    batch.castShadow = objects[0].castShadow; batch.receiveShadow = objects[0].receiveShadow;
    batch.name = 'static-prop-batch'; root.add(batch);
    for (const object of objects) { retired.add(object.geometry); object.removeFromParent(); }
  }
  root.traverse(object => { if (object.geometry) retired.delete(object.geometry); });
  retired.forEach(geometry => geometry.dispose());
}
