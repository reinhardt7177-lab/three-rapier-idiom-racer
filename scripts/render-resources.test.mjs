import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSceneDisposer } from '../src/rendering/sceneResources.js';
import { createPalms } from '../src/scenery/beachScenery.js';

function disposalCount(resource) {
  let calls = 0;
  resource.addEventListener('dispose', () => calls++);
  return () => calls;
}

test('shared geometry, material arrays and maps are disposed once, including hidden scenery', () => {
  const scene = new THREE.Scene(), geometry = new THREE.BoxGeometry(), texture = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ map: texture, roughnessMap: texture });
  const other = new THREE.MeshStandardMaterial({ map: texture });
  const hidden = new THREE.Mesh(geometry, [material, other, material]); hidden.visible = false;
  scene.add(new THREE.Mesh(geometry, material), hidden);
  const counts = [geometry, texture, material, other].map(disposalCount);
  const dispose = createSceneDisposer(scene);
  dispose(); dispose();
  assert.deepEqual(counts.map(count => count()), [1, 1, 1, 1]);
});

test('shader uniforms, arrays and scene textures share a single disposal without following cycles forever', () => {
  const scene = new THREE.Scene(), texture = new THREE.Texture();
  const nested = { maps: [texture, { map: texture }] }; nested.self = nested;
  const material = new THREE.ShaderMaterial({ uniforms: { detail: { value: nested } } });
  scene.background = scene.environment = texture;
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(), material));
  const count = disposalCount(texture);
  createSceneDisposer(scene)();
  assert.equal(count(), 1);
});

test('instanced GPU-buffer owners and lights release once along with both shadow targets', () => {
  const scene = new THREE.Scene(), palms = createPalms([{ x: 0, z: 0, height: 8 }]);
  const sun = new THREE.DirectionalLight();
  sun.shadow.map = new THREE.WebGLRenderTarget(8, 8);
  sun.shadow.mapPass = new THREE.WebGLRenderTarget(8, 8);
  scene.add(palms, sun);
  const counts = [...palms.children, sun, sun.shadow.map, sun.shadow.mapPass].map(disposalCount);
  // Even an explicitly listed light-owned target must not be disposed twice.
  const dispose = createSceneDisposer(scene, { renderTargets: [sun.shadow.map] });
  dispose(); dispose();
  assert.ok(counts.every(count => count() === 1));
});

test('environment and reflection owners dispose once without separately disposing their attachment textures', () => {
  const scene = new THREE.Scene();
  const environment = new THREE.WebGLRenderTarget(8, 8), reflection = new THREE.WebGLRenderTarget(8, 8);
  reflection.depthTexture = new THREE.DepthTexture(8, 8);
  scene.environment = environment.texture;
  const material = new THREE.ShaderMaterial({ uniforms: {
    tDiffuse: { value: reflection.texture }, depth: { value: reflection.depthTexture },
  } });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(), material));
  const targets = [environment, reflection].map(disposalCount);
  const attachments = [environment.texture, reflection.texture, reflection.depthTexture].map(disposalCount);
  const countMaterial = disposalCount(material);
  const dispose = createSceneDisposer(scene, { renderTargets: [environment, reflection, reflection] });
  dispose(); dispose();
  assert.deepEqual(targets.map(count => count()), [1, 1]);
  assert.deepEqual(attachments.map(count => count()), [0, 0, 0]);
  assert.equal(countMaterial(), 1);
});

test('a fresh runtime receives its own cleanup after an earlier scene was disposed', () => {
  for (let i = 0; i < 20; i++) {
    const scene = new THREE.Scene(), mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial(), 2);
    scene.add(mesh);
    const counts = [mesh, mesh.geometry, mesh.material].map(disposalCount);
    const dispose = createSceneDisposer(scene);
    dispose(); dispose();
    assert.deepEqual(counts.map(count => count()), [1, 1, 1]);
  }
});
