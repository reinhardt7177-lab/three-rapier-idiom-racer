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
import { newSprint, startSprint, advanceCountdown, updateSprint, sprintLocked, sprintHint, invalidateSprint, loadSprint, recordSprint } from './sprint.js';
import { createSprintMarkers } from './sprintMarkers.js';
import { BEACH } from '../scenery/beachPalette.js';
import { createBeachSky } from '../scenery/beachScenery.js';
import { createDrivingSignals } from './drivingSignals.js';
import { createTireFeedback } from './tireFeedback.js';
import { CHAPTER_ONE, newCampaign, completeChapter, chapterHint } from '../campaign/campaign.js';
import { createSceneDisposer } from '../rendering/sceneResources.js';
import { createFrameLoop } from './frameLoop.js';
import { loadGhost, saveGhost, createGhostRecorder, createGhostSampler, interpolateGhostPose } from './ghost.js';
import { createGhostView } from './ghostView.js';
import { createRival, duelResult } from './rival.js';
import { createDuelReadout } from './duelReadout.js';

export async function createDriving(host, onStats, color, signal, options = {}) {
  await initPhysics();
  if (signal.aborted) return null;
  options={...options,arcade:!!options.duel||(!!options.coast&&!options.sprint&&!options.story&&!options.journey)};
  const sim = createVehiclePhysics({ harbor: true, coast: !!options.coast, arcade:!!options.arcade, ...(options.coast ? { start: COAST_START } : options.story ? { start: STORY_START } : {}) });
  let story = options.story ? newStory() : null;
  let journey = options.journey ? newJourney() : null;
  let best=null; if(!options.duel)try { best=loadSprint(window.localStorage); } catch {}
  let sprint=options.sprint?newSprint(best):null;
  let ghostBest=null; if(sprint&&!options.duel)try{ghostBest=loadGhost(window.localStorage);}catch{}
  let ghostReference=ghostBest, ghostSaved=ghostBest?true:null, ghostEnabled=true, ghostClock=0;
  const recorder=createGhostRecorder(), sampleGhost=createGhostSampler();
  let chapter = options.chapter ? { difficulty: options.chapterDifficulty === 'relaxed' ? 'relaxed' : 'standard', profile: options.campaignProfile || newCampaign(), saved: options.campaignSaved !== false, result: null } : null;
  // Settle the suspension before a stationary countdown; race time is separate.
  if(sprint)for(let i=0;i<120;i++)sim.step({brake:1});
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
  const scene = new THREE.Scene(); scene.background = new THREE.Color(BEACH.horizon); scene.fog = new THREE.Fog(BEACH.horizon, 230, 1000);
  const sky = createBeachSky(); scene.add(sky);
  const camera = new THREE.PerspectiveCamera(57, 1, .1, 1700);
  const chase = createChaseCamera(camera), audio = createDrivingAudio();
  const signalReader = createDrivingSignals(), trails = createTireFeedback(); scene.add(trails.root);
  let feedback = signalReader.snapshot();
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment(), environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture; scene.environmentIntensity = .5; pmrem.dispose(); room.dispose();
  scene.add(new THREE.HemisphereLight('#e0f4ff', '#b7ae91', 1.25));
  const sun = new THREE.DirectionalLight('#fff1dc', 2.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 100 });
  sun.shadow.normalBias = .04; scene.add(sun, sun.target);
  let details, harborSector, publicRoad;
  if (options.coast) {
    harborSector = createCoastWorld(); scene.add(harborSector.root);
  } else {
  const mat = (color, roughness = .9) => new THREE.MeshStandardMaterial({ color, roughness });
  const asphalt = mat(BEACH.asphalt), shoulder = mat(BEACH.shoulder), white = mat(BEACH.white), orange = mat(BEACH.coral), concrete = mat(BEACH.stone), sea = mat(BEACH.sea, .35), green = mat(BEACH.grass);
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
  const rival=options.duel?createRival():null, rivalGT=rival?createGT():null;
  const duelReadout=createDuelReadout();
  if(rivalGT){rivalGT.setColor('#e47754');scene.add(rivalGT.root);}
  const ghostView=sprint&&!options.duel?createGhostView(gt,VEHICLE.modelOffset):null;
  if(ghostView)scene.add(ghostView.root);
  const station = options.coast ? createSignalStation() : null;
  if (station) scene.add(station.root);
  const timing=options.sprint?createSprintMarkers():null;
  if(timing)scene.add(timing.root);
  const input = createDriveInput();
  let alive = true, paused = document.hidden, inspection = false, last = performance.now(), accumulator = 0, publish = 0, cameraSnap = true;
  const frameLoop = createFrameLoop(render);
  let current = sim.snapshot(), previous = current;
  const pos = new THREE.Vector3(), currentPos = new THREE.Vector3(), q = new THREE.Quaternion(), oldQ = new THREE.Quaternion(), forward = new THREE.Vector3(), sunOffset = new THREE.Vector3(-20, 35, 12);
  let cameraMetrics = { distance: 0, fov: camera.fov };
  const locked = () => (!!story && story.phase !== 'drive') || journeyLocked(journey) || sprintLocked(sprint);
  const report = () => {
    current.inspection = inspection;
    current.layout = viewLayout(host.clientWidth, host.clientHeight);
    current.quality = quality; current.pixelRatio = renderer.getPixelRatio(); current.shadowSize = sun.shadow.mapSize.x;
    current.journey = journey ? { ...journey, ...journeyHint(journey, current) } : null;
    current.sprint=sprint?{...sprint,objective:chapter ? chapterHint(sprint, chapter.difficulty) : sprintHint(sprint)}:null;
    current.chapter = chapter ? { ...chapter, id: CHAPTER_ONE.id, target: CHAPTER_ONE.targets[chapter.difficulty] } : null;
    current.feedback = { ...feedback, marks: trails.stats().live };
    current.ghost = ghostView ? {available:!!ghostBest,recordTime:ghostBest?.time,referenceTime:ghostReference?.time,saved:ghostSaved,enabled:ghostEnabled,visible:!!ghostView.root.visible,clock:ghostClock,x:ghostView.root.position.x,z:ghostView.root.position.z,delta:ghostReference&&sprint.gate>0?sprint.splits[sprint.gate-1]-ghostReference.splits[sprint.gate-1]:null} : null;
    current.duel=rival?{...duelReadout.update(sprint,rival.race,current.position,rival.state.position),time:rival.race.elapsed,gate:rival.race.gate,valid:rival.race.valid,phase:rival.race.phase,x:rival.state.position.x,z:rival.state.position.z,result:sprint.phase==='complete'?duelResult(sprint,rival.race):null}:null;
    if (options.coast) excursion = coastStatus(current, excursion);
    onStats({ ...current, paused, coast: options.coast ? excursion : null, story: story ? { ...story, ...storyHint(story, current), distance: Math.round(Math.hypot(current.position.x - STORY_STOP.x, current.position.z - STORY_STOP.z)) } : null, cameraDistance: cameraMetrics.distance, cameraFov: cameraMetrics.fov, audio: audio.status(), sector: options.coast ? excursion.area : current.position.z >= HARBOR_SECTOR.start && current.position.z <= HARBOR_SECTOR.end ? '항만대로 · 공도' : '해안도로 · 계측 구간', drawCalls: renderer.info.render.calls });
  };
  const has = (...codes) => input.has(...codes);
  function clearInput() { input.clear(); }
  function setInspection(value) {
    if (value && (current.kmh >= 1 || locked() || sprint)) return;
    inspection = !!value; paused = false; clearInput(); accumulator = 0; last = performance.now(); cameraSnap = true; audio.setPaused(locked()); report();
    renderer.domElement.focus({ preventScroll: true });
  }
  function setPaused(value) { paused = value; clearInput(); audio.setPaused(value || locked()); last = performance.now(); accumulator = 0; report(); if (!paused) renderer.domElement.focus({ preventScroll: true }); }
  function reset() { rival?.reset(); inspection = false; clearInput(); sim.reset(); recorder.clear();ghostReference=ghostBest;ghostClock=0;if(ghostView)ghostView.root.visible=false; if(sprint){for(let i=0;i<120;i++)sim.step({brake:1});sprint=newSprint(sprint.best, sprint.saved);} if(chapter) chapter = { ...chapter, result: null }; current = previous = sim.snapshot(); feedback = signalReader.reset(); trails.clear(); if (story) story = newStory(); if (journey) journey = newJourney(); excursion = { lookout: false, returned: false }; accumulator = 0; cameraSnap = true; audio.update(current, feedback); audio.setPaused(paused || locked()); report(); renderer.domElement.focus({ preventScroll: true }); }
  function recoverRoad() {
    if (!options.coast || locked() || sprint?.phase==='cooldown') return;
    inspection = false;
    journey = interruptJourney(journey);
    sprint=invalidateSprint(sprint);
    const near = nearestRoad(current.position), q = current.rotation;
    const fx = 2 * (q.x * q.z + q.w * q.y), fz = 1 - 2 * (q.x * q.x + q.y * q.y);
    const direction = fx * near.tx + fz * near.tz >= 0 ? 1 : -1;
    const p = offsetPoint(near, direction * 3.5);
    clearInput(); sim.reset({ x: p.x, y: .8, z: p.z }, Math.atan2(near.tx * direction, near.tz * direction));
    current = previous = sim.snapshot(); feedback = signalReader.reset(); trails.clear(); accumulator = 0; cameraSnap = true; audio.update(current, feedback); report(); renderer.domElement.focus({ preventScroll: true });
  }
  function skipIntro() { if (!story || story.phase !== 'intro' || paused) return; story = startStory(story); clearInput(); accumulator = 0; last = performance.now(); cameraSnap = true; audio.setPaused(false); report(); renderer.domElement.focus({ preventScroll: true }); }
  function advanceJourney() { if (!journey || paused) return; journey = continueJourney(journey); clearInput(); accumulator = 0; last = performance.now(); cameraSnap = true; audio.setPaused(locked()); report(); renderer.domElement.focus({ preventScroll: true }); }
  function beginSprint(){if(!sprint||paused)return;sprint=startSprint(sprint);clearInput();last=performance.now();accumulator=0;report();renderer.domElement.focus({preventScroll:true});}
  function retrySprint(){if(!sprint)return;reset();paused=false;beginSprint();audio.setPaused(true);}
  const handled = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyB', 'KeyR', 'KeyC', 'Escape'];
  function keydown(event) {
    if (!handled.includes(event.code) || event.target.closest?.('button,input,textarea,select,dialog')) return;
    event.preventDefault();
    if (event.code === 'Escape' && !event.repeat) { setPaused(!paused); return; }
    if (event.code === 'KeyR' && !event.repeat) { reset(); return; }
    if (event.code === 'KeyC' && !event.repeat) { recoverRoad(); return; }
    if (!paused && !locked() && sprint?.phase!=='cooldown') input.key(event.code, true);
  }
  const keyup = e => input.key(e.code, false);
  const blur = () => setPaused(true);
  const visibility = () => { frameLoop.stop(); if (document.hidden) { setPaused(true); } else if (alive) { last = performance.now(); frameLoop.start(); } };
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
    if(!paused&&sprint?.phase==='countdown'){
      sprint=advanceCountdown(sprint,dt);
      if(sprint.phase==='running'){recorder.start(current);clearInput();cameraSnap=true;audio.setPaused(false);}
    }
    if (!paused && story?.phase === 'intro') {
      story = advanceIntro(story, dt);
      if (story.phase === 'drive') { cameraSnap = true; audio.setPaused(false); }
    }
    if (!paused && !locked()) {
      accumulator += dt;
      while (accumulator >= STEP) {
        previous = current;
        const finishing=sprint?.phase==='cooldown';
        current = sim.step({ throttle: inspection||finishing ? 0 : +(has('KeyW', 'ArrowUp')||(options.arcade&&has('ShiftLeft','ShiftRight'))), reverse: inspection||finishing ? 0 : +has('KeyS', 'ArrowDown'), steer: finishing?0:+has('KeyD', 'ArrowRight') - +has('KeyA', 'ArrowLeft'), brake: inspection||finishing ? 1 : +has('KeyB'), handbrake: !inspection && !finishing && has('Space'), boost:!inspection&&!finishing&&has('ShiftLeft','ShiftRight') });
        feedback = signalReader.update(previous, current, STEP);
        trails.update(current, feedback, STEP);
        accumulator -= STEP;
        if(sprint){
          rival?.step();
          const phase=sprint.phase;
          const beforeTime=sprint.elapsed;
          sprint=updateSprint(sprint,previous,current,STEP);
          if(rival&&sprint.phase==='running'&&sprint.elapsed>=90)sprint={...sprint,phase:'cooldown',valid:false,reason:'90초 제한 · 재도전',cooldownElapsed:0};
          if(phase==='running'&&!rival) {
            if(!sprint.valid)recorder.clear();
            else recorder.capture(sprint.elapsed,sprint.phase==='cooldown'?interpolateGhostPose(previous,current,(sprint.elapsed-beforeTime)/STEP):current,sprint.phase==='cooldown');
          }
          if(sprint.phase!==phase){clearInput();
            if(sprint.phase==='complete'){
              const candidate=recorder.finish(sprint);
              if(candidate){
                let stored;try{stored=saveGhost(candidate,ghostBest,window.localStorage);}catch{stored=saveGhost(candidate,ghostBest,null);}
                ghostBest=stored.best;ghostSaved=stored.saved;
              }
              if(!rival)try{sprint=recordSprint(sprint,window.localStorage);}catch{sprint=recordSprint(sprint,null);}
              if (chapter) {
                let result;
                try { result = completeChapter(chapter.profile, sprint, chapter.difficulty, window.localStorage); }
                catch { result = completeChapter(chapter.profile, sprint, chapter.difficulty, null); }
                chapter = { ...chapter, profile: result.profile, saved: result.saved, result };
              }
              accumulator=0;audio.setPaused(true);break;
            }
          }
        }
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
    if(rivalGT){
      const r=rival.state,b=rival.previous,alpha=rival.race.phase==='complete'?1:a;
      rivalGT.root.position.set(b.position.x,b.position.y,b.position.z).lerp(new THREE.Vector3(r.position.x,r.position.y,r.position.z),alpha);
      rivalGT.root.quaternion.set(b.rotation.x,b.rotation.y,b.rotation.z,b.rotation.w).slerp(new THREE.Quaternion(r.rotation.x,r.rotation.y,r.rotation.z,r.rotation.w),alpha);
      rivalGT.root.translateY(-VEHICLE.modelOffset);applyWheelPose(rivalGT.wheels,b.wheels,r.wheels,alpha);
      rivalGT.brakeLight.emissiveIntensity=r.brake>.1?3:.7;
    }
    if(ghostView){
      ghostClock=Math.max(0,sprint.elapsed-(sprint.phase==='running'&&!paused?Math.max(0,STEP-accumulator):0));
      ghostView.update(sampleGhost(ghostReference,ghostClock),pos,ghostEnabled&&sprint.phase==='running');
    }
    gt.brakeLight.emissiveIntensity = current.brake > .1 || current.handbrake ? 3 : .7;
    forward.set(0, 0, 1).applyQuaternion(oldQ); forward.y = 0; forward.normalize();
    if (inspection && !locked()) {
      const offset = new THREE.Vector3(-6, 3.6, 7.5).applyQuaternion(oldQ);
      camera.position.copy(pos).add(offset); camera.lookAt(pos.x, pos.y + .4, pos.z);
      camera.fov = compactCamera(host.clientWidth, host.clientHeight) ? 64 : 42; camera.updateProjectionMatrix();
      cameraMetrics = { distance: offset.length(), fov: camera.fov }; cameraSnap = true;
    } else if (sprintLocked(sprint)) {
      // Race briefing/countdown/result keep the familiar driving viewpoint.
      cameraMetrics=chase.update(pos,forward,0,dt,{compact:compactCamera(host.clientWidth,host.clientHeight),snap:cameraSnap,motion:false});cameraSnap=false;
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
    } else { cameraMetrics = chase.update(pos, forward, current.kmh, paused ? 0 : dt, { compact: compactCamera(host.clientWidth, host.clientHeight), snap: cameraSnap, motion: !motionQuery.matches && options.motion !== false, push: feedback.push, braking: feedback.braking }); cameraSnap = false; }
    publicRoad?.setDestination(story?.phase === 'drive');
    audio.update(current, feedback);
    harborSector.update(paused ? 0 : dt, !motionQuery.matches && options.motion !== false);
    station?.setConfirmed(journey?.phase === 'signal' || journey?.phase === 'return' || journey?.phase === 'complete');
    sun.position.copy(pos).add(sunOffset); sun.target.position.copy(pos);
    sky.position.copy(camera.position);
    renderer.render(scene, camera);
    publish += dt; if (publish >= .1) { publish = 0; report(); }
  }
  audio.setPaused(paused || locked()); if (!document.hidden) renderer.domElement.focus({ preventScroll: true }); frameLoop.start();
  const disposeResources = createSceneDisposer(scene, { renderTargets: [environment] });
  return { reset, setPaused, skipIntro, recoverRoad, setInspection, advanceJourney, beginSprint, retrySprint,
    setGhostEnabled(value){ghostEnabled=!!value;if(!ghostEnabled&&ghostView)ghostView.root.visible=false;report();},
    clearInput,
    setQuality(value) { quality = value === 'light' ? 'light' : 'standard'; resize(); report(); },
    async setSound(enabled) { await audio.setEnabled(enabled); if (alive) { report(); if (!paused) renderer.domElement.focus({ preventScroll: true }); } },
    setVolume(value) { audio.setVolume(value); report(); },
    setInput(code, down, pointerId = code) { input.pointer(pointerId, code, !paused && !locked() && sprint?.phase!=='cooldown' && down); },
    dispose() {
      if (!alive) return;
      alive = false; frameLoop.dispose(); clearInput(); audio.dispose(); observer.disconnect();
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility);
      // All scenery maps are attached to scene materials and share this owner.
      disposeResources(); renderer.dispose(); renderer.domElement.remove(); sim.dispose(); rival?.dispose();
    },
  };
}
