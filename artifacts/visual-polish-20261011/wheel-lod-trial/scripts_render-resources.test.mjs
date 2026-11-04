import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSceneDisposer } from '../src/rendering/sceneResources.js';
import { createPalms } from '../src/scenery/beachScenery.js';
import { createVehicleDetail } from '../src/rebuild/vehicleDetail.js';

function disposalCount(resource) {
  let calls = 0;
  resource.addEventListener('dispose', () => calls++);
  return () => calls;
}

function wheelDetailFixture(){
 const root=new THREE.Group(),pivot=new THREE.Group();root.add(pivot);
 const geometry=new THREE.SphereGeometry(.35,12,8),material=new THREE.MeshStandardMaterial();material.name='Tread grooves';
 const tread=new THREE.Mesh(geometry,material),tyre=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());tyre.material.name='Rubber';
 pivot.add(tread,tyre);const hidden=tread.clone();hidden.visible=false;pivot.add(hidden);
 const camera=new THREE.PerspectiveCamera(60,16/9,.1,1000);camera.position.z=5;
 return {root,pivot,tread,tyre,hidden,camera,detail:createVehicleDetail(root)};
}

test('distant tread LOD preserves continuous tyre, rig, shared geometry and originally hidden objects',()=>{
 const f=wheelDetailFixture(),geometry=f.tread.geometry,material=f.tread.material;
 f.detail.update(f.camera,720);assert.equal(f.tread.visible,true);
 f.camera.position.z=80;f.detail.update(f.camera,720);assert.equal(f.tread.visible,false);
 assert.equal(f.tyre.visible,true);assert.equal(f.hidden.visible,false);assert.equal(f.tread.parent,f.pivot);
 assert.equal(f.tread.geometry,geometry);assert.equal(f.tread.material,material);
 const p=f.detail.snapshot();assert.equal(p.hidden,1);assert.ok(p.trianglesHidden>0);
 f.detail.restore();assert.equal(f.tread.visible,true);assert.equal(f.hidden.visible,false);
 createSceneDisposer(f.root)();
});

test('tread LOD uses projected size, viewport and field of view with stable hysteresis',()=>{
 const f=wheelDetailFixture();f.camera.position.z=30;f.detail.update(f.camera,720);assert.equal(f.tread.visible,false);
 f.camera.position.z=24;f.detail.update(f.camera,720);assert.equal(f.tread.visible,false);
 f.camera.position.z=20;f.detail.update(f.camera,720);assert.equal(f.tread.visible,true);
 f.camera.position.z=30;f.detail.update(f.camera,1440);assert.equal(f.tread.visible,true);
 f.detail.update(f.camera,360);assert.equal(f.tread.visible,false);
 f.camera.fov=20;f.camera.updateProjectionMatrix();f.detail.update(f.camera,720);assert.equal(f.tread.visible,true);
 createSceneDisposer(f.root)();
});

test('player detail override and transformed near-camera tyres remain fully detailed',()=>{
 const f=wheelDetailFixture();f.camera.position.z=100;f.detail.update(f.camera,720,{full:true});assert.equal(f.tread.visible,true);
 f.detail.update(f.camera,720);assert.equal(f.tread.visible,false);
 f.root.position.z=100;f.detail.update(f.camera,720);assert.equal(f.tread.visible,true);
 f.root.position.z=0;f.root.scale.setScalar(10);f.detail.update(f.camera,720);assert.equal(f.tread.visible,true);
 createSceneDisposer(f.root)();
});

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
