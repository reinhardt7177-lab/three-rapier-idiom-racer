import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createGT } from './gt.js';
import { createWorkshop } from './workshop.js';
import { createHarbor } from './harbor.js';
import { batchStaticMeshes } from './batchStatic.js';
import { normalizePreferences } from './preferences.js';

export function createGarage(host, onStats, initialPreferences = {}) {
  const initial = normalizePreferences(initialPreferences);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-label', '코드로 제작한 항구 차고 3D 시안');
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#253731');
  scene.fog = new THREE.Fog('#253731', 33, 100);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment(); const environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture; scene.environmentIntensity = .55; room.dispose(); pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 160);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .08;
  controls.enablePan = false; controls.minDistance = 5; controls.maxDistance = 55;
  controls.minPolarAngle = .4; controls.maxPolarAngle = Math.PI / 2 - .08;
  controls.minAzimuthAngle = -.45; controls.maxAzimuthAngle = 1.45;

  const ambient = new THREE.HemisphereLight('#cedbcc', '#414135', 1.4); scene.add(ambient);
  const sun = new THREE.DirectionalLight('#ffe0ae', 4.2); sun.position.set(3.8, 7.5, -2.7);
  sun.target.position.set(-1, 0, 1); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 10, bottom: -10, near: .1, far: 32 });
  sun.shadow.normalBias = .025; sun.shadow.bias = -.00012;
  const fill = new THREE.DirectionalLight('#a5caca', 1.0); fill.position.set(4, 4, 7); scene.add(fill);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#233a32', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.52; floor.receiveShadow = true; scene.add(floor);
  const workshop = createWorkshop(); batchStaticMeshes(workshop.root); scene.add(workshop.root);
  const harbor = createHarbor(); batchStaticMeshes(harbor.root); scene.add(harbor.root);
  const gt = createGT(); gt.root.position.set(-.1, -.04, .65); scene.add(gt.root);

  let targetView = null, motionEnabled = initial.motion, currentView = 'garage';
  function setView(name = 'garage', immediate = false) {
    const views = {
      garage: { eye: [13.5, 12.1, 17.5], target: [-.2, .7, -.6] },
      car: { eye: [5.4, 3.1, 7.8], target: [-.1, .8, .65] },
      side: { eye: [7.8, 2.9, 2.4], target: [-.1, .8, .65] },
      harbor: { eye: [10, 10, 11], target: [-.8, 1, -5] },
    };
    const v = views[name] || views.garage;
    if (host.clientWidth < 700 && name === 'garage') v.eye = [18, 17, 26];
    if (host.clientWidth < 700 && name === 'harbor') v.eye = [15, 11, 17];
    currentView = name;
    targetView = { eye: new THREE.Vector3(...v.eye), target: new THREE.Vector3(...v.target) };
    if (immediate || !motionEnabled) { camera.position.copy(targetView.eye); controls.target.copy(targetView.target); targetView = null; controls.update(); }
  }
  const cancelView = () => { targetView = null; currentView = null; }; controls.addEventListener('start', cancelView);
  setView('garage', true);
  let compact = host.clientWidth < 700;
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false); camera.aspect = width / height;
    camera.fov = width < 700 ? 48 : 38;
    camera.updateProjectionMatrix();
    if (compact !== (width < 700)) { compact = width < 700; if (currentView) setView(currentView, true); }
  }
  const observer = new ResizeObserver(resize); observer.observe(host); resize();

  let active = true, frame = 0, last = performance.now(), statsStart = last, frames = 0;
  function render(now) {
    if (!active) return;
    const dt = Math.min((now - last) / 1000, .05); last = now;
    if (targetView) {
      const blend = 1 - Math.exp(-dt * 5);
      camera.position.lerp(targetView.eye, blend); controls.target.lerp(targetView.target, blend);
      if (camera.position.distanceToSquared(targetView.eye) < .0001) targetView = null;
    }
    workshop.shutter.update(dt, !motionEnabled);
    if (motionEnabled) { workshop.details.update(dt); harbor.update(dt); }
    controls.update(); renderer.render(scene, camera); frames++;
    if (frames === 1) statsStart = now;
    if (frames >= 8 && now - statsStart > 1000) {
      onStats?.({ fps: Math.round(frames * 1000 / (now - statsStart)), calls: renderer.info.render.calls });
      frames = 0; statsStart = now;
    }
    frame = requestAnimationFrame(render);
  }
  function onVisibility() {
    cancelAnimationFrame(frame);
    if (!document.hidden && active) { last = statsStart = performance.now(); frames = 0; frame = requestAnimationFrame(render); }
  }
  document.addEventListener('visibilitychange', onVisibility);

  function setWarm(enabled) {
    sun.color.set(enabled ? '#ffe0ae' : '#e4f0ff'); sun.intensity = enabled ? 4.2 : 3;
    ambient.intensity = enabled ? 1.4 : 1.9;
    workshop.lamps.forEach(lamp => { lamp.intensity = enabled ? 16 : 0; });
    workshop.lampMaterial.emissiveIntensity = enabled ? 2 : .1;
  }
  gt.setColor(initial.color); workshop.puddle.visible = initial.wet;
  setWarm(initial.warm); workshop.shutter.setOpen(initial.shutterOpen, true);
  controls.enableDamping = motionEnabled;
  frame = requestAnimationFrame(render);

  return {
    setColor: gt.setColor,
    setView,
    setWet: (enabled) => { workshop.puddle.visible = enabled; },
    setWarm,
    setShutterOpen: enabled => { workshop.shutter.setOpen(enabled, !motionEnabled); },
    setMotion: enabled => { motionEnabled = enabled; controls.enableDamping = enabled; if (!enabled && targetView) setView(currentView || 'garage', true); },
    dispose: () => {
      active = false; cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', onVisibility); observer.disconnect(); controls.removeEventListener('start', cancelView); controls.dispose();
      const geometries = new Set(), materials = new Set(), textures = new Set();
      scene.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
          for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
        }
      });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
      workshop.puddle.getRenderTarget().dispose(); environment.dispose();
      renderer.dispose(); renderer.domElement.remove();
    },
  };
}
