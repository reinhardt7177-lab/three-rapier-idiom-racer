import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createGT } from '../garage/gt.js';
import { box } from '../garage/procedural.js';
import { initPhysics, createVehiclePhysics, BARRIERS, STEP, VEHICLE } from './physics.js';
import { createChaseCamera } from './chaseCamera.js';
import { createRoadDetails } from './roadDetails.js';
import { createDrivingAudio } from './drivingAudio.js';
import { createHarborSector } from './harborSector.js';
import { HARBOR_SECTOR } from './harborSectorSpec.js';
import { createPublicRoad } from './publicRoad.js';
import { newStory, startStory, advanceIntro, updateStory, storyHint, saveStory, STORY_START, STORY_STOP } from './story.js';
import { createCoastWorld } from './coastWorld.js';
import { COAST_START, coastStatus, nearestRoad, offsetPoint } from './coastRoute.js';
import { applyWheelPose } from './steering.js';
import { createDriveInput, graphicsBudget, compactCamera, viewLayout } from './hudSettings.js';
import { newJourney, continueJourney, updateJourney, interruptJourney, journeyHint, journeyLocked, saveJourney, SIGNAL_STATION } from './journey.js';
import { createSignalStation } from './signalStation.js';

export async function createDriving(host, onStats, color, signal, options = {}) {
  await initPhysics();
  if (signal.aborted) return null;
  const sim = createVehiclePhysics({ harbor: true, coast: !!options.coast, ...(options.coast ? { start: COAST_START } : options.story ? { start: STORY_START } : {}) });
  let story = options.story ? newStory() : null;
  let journey = options.journey ? newJourney() : null;
  let excursion = { lookout: false, returned: false };
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
  catch (error) { sim.dispose(); throw error; }
  let quality = options.quality === 'light' ? 'light' : 'standard';
  renderer.setPixelRatio(graphicsBudget(quality, host.clientWidth, host.clientHeight, devicePixelRatio).ratio);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', options.story ? '항만대로 이야기 주행' : 'GT 차량 주행 테스트');
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#9ead9f'); scene.fog = new THREE.Fog('#9ead9f', 170, 730);
  const camera = new THREE.PerspectiveCamera(57, 1, .1, 1700);
  const chase = createChaseCamera(camera), audio = createDrivingAudio();
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment(), environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture; scene.environmentIntensity = .5; pmrem.dispose(); room.dispose();
  scene.add(new THREE.HemisphereLight('#d5dfcd', '#414c3c', 1.5));
  const sun = new THREE.DirectionalLight('#ffe0ad', 3.2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 100 });
  sun.shadow.normalBias = .04; scene.add(sun, sun.target);
  let details, harborSector, publicRoad;
  if (options.coast) {
    harborSector = createCoastWorld(); scene.add(harborSector.root);
  } else {
  const mat = (color, roughness = .9) => new THREE.MeshStandardMaterial({ color, roughness });
  const asphalt = mat('#3d4645'), shoulder = mat('#56615b'), white = mat('#e3dfc6'), orange = mat('#bc6846'), concrete = mat('#a6a899'), sea = mat('#447f8c', .35), green = mat('#68745c');
  details = createRoadDetails(); scene.add(details.root); asphalt.map = details.texture;
  harborSector = createHarborSector(); scene.add(harborSector.root);
  publicRoad = createPublicRoad(); scene.add(publicRoad.root);
  box(scene, [500, 1, 2050], green, [130, -.75, 0]);
  box(scene, [1000, .2, 2400], sea, [-590, -.5, 0]);
  for (const [from, to, width] of [[-900, HARBOR_SECTOR.start, 102], [HARBOR_SECTOR.start, HARBOR_SECTOR.end, 32], [HARBOR_SECTOR.end, 900, 102]]) box(scene, [width, .12, to - from], shoulder, [0, -.07, (from + to) / 2]);
  box(scene, [20, .025, 1798], asphalt, [0, .003, 0]);
  for (const x of [-9.8, 9.8]) box(scene, [.14, .012, 1798], white, [x, .024, 0]);
  const matrix = new THREE.Matrix4();
  for (const b of BARRIERS) { const m = box(scene, [b.hx * 2, 1.6, b.hz * 2], concrete, [b.x, .8, b.z]); m.receiveShadow = true; }
  // Solid offset blocks form a low-speed avoidance area; the centre straight stays open.
  for (const b of BARRIERS.slice(4)) box(scene, [b.hx * 2, .14, 1.24], orange, [b.x, 1.65, b.z]);
  const treeGeo = new THREE.ConeGeometry(3, 9, 6), trees = new THREE.InstancedMesh(treeGeo, green, 65);
  for (let i = 0; i < 65; i++) trees.setMatrixAt(i, matrix.makeTranslation(80 + (i % 4) * 19, 5, -910 + i * 29)); scene.add(trees);
  }
  scene.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  const gt = createGT(); gt.setColor(color); gt.paint.roughness = .42; gt.paint.clearcoat = .45; gt.root.rotation.y = 0; scene.add(gt.root);
  const station = options.coast ? createSignalStation() : null;
  if (station) scene.add(station.root);
  const input = createDriveInput();
  let frame, alive = true, paused = false, inspection = false, last = performance.now(), accumulator = 0, publish = 0, cameraSnap = true;
  let current = sim.snapshot(), previous = current;
  const pos = new THREE.Vector3(), currentPos = new THREE.Vector3(), q = new THREE.Quaternion(), oldQ = new THREE.Quaternion(), forward = new THREE.Vector3(), sunOffset = new THREE.Vector3(-20, 35, 12);
  let cameraMetrics = { distance: 0, fov: camera.fov };
  const locked = () => (!!story && story.phase !== 'drive') || journeyLocked(journey);
  const report = () => {
    current.inspection = inspection;
    current.layout = viewLayout(host.clientWidth, host.clientHeight);
    current.quality = quality; current.pixelRatio = renderer.getPixelRatio(); current.shadowSize = sun.shadow.mapSize.x;
    current.journey = journey ? { ...journey, ...journeyHint(journey, current) } : null;
    if (options.coast) excursion = coastStatus(current, excursion);
    onStats({ ...current, paused, coast: options.coast ? excursion : null, story: story ? { ...story, ...storyHint(story, current), distance: Math.round(Math.hypot(current.position.x - STORY_STOP.x, current.position.z - STORY_STOP.z)) } : null, cameraDistance: cameraMetrics.distance, cameraFov: cameraMetrics.fov, audio: audio.status(), sector: options.coast ? excursion.area : current.position.z >= HARBOR_SECTOR.start && current.position.z <= HARBOR_SECTOR.end ? '항만대로 · 공도' : '해안도로 · 계측 구간', drawCalls: renderer.info.render.calls });
  };
  const has = (...codes) => input.has(...codes);
  function clearInput() { input.clear(); }
  function setInspection(value) {
    if (value && (current.kmh >= 1 || locked())) return;
    inspection = !!value; paused = false; clearInput(); accumulator = 0; last = performance.now(); cameraSnap = true; audio.setPaused(locked()); report();
    renderer.domElement.focus({ preventScroll: true });
  }
  function setPaused(value) { paused = value; clearInput(); audio.setPaused(value || locked()); last = performance.now(); accumulator = 0; report(); if (!paused) renderer.domElement.focus({ preventScroll: true }); }
  function reset() { inspection = false; clearInput(); sim.reset(); current = previous = sim.snapshot(); if (story) story = newStory(); if (journey) journey = newJourney(); excursion = { lookout: false, returned: false }; accumulator = 0; cameraSnap = true; audio.update(current, 0); audio.setPaused(paused || locked()); report(); renderer.domElement.focus({ preventScroll: true }); }
  function recoverRoad() {
    if (!options.coast || locked()) return;
    inspection = false;
    journey = interruptJourney(journey);
    const near = nearestRoad(current.position), q = current.rotation;
    const fx = 2 * (q.x * q.z + q.w * q.y), fz = 1 - 2 * (q.x * q.x + q.y * q.y);
    const direction = fx * near.tx + fz * near.tz >= 0 ? 1 : -1;
    const p = offsetPoint(near, direction * 3.5);
    clearInput(); sim.reset({ x: p.x, y: .8, z: p.z }, Math.atan2(near.tx * direction, near.tz * direction));
    current = previous = sim.snapshot(); accumulator = 0; cameraSnap = true; audio.update(current, 0); report(); renderer.domElement.focus({ preventScroll: true });
  }
  function skipIntro() { if (!story || story.phase !== 'intro' || paused) return; story = startStory(story); clearInput(); accumulator = 0; last = performance.now(); cameraSnap = true; audio.setPaused(false); report(); renderer.domElement.focus({ preventScroll: true }); }
  function advanceJourney() { if (!journey || paused) return; journey = continueJourney(journey); clearInput(); accumulator = 0; last = performance.now(); cameraSnap = true; audio.setPaused(locked()); report(); renderer.domElement.focus({ preventScroll: true }); }
  const handled = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyB', 'KeyR', 'KeyC', 'Escape'];
  function keydown(event) {
    if (!handled.includes(event.code) || event.target.closest?.('button,input,textarea,select,dialog')) return;
    event.preventDefault();
    if (event.code === 'Escape' && !event.repeat) { setPaused(!paused); return; }
    if (event.code === 'KeyR' && !event.repeat) { reset(); return; }
    if (event.code === 'KeyC' && !event.repeat) { recoverRoad(); return; }
    if (!paused && !locked()) input.key(event.code, true);
  }
  const keyup = e => input.key(e.code, false);
  const blur = () => setPaused(true);
  const visibility = () => { if (document.hidden) { setPaused(true); cancelAnimationFrame(frame); } else if (alive) { last = performance.now(); frame = requestAnimationFrame(render); } };
  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility);
  let lastSize = null;
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    const budget = graphicsBudget(quality, width, height, devicePixelRatio);
    renderer.setPixelRatio(budget.ratio); renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.fov = compactCamera(width, height) ? 65 : 57; camera.updateProjectionMatrix(); cameraSnap = true;
    if (sun.shadow.mapSize.x !== budget.shadowSize) { sun.shadow.map?.dispose(); sun.shadow.map = null; sun.shadow.mapSize.set(budget.shadowSize, budget.shadowSize); sun.shadow.needsUpdate = true; }
    if (lastSize && (Math.abs(lastSize.width - width) > 20 || Math.abs(lastSize.height - height) > 100)) setPaused(true);
    lastSize = { width, height };
  }
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  function render(now) {
    if (!alive) return;
    const dt = Math.min((now - last) / 1000, .1); last = now;
    if (!paused && story?.phase === 'intro') {
      story = advanceIntro(story, dt);
      if (story.phase === 'drive') { cameraSnap = true; audio.setPaused(false); }
    }
    if (!paused && !locked()) {
      accumulator += dt;
      while (accumulator >= STEP) {
        previous = current;
        current = sim.step({ throttle: inspection ? 0 : +has('KeyW', 'ArrowUp'), reverse: inspection ? 0 : +has('KeyS', 'ArrowDown'), steer: +has('KeyD', 'ArrowRight') - +has('KeyA', 'ArrowLeft'), brake: inspection ? 1 : +has('KeyB'), handbrake: !inspection && has('Space') });
        accumulator -= STEP;
        if (journey && !inspection) {
          const phase = journey.phase;
          journey = updateJourney(journey, previous, current, STEP);
          if (journey.phase !== phase && journeyLocked(journey)) {
            if (journey.phase === 'complete') { try { journey.saved = saveJourney(window.localStorage); } catch { journey.saved = false; } }
            clearInput(); accumulator = 0; audio.setPaused(true); cameraSnap = true; break;
          }
        }
        if (story) {
          story = updateStory(story, previous, current, STEP);
          if (story.phase === 'complete') {
            try { story.saved = saveStory(window.localStorage); } catch { story.saved = false; }
            clearInput(); accumulator = 0; audio.setPaused(true); break;
          }
        }
      }
      if (current.position.y < -8) { if (options.coast) recoverRoad(); else reset(); }
    }
    const a = paused || locked() ? 1 : accumulator / STEP;
    currentPos.set(current.position.x, current.position.y, current.position.z);
    pos.set(previous.position.x, previous.position.y, previous.position.z).lerp(currentPos, a);
    q.set(current.rotation.x, current.rotation.y, current.rotation.z, current.rotation.w);
    oldQ.set(previous.rotation.x, previous.rotation.y, previous.rotation.z, previous.rotation.w).slerp(q, a);
    gt.root.position.copy(pos); gt.root.quaternion.copy(oldQ); gt.root.translateY(-VEHICLE.modelOffset);
    applyWheelPose(gt.wheels, previous.wheels, current.wheels, a);
    gt.brakeLight.emissiveIntensity = current.brake > .1 || current.drifting ? 3 : .7;
    forward.set(0, 0, 1).applyQuaternion(oldQ); forward.y = 0; forward.normalize();
    if (inspection && !locked()) {
      const offset = new THREE.Vector3(-6, 3.6, 7.5).applyQuaternion(oldQ);
      camera.position.copy(pos).add(offset); camera.lookAt(pos.x, pos.y + .4, pos.z);
      camera.fov = compactCamera(host.clientWidth, host.clientHeight) ? 64 : 42; camera.updateProjectionMatrix();
      cameraMetrics = { distance: offset.length(), fov: camera.fov }; cameraSnap = true;
    } else if (journeyLocked(journey)) {
      // Only a fully stopped car enters the arrival shot; never seize a driving camera.
      const atSignal = journey.phase === 'signal';
      const target = atSignal ? new THREE.Vector3((pos.x + SIGNAL_STATION.x) / 2, 2.2, (pos.z + SIGNAL_STATION.z) / 2) : pos.clone().add(new THREE.Vector3(0, .7, 0));
      const portrait = host.clientWidth < host.clientHeight;
      camera.position.copy(target).add(atSignal ? new THREE.Vector3(-28, 24, -36).multiplyScalar(portrait ? 1.35 : 1) : new THREE.Vector3(-11, 5.8, -13));
      // Reserve the lower portrait area for text, not the subject of the shot.
      camera.lookAt(target.x, target.y - (portrait ? 6 : 0), target.z); camera.fov = portrait ? 65 : 50; camera.updateProjectionMatrix(); cameraSnap = true;
    } else if (locked()) {
      const shot = story.phase === 'complete' ? 1 : Math.min(2, Math.floor(story.introTime / 5));
      const moving = !motionQuery.matches && options.motion !== false;
      const slide = moving ? (story.introTime % 5) / 5 : .5;
      const offsets = [[-12 + slide * 3, 7, -15], [-7, 2.7, 6 - slide * 3], [3.5, 2.5, -8]];
      // Arrival is filmed from the road side: the sea-side shelter roof must not occlude the GT.
      const offset = story.phase === 'complete' ? [6, 4.2, 7] : offsets[shot];
      camera.position.copy(pos).add(new THREE.Vector3(...offset));
      camera.lookAt(pos.x, pos.y + .5, pos.z); camera.fov = compactCamera(host.clientWidth, host.clientHeight) ? 65 : 50; camera.updateProjectionMatrix();
      cameraSnap = true;
    } else { cameraMetrics = chase.update(pos, forward, current.kmh, dt, { compact: compactCamera(host.clientWidth, host.clientHeight), snap: cameraSnap, motion: !motionQuery.matches && options.motion !== false }); cameraSnap = false; }
    publicRoad?.setDestination(story?.phase === 'drive');
    audio.update(current, inspection ? 0 : +has('KeyW', 'ArrowUp'));
    harborSector.update(paused ? 0 : dt, !motionQuery.matches && options.motion !== false);
    station?.setConfirmed(journey?.phase === 'signal' || journey?.phase === 'return' || journey?.phase === 'complete');
    sun.position.copy(pos).add(sunOffset); sun.target.position.copy(pos);
    renderer.render(scene, camera);
    publish += dt; if (publish >= .1) { publish = 0; report(); }
    frame = requestAnimationFrame(render);
  }
  audio.setPaused(locked()); renderer.domElement.focus({ preventScroll: true }); frame = requestAnimationFrame(render);
  return { reset, setPaused, skipIntro, recoverRoad, setInspection, advanceJourney,
    clearInput,
    setQuality(value) { quality = value === 'light' ? 'light' : 'standard'; resize(); report(); },
    async setSound(enabled) { await audio.setEnabled(enabled); if (alive) { report(); if (!paused) renderer.domElement.focus({ preventScroll: true }); } },
    setVolume(value) { audio.setVolume(value); report(); },
    setInput(code, down, pointerId = code) { input.pointer(pointerId, code, !paused && !locked() && down); },
    dispose() {
      alive = false; cancelAnimationFrame(frame); clearInput(); audio.dispose(); observer.disconnect();
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility);
      const geometry = new Set(), materials = new Set(); scene.traverse(o => { if (o.geometry) geometry.add(o.geometry); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); });
      geometry.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); details?.texture.dispose(); harborSector.dispose(); publicRoad?.dispose(); station?.dispose(); environment.dispose(); renderer.dispose(); renderer.domElement.remove(); sim.dispose();
    },
  };
}
