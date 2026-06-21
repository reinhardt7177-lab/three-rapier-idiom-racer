import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { idiomQuizData } from "./idiom-quiz-data";

// PHASE 1 — Treadmill core (car fixed, world streams, 3 lanes, no Rapier).
// PHASE 2 — Battery pit-in loop: a single ENERGY/battery gauge drains over time,
// boost burns it faster, crashes knock it down; at 0 the world stops and the
// driver pits — answering 사자성어 quizzes recharges +30 each. All correct = a
// brief OVERDRIVE; all wrong = a low-power STALL restart (no hard game-over).
// Neon look + AI assets are later phases (see memory: neon-racer-redesign-direction).

const CFG = {
  laneWidth: 4.4,
  roadHalf: 9.0,
  segmentLength: 44,
  segmentCount: 9,
  carLength: 4.6,
  maxSpeed: 64,
  cruiseSpeed: 26,
  accel: 36,
  brake: 62,
  drag: 12,
  boostAccel: 26,
  laneLerp: 9.0,
  cameraBack: 13.5,
  cameraHeight: 6.4,
  cameraLookAhead: 17,
  cameraBaseFov: 58,
  cameraMaxFov: 94,
  cameraShakeDecay: 4.2,
  trafficForward: 17,
  // Battery / pit-in tuning
  batteryStart: 100,
  batteryDrain: 2.6,        // per second, passive
  batteryBoostDrain: 9.5,   // extra per second while boosting
  batteryCrash: 15,         // per contact
  batteryPerCorrect: 30,    // recharge per correct answer
  pitQuestions: 3,
  pitStallFloor: 34,        // limp-away charge if you answer nothing right (kept above lowBatteryWarn)
  overdriveTime: 3.2,       // free boost on a perfect pit
  lowBatteryWarn: 24
};

// Lane 0 = screen-left, 1 = center, 2 = screen-right.
const LANE_X = [CFG.laneWidth, 0, -CFG.laneWidth];
const CAR_Y = 0.06;

// Themed stages: every STAGE_LENGTH meters the world re-tints and difficulty ramps.
const STAGE_LENGTH = 900;
const STAGES = [
  { name: "다운타운", fog: 0x05060d },
  { name: "고속도로", fog: 0x0a0518 },
  { name: "네온 터널", fog: 0x02040a },
  { name: "하버 브리지", fog: 0x06121a }
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function formatRaceTime(seconds) {
  const safe = Math.max(0, seconds || 0);
  const minutes = Math.floor(safe / 60);
  const rest = safe - minutes * 60;
  return `${minutes}:${rest.toFixed(2).padStart(5, "0")}`;
}

function shuffledIndexes(length) {
  const indexes = Array.from({ length }, (_, index) => index);
  for (let i = indexes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }
  return indexes;
}

function shuffleItems(items) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function nearestLane(x) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < LANE_X.length; i += 1) {
    const d = Math.abs(LANE_X[i] - x);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function mat(color, roughness = 0.65, metalness = 0.08) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function createNeonEnv() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#0a0420");
  grad.addColorStop(0.55, "#2a0838");
  grad.addColorStop(1, "#05060d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);
  const blobs = [
    ["rgba(0,229,255,0.55)", 70, 150, 46, 70],
    ["rgba(255,43,214,0.5)", 300, 140, 54, 80],
    ["rgba(255,138,23,0.4)", 420, 165, 40, 60],
    ["rgba(0,229,255,0.4)", 200, 160, 36, 64]
  ];
  for (const [color, x, y, w, h] of blobs) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createWindowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#02030a";
  ctx.fillRect(0, 0, 64, 128);
  const colors = ["#00e5ff", "#ff2bd6", "#ffb15a", "#9fd6ff"];
  for (let y = 6; y < 128; y += 9) {
    for (let x = 5; x < 64; x += 8) {
      if (Math.random() < 0.5) continue;
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      ctx.fillRect(x, y, 4, 5);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 5);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeNumberPlate(number) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f8fbff";
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = "#14233d";
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 246, 118);
  ctx.fillStyle = "#e71924";
  ctx.font = "900 72px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(number, 128, 70);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: texture });
}

function createCar(scene, paint, accent, number) {
  const root = new THREE.Group();
  scene.add(root);
  const body = mat(paint, 0.42, 0.24);
  const stripe = mat(accent, 0.45, 0.18);
  const black = mat(0x05070b, 0.7, 0.05);
  const glass = new THREE.MeshStandardMaterial({ color: 0x81d8ff, roughness: 0.18, metalness: 0.1, transparent: true, opacity: 0.72 });
  const redLight = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff1133, emissiveIntensity: 2.6 });
  const headLight = new THREE.MeshStandardMaterial({ color: 0xfff2b8, emissive: 0xfff0d0, emissiveIntensity: 3.0 });
  const parts = [
    [new THREE.BoxGeometry(3.1, 0.72, 5), body, [0, 0.72, 0]],
    [new THREE.BoxGeometry(2.72, 0.42, 1.25), stripe, [0, 0.98, 1.95]],
    [new THREE.BoxGeometry(1.95, 0.72, 1.65), glass, [0, 1.28, -0.42]],
    [new THREE.BoxGeometry(1.45, 0.24, 1.05), stripe, [0, 1.78, -0.48]],
    [new THREE.BoxGeometry(3.6, 0.16, 0.55), black, [0, 0.33, 2.68]],
    [new THREE.BoxGeometry(3.9, 0.22, 0.35), black, [0, 1.44, -2.55]]
  ];
  for (const [geo, material, pos] of parts) {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(...pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.44, 18);
  root.userData.wheels = [];
  for (const pos of [[-1.72, 0.48, 1.64], [1.72, 0.48, 1.64], [-1.72, 0.48, -1.72], [1.72, 0.48, -1.72]]) {
    const wheel = new THREE.Mesh(wheelGeo, black);
    wheel.rotation.z = Math.PI * 0.5;
    wheel.position.set(...pos);
    root.add(wheel);
    root.userData.wheels.push(wheel);
  }
  const underGlow = new THREE.MeshStandardMaterial({ color: 0x05070b, emissive: accent, emissiveIntensity: 2.6 });
  for (const z of [-1.4, 1.4]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.08, 0.5), underGlow);
    strip.position.set(0, 0.16, z);
    root.add(strip);
  }
  for (const x of [-0.78, 0.78]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.08), headLight);
    h.position.set(x, 0.76, 2.56);
    root.add(h);
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.2, 0.08), redLight);
    r.position.set(x, 0.76, -2.56);
    root.add(r);
  }
  const numberPlate = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), makeNumberPlate(number));
  numberPlate.rotation.x = -Math.PI * 0.5;
  numberPlate.position.set(0, 1.92, -0.5);
  root.add(numberPlate);
  return root;
}

// Swap a box car group's visuals for an AI-generated GLB (graceful fallback:
// if the file is missing/unloadable the box car stays). Auto-fits scale, sits
// it on the ground, faces it forward, and repaints it wet-black for the neon scene.
function loadCarModel(group, url, glowColor) {
  // Hide the box fallback up-front so it never flashes before the GLB arrives;
  // restore it only if the load fails.
  const fallbackChildren = group.children.slice();
  fallbackChildren.forEach((child) => {
    child.visible = false;
  });
  const loader = new GLTFLoader();
  loader.load(
    url,
    (gltf) => {
      const model = gltf.scene;
      const preBox = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      preBox.getSize(size);
      const horiz = Math.max(size.x, size.z, 0.001);
      const scale = 5.0 / horiz;
      model.scale.setScalar(scale);

      const box = new THREE.Box3().setFromObject(model);
      const center = new THREE.Vector3();
      box.getCenter(center);
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y -= box.min.y;

      // Keep the Meshy PBR textures; just let the car catch shadows and reflect
      // the neon environment a bit more strongly.
      model.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = true;
          const list = Array.isArray(object.material) ? object.material : [object.material];
          list.forEach((m) => {
            if (m) m.envMapIntensity = 1.2;
          });
        }
      });

      const holder = new THREE.Group();
      holder.add(model);
      // If the body is longer along X than Z, it faces sideways — turn it forward.
      if (size.x > size.z) holder.rotation.y = Math.PI * 0.5;

      group.add(holder);

      const glowMat = new THREE.MeshStandardMaterial({ color: 0x05070b, emissive: glowColor, emissiveIntensity: 2.8 });
      for (const z of [-1.4, 1.4]) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.08, 0.5), glowMat);
        strip.position.set(0, 0.16, z);
        group.add(strip);
      }
      console.log("hypercar GLB loaded", { scale: scale.toFixed(3), size: size.toArray().map((n) => n.toFixed(2)) });
    },
    undefined,
    (error) => {
      console.warn("hypercar GLB not loaded; using box car.", error?.message || error);
      fallbackChildren.forEach((child) => {
        child.visible = true;
      });
    }
  );
}

// Scale a GLB to a target size, recenter it, sit it on the ground, and let it
// catch shadows + reflect the neon env. Returns metrics. Mutates the model.
function normalizeModel(model, { target, fit = "length", ground = true }) {
  const pre = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  pre.getSize(size);
  const base = fit === "height" ? size.y : Math.max(size.x, size.z);
  const scale = target / Math.max(0.001, base);
  model.scale.setScalar(scale);
  const box = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  box.getCenter(center);
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= ground ? box.min.y : center.y;
  model.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      const list = Array.isArray(object.material) ? object.material : [object.material];
      list.forEach((m) => {
        if (m) m.envMapIntensity = 1.1;
      });
    }
  });
  return { scale, size: size.clone() };
}

function loadGLB(url, opts, onReady) {
  new GLTFLoader().load(
    url,
    (gltf) => {
      try {
        normalizeModel(gltf.scene, opts);
        onReady(gltf.scene);
      } catch (e) {
        console.warn("GLB placement failed:", url, e?.message || e);
      }
    },
    undefined,
    (error) => console.warn("GLB not loaded:", url, error?.message || error)
  );
}

function createRaceAudio() {
  let ctx = null;
  let master = null;
  let engine = null;
  let buzz = null;
  let gain = null;
  function unlock() {
    if (ctx || typeof window === "undefined") return;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.2;
    master.connect(ctx.destination);
    gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(master);
    engine = ctx.createOscillator();
    engine.type = "sawtooth";
    engine.frequency.value = 70;
    engine.connect(gain);
    engine.start();
    buzz = ctx.createOscillator();
    buzz.type = "square";
    buzz.frequency.value = 140;
    const buzzGain = ctx.createGain();
    buzzGain.gain.value = 0.09;
    buzz.connect(buzzGain);
    buzzGain.connect(gain);
    buzz.start();
  }
  function beep(freq, duration = 0.1, volume = 0.12, type = "square") {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(0.0001, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(amp);
    amp.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.03);
  }
  return {
    unlock,
    countdown(step) {
      beep(360 + step * 80, 0.08, 0.1);
    },
    go() {
      beep(900, 0.18, 0.16, "sawtooth");
      setTimeout(() => beep(1250, 0.14, 0.12, "sawtooth"), 90);
    },
    hit() {
      beep(88, 0.18, 0.18, "sawtooth");
    },
    lowBattery() {
      beep(220, 0.16, 0.1, "square");
    },
    correct() {
      beep(760, 0.08, 0.12);
      setTimeout(() => beep(990, 0.1, 0.12), 90);
    },
    wrong() {
      beep(150, 0.18, 0.12, "sawtooth");
    },
    recharge() {
      beep(540, 0.07, 0.08, "triangle");
      setTimeout(() => beep(720, 0.09, 0.08, "triangle"), 80);
    },
    update(speedRatio, active) {
      if (!ctx || !gain || !engine || !buzz) return;
      const ratio = clamp(speedRatio, 0, 1);
      const now = ctx.currentTime;
      gain.gain.setTargetAtTime(active ? 0.02 + ratio * 0.1 : 0.0001, now, 0.08);
      engine.frequency.setTargetAtTime(58 + ratio * 230, now, 0.06);
      buzz.frequency.setTargetAtTime(118 + ratio * 440, now, 0.06);
    },
    destroy() {
      ctx?.close?.().catch(() => {});
      ctx = null;
    }
  };
}

function buildSegment(scene, materials) {
  const group = new THREE.Group();
  scene.add(group);

  const road = new THREE.Mesh(new THREE.BoxGeometry(CFG.roadHalf * 2, 0.2, CFG.segmentLength), materials.road);
  road.position.set(0, -0.1, CFG.segmentLength / 2);
  road.receiveShadow = true;
  group.add(road);

  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(9, 0.2, CFG.segmentLength), materials.shoulder);
    shoulder.position.set(side * (CFG.roadHalf + 4.5), -0.12, CFG.segmentLength / 2);
    shoulder.receiveShadow = true;
    group.add(shoulder);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.26, 3.4, 0.26), materials.post);
    post.position.set(side * (CFG.roadHalf + 1.3), 1.7, CFG.segmentLength * 0.5);
    group.add(post);
    const lampHead = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.5), materials.lamp);
    lampHead.position.set(side * (CFG.roadHalf + 0.9), 3.3, CFG.segmentLength * 0.5);
    group.add(lampHead);
  }

  for (const lx of [CFG.laneWidth / 2, -CFG.laneWidth / 2]) {
    for (let z = 3; z < CFG.segmentLength; z += 6) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 2.6), materials.dash);
      dash.position.set(lx, 0.02, z);
      group.add(dash);
    }
  }

  // Neon city corridor: a dark tower on each side (box fallback; swapped for the
  // AI building GLBs once they load) whipping past for the Blade-Runner street feel.
  const towers = [];
  for (const side of [-1, 1]) {
    const bh = 10 + Math.random() * 18;
    const building = new THREE.Mesh(new THREE.BoxGeometry(6, bh, 7), materials.building);
    building.position.set(side * (CFG.roadHalf + 13), bh / 2 - 0.2, CFG.segmentLength * (0.25 + Math.random() * 0.5));
    group.add(building);
    const stripeMat = Math.random() < 0.5 ? materials.neonCyan : materials.neonMagenta;
    const stripeH = new THREE.Mesh(new THREE.BoxGeometry(6.1, 0.5, 0.45), stripeMat);
    stripeH.position.set(building.position.x, bh * 0.55, building.position.z);
    group.add(stripeH);
    const stripeV = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 7.1), stripeMat);
    stripeV.position.set(building.position.x, bh * 0.78, building.position.z);
    group.add(stripeV);
    towers.push({ box: [building, stripeH, stripeV], x: building.position.x, z: building.position.z });
  }

  const obstacles = [];
  for (let i = 0; i < 2; i += 1) {
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.5, 10), materials.cone);
    mesh.castShadow = true;
    mesh.visible = false;
    group.add(mesh);
    obstacles.push({ mesh, lane: 0, localZ: 0, hit: false, active: false });
  }

  return { group, obstacles, towers };
}

function randomizeSegment(segment, allowObstacles, difficulty = 0) {
  const lanes = shuffleItems([0, 1, 2]);
  const probs = [0.78 + Math.min(0.2, difficulty * 0.05), 0.38 + Math.min(0.46, difficulty * 0.1)];
  segment.obstacles.forEach((obstacle, index) => {
    const active = allowObstacles && Math.random() < probs[index];
    obstacle.active = active;
    obstacle.hit = false;
    obstacle.mesh.visible = active;
    if (!active) return;
    obstacle.lane = lanes[index];
    obstacle.localZ = 8 + Math.random() * (CFG.segmentLength - 16);
    obstacle.mesh.position.set(LANE_X[obstacle.lane], 0.75, obstacle.localZ);
  });
}

export function createThreeRapierRacingRuntime({ mount, onHudUpdate, onMessage, onGameOver, onQuizPrompt }) {
  let disposed = false;
  let startQueued = false;
  const audio = createRaceAudio();
  const input = { accel: false, brake: false, boost: false, steerLeft: false, steerRight: false, steerAxis: 0 };
  let quizOrder = shuffledIndexes(idiomQuizData.length);

  const state = {
    raceStatus: "idle",
    countdown: 0,
    lights: 0,
    autoThrottle: false,
    speed: 0,
    speedFeel: 0,
    boosting: false,
    boostGlow: 0,
    overdrive: 0,
    bend: 0,
    stage: 0,
    battery: CFG.batteryStart,
    lowWarned: false,
    score: 0,
    combo: 0,
    bestCombo: 0,
    distance: 0,
    runTimer: 0,
    bestDistance: 0,
    laneTarget: 1,
    carX: 0,
    wallCooldown: 0,
    cameraShake: 0,
    quizPaused: false,
    pendingQuiz: null,
    quizCursor: 0,
    pitActive: false,
    pitDone: 0,
    pitCorrect: 0,
    prevSteerLeft: false,
    prevSteerRight: false,
    axisLatched: 0
  };

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  mount.innerHTML = "";
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060d);
  scene.fog = new THREE.FogExp2(0x05060d, 0.013);
  const camera = new THREE.PerspectiveCamera(CFG.cameraBaseFov, 16 / 9, 0.1, 900);
  camera.position.set(0, CFG.cameraHeight, -CFG.cameraBack);
  camera.lookAt(0, 1.6, CFG.cameraLookAhead);
  const clock = new THREE.Clock();

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(960, 540), 0.82, 0.7, 0.22);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = createNeonEnv();
  const envRT = pmrem.fromEquirectangular(envTexture);
  scene.environment = envRT.texture;
  envTexture.dispose();
  pmrem.dispose();

  // Night lighting: emissive materials + bloom carry the neon; lights are a dim
  // magenta-tinted base. (Point-light accents can be tuned in later.)
  scene.add(new THREE.AmbientLight(0x223044, 1.0));
  scene.add(new THREE.HemisphereLight(0x3a0a52, 0x020610, 0.85));
  const sun = new THREE.DirectionalLight(0x9fb6ff, 0.6);
  sun.position.set(-26, 60, -18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 200 });
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 1200), mat(0x070a12, 0.95, 0.1));
  ground.rotation.x = -Math.PI * 0.5;
  ground.position.set(0, -0.3, CFG.segmentCount * CFG.segmentLength * 0.4);
  ground.receiveShadow = true;
  scene.add(ground);

  const materials = {
    road: new THREE.MeshStandardMaterial({ color: 0x0a0c14, roughness: 0.26, metalness: 0.72 }),
    shoulder: mat(0x0a1018, 0.92, 0.05),
    curb: new THREE.MeshStandardMaterial({ color: 0x0a1420, emissive: 0x00e5ff, emissiveIntensity: 1.5, roughness: 0.5 }),
    dash: new THREE.MeshStandardMaterial({ color: 0x0a1420, emissive: 0x00e5ff, emissiveIntensity: 1.7, roughness: 0.5 }),
    post: mat(0x161b22, 0.7, 0.3),
    lamp: new THREE.MeshStandardMaterial({ color: 0x140a04, emissive: 0xff8a17, emissiveIntensity: 2.2, roughness: 0.5 }),
    cone: new THREE.MeshStandardMaterial({ color: 0x1a0c04, emissive: 0xff6a21, emissiveIntensity: 1.9, roughness: 0.5 }),
    building: mat(0x0a0e1a, 0.82, 0.12),
    neonCyan: new THREE.MeshStandardMaterial({ color: 0x041018, emissive: 0x00e5ff, emissiveIntensity: 2.2, roughness: 0.5 }),
    neonMagenta: new THREE.MeshStandardMaterial({ color: 0x180420, emissive: 0xff2bd6, emissiveIntensity: 2.2, roughness: 0.5 })
  };

  const segments = [];
  for (let i = 0; i < CFG.segmentCount; i += 1) {
    const segment = buildSegment(scene, materials);
    segment.group.position.z = i * CFG.segmentLength;
    randomizeSegment(segment, i >= 2);
    segments.push(segment);
  }

  const player = createCar(scene, 0xe71924, 0x00e5ff, "07");
  player.position.set(0, CAR_Y, 0);
  loadCarModel(player, "/models/hypercar.glb", 0x00e5ff);

  let gateInstances = null;

  // (Traffic stays as the clean box cars — the AI hovercar GLB came out
  // distorted/flat, so we don't swap it in.)

  // One neon arch gate that sits on the next stage boundary: it approaches and
  // the car passes through it exactly at the STAGE-N transition, then it jumps
  // to the following boundary.
  loadGLB("/models/neon-gate.glb", { target: 26, ground: true }, (proto) => {
    const holder = new THREE.Group();
    holder.add(proto.clone(true));
    holder.position.set(0, 0, STAGE_LENGTH);
    holder.visible = false;
    scene.add(holder);
    gateInstances = { gate: holder, range: CFG.segmentCount * CFG.segmentLength };
  });

  // Real AI city towers flanking the road (replace the box towers per segment).
  loadGLB("/models/building-a.glb", { target: 40, fit: "height", ground: true }, (protoA) => {
    loadGLB("/models/building-b.glb", { target: 46, fit: "height", ground: true }, (protoB) => {
      segments.forEach((seg, si) => {
        seg.towers.forEach((tower, ti) => {
          const proto = (si + ti) % 2 === 0 ? protoA : protoB;
          const holder = new THREE.Group();
          holder.add(proto.clone(true));
          holder.position.set(tower.x + Math.sign(tower.x) * 4, 0, tower.z);
          holder.rotation.y = ((si + ti) % 4) * (Math.PI / 2);
          seg.group.add(holder);
          tower.box.forEach((mesh) => {
            mesh.visible = false;
          });
        });
      });
    });
  });

  const traffic = [
    { mesh: createCar(scene, 0x1269e8, 0xffc338, "21"), lane: 0, z: 96, hit: false },
    { mesh: createCar(scene, 0xff8a17, 0x6334d9, "88"), lane: 2, z: 150, hit: false }
  ];
  traffic.forEach((car) => {
    car.mesh.position.set(LANE_X[car.lane], CAR_Y, car.z);
  });

  // Speed-streak field: short additive lines streaming toward the camera,
  // length + opacity scaled by speed. The marquee "sense of speed" cue (Phase 3).
  const STREAK_COUNT = 520;
  const streakSpread = 16;
  const streakFar = CFG.segmentLength * 3;
  const streakPositions = new Float32Array(STREAK_COUNT * 6);
  const streaks = [];
  for (let i = 0; i < STREAK_COUNT; i += 1) {
    streaks.push({
      x: (Math.random() * 2 - 1) * streakSpread,
      y: 0.3 + Math.random() * 11,
      z: -6 + Math.random() * (streakFar + 6)
    });
  }
  const streakGeometry = new THREE.BufferGeometry();
  streakGeometry.setAttribute("position", new THREE.BufferAttribute(streakPositions, 3));
  const streakMaterial = new THREE.LineBasicMaterial({
    color: 0x7fe6ff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const streakField = new THREE.LineSegments(streakGeometry, streakMaterial);
  streakField.frustumCulled = false;
  scene.add(streakField);

  // --- Phase 4.5 atmosphere: rain, oncoming light streaks, parallax skyline ---

  // Rain: falling streaks in a box around the fixed car (always on).
  const RAIN_COUNT = 1500;
  const rainTop = 28;
  const rainBottom = -2;
  const rainXSpread = 42;
  const rainZNear = -CFG.cameraBack - 4;
  const rainZFar = 80;
  const rainPositions = new Float32Array(RAIN_COUNT * 6);
  const rainDrops = [];
  for (let i = 0; i < RAIN_COUNT; i += 1) {
    rainDrops.push({
      x: (Math.random() * 2 - 1) * rainXSpread,
      y: rainBottom + Math.random() * (rainTop - rainBottom),
      z: rainZNear + Math.random() * (rainZFar - rainZNear)
    });
  }
  const rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
  const rainMaterial = new THREE.LineBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0.26, depthWrite: false });
  const rainField = new THREE.LineSegments(rainGeometry, rainMaterial);
  rainField.frustumCulled = false;
  scene.add(rainField);

  function updateRain(dt) {
    const fall = (26 + state.speed * 0.5) * dt;
    const drift = state.speed * dt * 0.25;
    const streak = 1.0 + (state.speed / CFG.maxSpeed) * 1.8;
    for (let i = 0; i < RAIN_COUNT; i += 1) {
      const d = rainDrops[i];
      d.y -= fall;
      d.z -= drift;
      if (d.y < rainBottom) {
        d.y = rainTop;
        d.x = (Math.random() * 2 - 1) * rainXSpread;
      }
      if (d.z < rainZNear) d.z += rainZFar - rainZNear;
      const o = i * 6;
      rainPositions[o] = d.x;
      rainPositions[o + 1] = d.y;
      rainPositions[o + 2] = d.z;
      rainPositions[o + 3] = d.x;
      rainPositions[o + 4] = d.y + streak;
      rainPositions[o + 5] = d.z;
    }
    rainGeometry.attributes.position.needsUpdate = true;
  }

  // Oncoming traffic light streaks: additive emissive bars rushing past on the
  // far sides, stretched by speed (bloom turns them into light trails).
  const oncomingFar = CFG.segmentCount * CFG.segmentLength;
  const oncoming = [];

  function resetOncoming(drop, spreadFull) {
    drop.side = Math.random() < 0.5 ? -1 : 1;
    drop.mesh.position.set(
      drop.side * (CFG.roadHalf + 3 + Math.random() * 9),
      0.5 + Math.random() * 1.6,
      spreadFull ? Math.random() * oncomingFar : oncomingFar * (0.7 + Math.random() * 0.3)
    );
  }

  for (let i = 0; i < 16; i += 1) {
    const amber = i % 3 === 0;
    const material = new THREE.MeshBasicMaterial({
      color: amber ? 0xffb15a : 0xeaf4ff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 3.4), material);
    mesh.frustumCulled = false;
    const drop = { mesh, side: -1 };
    resetOncoming(drop, true);
    scene.add(mesh);
    oncoming.push(drop);
  }

  function updateOncoming(dt) {
    const stretch = 1 + (state.speed / CFG.maxSpeed) * 7;
    for (const drop of oncoming) {
      drop.mesh.position.z -= (state.speed + 24) * dt;
      drop.mesh.scale.z = stretch;
      if (drop.mesh.position.z < -CFG.cameraBack - 6) resetOncoming(drop, false);
    }
  }

  // Parallax skyline: distant towers with lit windows, scrolling slowly.
  const skylineMaterial = new THREE.MeshStandardMaterial({
    color: 0x060a14,
    emissive: 0xffffff,
    emissiveMap: createWindowTexture(),
    emissiveIntensity: 1.3,
    roughness: 0.95,
    metalness: 0.0
  });
  const skylineFar = oncomingFar * 1.4;
  const skyline = [];

  function resetSkyline(tower, spreadFull) {
    tower.side = Math.random() < 0.5 ? -1 : 1;
    tower.mesh.position.set(
      tower.side * (58 + Math.random() * 80),
      tower.h / 2 - 3,
      spreadFull ? Math.random() * skylineFar : skylineFar * (0.75 + Math.random() * 0.25)
    );
  }

  for (let i = 0; i < 16; i += 1) {
    const w = 12 + Math.random() * 20;
    const h = 34 + Math.random() * 64;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 9), skylineMaterial);
    mesh.frustumCulled = false;
    const tower = { mesh, side: -1, h };
    resetSkyline(tower, true);
    scene.add(mesh);
    skyline.push(tower);
  }

  function updateSkyline(dt) {
    for (const tower of skyline) {
      tower.mesh.position.z -= state.speed * 0.22 * dt;
      if (tower.mesh.position.z < -30) resetSkyline(tower, false);
    }
  }

  function updateGates() {
    if (!gateInstances) return;
    const gate = gateInstances.gate;
    const z = (state.stage + 1) * STAGE_LENGTH - state.distance;
    gate.position.z = z;
    gate.position.x = curveX(z);
    gate.visible = z < gateInstances.range && z > -12;
  }

  function updateStreaks(dt) {
    // Boost-only warp streaks: fade in while boosting/overdrive, fade out otherwise.
    const targetGlow = state.boosting ? 1 : 0;
    state.boostGlow = lerp(state.boostGlow, targetGlow, Math.min(1, dt * (state.boosting ? 6 : 4)));
    const len = 2 + state.boostGlow * 16;
    const recycleZ = -CFG.cameraBack - 6;
    for (let i = 0; i < STREAK_COUNT; i += 1) {
      const s = streaks[i];
      s.z -= state.speed * dt * 1.15;
      if (s.z < recycleZ) {
        s.z += streakFar + 12;
        s.x = (Math.random() * 2 - 1) * streakSpread;
        s.y = 0.3 + Math.random() * 11;
      }
      const o = i * 6;
      streakPositions[o] = s.x;
      streakPositions[o + 1] = s.y;
      streakPositions[o + 2] = s.z;
      streakPositions[o + 3] = s.x;
      streakPositions[o + 4] = s.y;
      streakPositions[o + 5] = s.z + len;
    }
    streakGeometry.attributes.position.needsUpdate = true;
    streakMaterial.opacity = clamp(state.boostGlow * 0.85, 0, 0.85);
  }

  function emitHud() {
    onHudUpdate?.({
      speed: Math.max(0, Math.round(state.speed * 3.0)),
      score: Math.round(state.score),
      time: `${Math.round(state.distance)}m`,
      battery: Math.round(clamp(state.battery, 0, 100)),
      boost: Math.round(clamp(state.battery, 0, 100)),
      combo: state.combo,
      speedFeel: Number(state.speedFeel.toFixed(3)),
      boosting: state.boosting,
      stage: state.stage + 1,
      stageName: STAGES[state.stage % STAGES.length].name,
      stageProgress: Number(((state.distance % STAGE_LENGTH) / STAGE_LENGTH).toFixed(3)),
      nextStageM: Math.max(0, Math.round(STAGE_LENGTH - (state.distance % STAGE_LENGTH))),
      rank: state.bestDistance > 0 ? `${Math.round(state.bestDistance)}m` : "--",
      lapTime: formatRaceTime(state.runTimer),
      bestLap: state.bestDistance ? `${Math.round(state.bestDistance)}m` : "--",
      drift: 0,
      minimap: null,
      raceStatus: state.raceStatus,
      lights: state.lights,
      pit: state.pitActive,
      winner: ""
    });
  }

  function resetWorld() {
    state.laneTarget = 1;
    state.carX = 0;
    player.position.set(0, CAR_Y, 0);
    player.rotation.set(0, 0, 0);
    segments.forEach((segment, i) => {
      segment.group.position.set(0, 0, i * CFG.segmentLength);
      randomizeSegment(segment, i >= 2);
    });
    traffic.forEach((car, i) => {
      car.lane = i === 0 ? 0 : 2;
      car.z = 96 + i * 54;
      car.hit = false;
      car.mesh.position.set(LANE_X[car.lane], CAR_Y, car.z);
    });
    camera.position.set(0, CFG.cameraHeight, -CFG.cameraBack);
    camera.fov = CFG.cameraBaseFov;
    camera.updateProjectionMatrix();
  }

  function resetGrid(nextStatus = "idle") {
    Object.assign(state, {
      raceStatus: nextStatus,
      countdown: 0,
      lights: 0,
      autoThrottle: false,
      speed: 0,
      speedFeel: 0,
      boosting: false,
      boostGlow: 0,
      overdrive: 0,
      bend: 0,
      stage: 0,
      battery: CFG.batteryStart,
      lowWarned: false,
      score: 0,
      combo: 0,
      bestCombo: 0,
      distance: 0,
      runTimer: 0,
      wallCooldown: 0,
      cameraShake: 0,
      quizPaused: false,
      pendingQuiz: null,
      quizCursor: 0,
      pitActive: false,
      pitDone: 0,
      pitCorrect: 0,
      prevSteerLeft: false,
      prevSteerRight: false,
      axisLatched: 0
    });
    quizOrder = shuffledIndexes(idiomQuizData.length);
    onQuizPrompt?.(null);
    resetWorld();
    emitHud();
  }

  function startRace() {
    audio.unlock();
    if (state.raceStatus === "countdown" || state.raceStatus === "running") return;
    if (state.raceStatus === "finished") resetGrid("idle");
    Object.assign(state, { raceStatus: "countdown", countdown: 3.15, lights: 1, autoThrottle: false });
    audio.countdown(1);
    onMessage?.("READY");
    emitHud();
  }

  function greenLightStart() {
    Object.assign(state, { raceStatus: "running", lights: 4, countdown: 0, autoThrottle: true, speed: Math.max(state.speed, 10) });
    audio.go();
    onMessage?.("GO!");
    emitHud();
  }

  function updateCountdown(dt) {
    if (state.raceStatus !== "countdown") return false;
    const previous = state.lights;
    state.countdown -= dt;
    if (state.countdown > 2.1) state.lights = 1;
    else if (state.countdown > 1.05) state.lights = 2;
    else if (state.countdown > 0) state.lights = 3;
    else {
      greenLightStart();
      return true;
    }
    if (previous !== state.lights) {
      audio.countdown(state.lights);
      onMessage?.(`${4 - state.lights}`);
      emitHud();
    }
    return true;
  }

  function makeQuizPayload(checkpointLabel) {
    if (state.quizCursor >= quizOrder.length) {
      quizOrder = shuffledIndexes(idiomQuizData.length);
      state.quizCursor = 0;
    }
    const dataIndex = quizOrder[state.quizCursor];
    state.quizCursor += 1;
    const correct = idiomQuizData[dataIndex];
    const wrongs = shuffleItems(idiomQuizData.filter((_, index) => index !== dataIndex)).slice(0, 3);
    const options = shuffleItems([
      { text: correct.meaning, correct: true },
      ...wrongs.map((item) => ({ text: item.meaning, correct: false }))
    ]);
    const correctOptionIndex = options.findIndex((option) => option.correct);
    const id = `${checkpointLabel}-${state.quizCursor}-${dataIndex}`;
    state.pendingQuiz = { id, correctOptionIndex, data: correct };
    return {
      id,
      checkpointLabel,
      hanja: correct.hanja,
      korean: correct.korean,
      question: "이 사자성어의 뜻으로 알맞은 것은?",
      options: options.map((option) => option.text)
    };
  }

  function presentPitQuestion() {
    if (state.pitDone >= CFG.pitQuestions) {
      exitPit();
      return;
    }
    onQuizPrompt?.(makeQuizPayload(`PIT ${state.pitDone + 1}/${CFG.pitQuestions}`));
  }

  function enterPit() {
    if (state.pitActive) return;
    state.pitActive = true;
    state.quizPaused = true;
    state.autoThrottle = false;
    state.boosting = false;
    input.accel = false;
    input.brake = false;
    input.boost = false;
    input.steerLeft = false;
    input.steerRight = false;
    input.steerAxis = 0;
    state.pitDone = 0;
    state.pitCorrect = 0;
    state.lowWarned = false;
    audio.lowBattery();
    onMessage?.("BATTERY EMPTY · PIT-IN");
    presentPitQuestion();
    emitHud();
  }

  function exitPit() {
    state.pitActive = false;
    state.quizPaused = false;
    state.pendingQuiz = null;
    onQuizPrompt?.(null);
    state.autoThrottle = state.raceStatus === "running";
    if (state.pitCorrect >= CFG.pitQuestions) {
      state.overdrive = CFG.overdriveTime;
      state.speed = Math.max(state.speed, CFG.cruiseSpeed + 6);
      onMessage?.("PERFECT! OVERDRIVE");
    } else if (state.battery < 12) {
      state.battery = CFG.pitStallFloor;
      state.speed = Math.max(state.speed, 8);
      onMessage?.("STALL · 저전력 출발");
    } else {
      state.speed = Math.max(state.speed, 14);
      onMessage?.("GO!");
    }
    emitHud();
  }

  function answerQuiz(optionIndex) {
    if (!state.pendingQuiz) return { answered: false };
    const quiz = state.pendingQuiz;
    const correct = optionIndex === quiz.correctOptionIndex;
    state.pendingQuiz = null;
    state.pitDone += 1;
    if (correct) {
      state.combo += 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      state.pitCorrect += 1;
      const multiplier = 1 + Math.min(state.combo, 5) * 0.2;
      state.score += Math.round(180 * multiplier);
      state.battery = clamp(state.battery + CFG.batteryPerCorrect, 0, 100);
      audio.correct();
      audio.recharge();
      onMessage?.(`정답! +${CFG.batteryPerCorrect}⚡ 콤보 ${state.combo}`);
    } else {
      state.combo = 0;
      state.score = Math.max(0, state.score - 50);
      state.cameraShake = Math.max(state.cameraShake, 0.5);
      audio.wrong();
      onMessage?.(`오답! ${quiz.data.meaning}`);
    }
    emitHud();
    presentPitQuestion();
    return { answered: true, correct, correctIndex: quiz.correctOptionIndex, meaning: quiz.data.meaning };
  }

  function updateLanes(dt) {
    const leftEdge = input.steerLeft && !state.prevSteerLeft;
    const rightEdge = input.steerRight && !state.prevSteerRight;
    if (leftEdge) state.laneTarget = clamp(state.laneTarget - 1, 0, 2);
    if (rightEdge) state.laneTarget = clamp(state.laneTarget + 1, 0, 2);
    state.prevSteerLeft = input.steerLeft;
    state.prevSteerRight = input.steerRight;

    const axis = input.steerAxis || 0;
    if (axis < -0.45 && state.axisLatched !== -1) {
      state.laneTarget = clamp(state.laneTarget - 1, 0, 2);
      state.axisLatched = -1;
    } else if (axis > 0.45 && state.axisLatched !== 1) {
      state.laneTarget = clamp(state.laneTarget + 1, 0, 2);
      state.axisLatched = 1;
    } else if (Math.abs(axis) < 0.2) {
      state.axisLatched = 0;
    }

    const targetX = LANE_X[state.laneTarget];
    state.carX = lerp(state.carX, targetX, Math.min(1, dt * CFG.laneLerp));
    player.position.x = state.carX;
    player.rotation.y = (targetX - state.carX) * 0.06;
    player.rotation.z = (state.carX - targetX) * 0.05;
  }

  function updateThrottle(dt) {
    const powered = state.raceStatus === "running" && state.autoThrottle && !input.brake;
    if (input.accel) state.speed += CFG.accel * dt;
    else if (powered) state.speed += CFG.accel * 0.5 * dt;
    else state.speed -= CFG.drag * dt;
    if (input.brake) state.speed -= CFG.brake * dt;

    const manualBoost = input.boost && state.battery > 4 && !input.brake;
    const boosting = state.overdrive > 0 || manualBoost;
    state.boosting = boosting;
    if (boosting) state.speed += CFG.boostAccel * dt;

    if (state.overdrive > 0) state.overdrive = Math.max(0, state.overdrive - dt);

    const stageMul = 1 + state.stage * 0.12;
    let drain = CFG.batteryDrain * stageMul;
    if (manualBoost && state.overdrive <= 0) drain += CFG.batteryBoostDrain;
    state.battery = clamp(state.battery - drain * dt, 0, 100);

    const ceiling = (CFG.maxSpeed + state.stage * 4) * (boosting ? 1.12 : 1);
    state.speed = clamp(state.speed, 0, ceiling);
    if (powered && state.speed < CFG.cruiseSpeed) state.speed = CFG.cruiseSpeed;

    const target = clamp(state.speed / CFG.maxSpeed + (boosting ? 0.22 : 0), 0, 1.2);
    state.speedFeel = lerp(state.speedFeel, target, Math.min(1, dt * 4));

    if (state.battery <= CFG.lowBatteryWarn && !state.lowWarned) {
      state.lowWarned = true;
      audio.lowBattery();
      onMessage?.("LOW BATTERY!");
    } else if (state.battery > CFG.lowBatteryWarn + 10) {
      state.lowWarned = false;
    }
  }

  function spinWheels(car, amount) {
    car.userData.wheels?.forEach((wheel) => {
      wheel.rotation.x += amount;
    });
  }

  function registerHit(strength) {
    state.speed = Math.max(8, state.speed * (1 - strength));
    state.battery = Math.max(0, state.battery - CFG.batteryCrash);
    state.score = Math.max(0, state.score - 40);
    state.combo = 0;
    state.cameraShake = Math.max(state.cameraShake, 0.7);
    if (state.wallCooldown <= 0) {
      audio.hit();
      onMessage?.("CONTACT");
      state.wallCooldown = 0.4;
    }
  }

  function curveX() {
    // Lateral road curve disabled — offsetting rigid segments caused visible
    // seams. The road stays straight; state.bend only drives a subtle camera sway.
    return 0;
  }

  function scrollWorld(dt) {
    const worldSpeed = state.speed;
    const carLane = nearestLane(state.carX);
    state.distance += worldSpeed * dt;

    segments.forEach((segment) => {
      segment.group.position.z -= worldSpeed * dt;
      if (segment.group.position.z <= -CFG.segmentLength) {
        segment.group.position.z += CFG.segmentCount * CFG.segmentLength;
        randomizeSegment(segment, true, state.stage);
      }
      segment.group.position.x = curveX(segment.group.position.z);
      segment.obstacles.forEach((obstacle) => {
        if (!obstacle.active || obstacle.hit) return;
        const worldZ = segment.group.position.z + obstacle.localZ;
        if (worldZ < -8 || worldZ > 10) return;
        if (obstacle.lane === carLane && Math.abs(worldZ) < CFG.carLength * 0.55) {
          obstacle.hit = true;
          registerHit(0.45);
        }
      });
    });

    traffic.forEach((car) => {
      car.z -= (worldSpeed - CFG.trafficForward) * dt;
      if (car.z < -18) {
        car.z = CFG.segmentCount * CFG.segmentLength * 0.8 + Math.random() * 40;
        car.lane = Math.floor(Math.random() * 3);
        car.hit = false;
      } else if (car.z > CFG.segmentCount * CFG.segmentLength) {
        car.z = CFG.segmentCount * CFG.segmentLength;
      }
      car.mesh.position.set(curveX(car.z) + LANE_X[car.lane], CAR_Y, car.z);
      spinWheels(car.mesh, Math.max(worldSpeed, CFG.trafficForward) * dt * 1.1);
      if (!car.hit && car.lane === carLane && Math.abs(car.z) < CFG.carLength * 0.7) {
        car.hit = true;
        registerHit(0.55);
      }
    });

    spinWheels(player, worldSpeed * dt * 1.25);
  }

  function updateCamera(dt) {
    // Camera stays centered on the world (track dead-center); the car slides
    // between lanes within the frame.
    let shakeX = 0;
    let shakeY = 0;
    const baseline = state.speedFeel * 0.12;
    const shake = state.cameraShake + baseline;
    if (shake > 0.01) {
      shakeX = (Math.random() - 0.5) * shake * 0.7;
      shakeY = (Math.random() - 0.5) * shake * 0.4;
      state.cameraShake = Math.max(0, state.cameraShake - dt * CFG.cameraShakeDecay);
    }
    camera.position.set(shakeX + state.bend * 0.8, CFG.cameraHeight + shakeY, -CFG.cameraBack);
    camera.lookAt(0, 1.6, CFG.cameraLookAhead);
    camera.rotateZ(state.bend * 0.04);

    const targetFov = CFG.cameraBaseFov + state.speedFeel * (CFG.cameraMaxFov - CFG.cameraBaseFov) + (state.boosting ? 12 : 0);
    const rate = targetFov > camera.fov ? dt * 8 : dt * 2.6;
    camera.fov = lerp(camera.fov, targetFov, Math.min(1, rate));
    camera.updateProjectionMatrix();
  }

  function update(dt) {
    state.wallCooldown = Math.max(0, state.wallCooldown - dt);
    audio.update(state.speedFeel, state.raceStatus === "countdown" || state.raceStatus === "running");
    updateStreaks(dt);
    updateRain(dt);
    updateOncoming(dt);
    updateSkyline(dt);
    updateGates(dt);

    if (state.quizPaused) {
      state.speed = lerp(state.speed, 0, Math.min(1, dt * 2.4));
      updateCamera(dt);
      return;
    }
    if (updateCountdown(dt)) {
      updateCamera(dt);
      return;
    }
    if (state.raceStatus === "running") {
      state.runTimer += dt;
      state.bend = Math.sin(state.distance * 0.011) * 0.62 + Math.sin(state.distance * 0.0041 + 1.3) * 0.38;
      const stage = Math.floor(state.distance / STAGE_LENGTH);
      if (stage !== state.stage) {
        state.stage = stage;
        const theme = STAGES[stage % STAGES.length];
        scene.fog.color.set(theme.fog);
        scene.background.set(theme.fog);
        onMessage?.(`STAGE ${stage + 1} · ${theme.name}`);
      }
      updateLanes(dt);
      updateThrottle(dt);
      scrollWorld(dt);
      state.score += Math.max(0, state.speed) * dt * 0.6;
      if (state.distance > state.bestDistance) state.bestDistance = state.distance;
      if (state.battery <= 0 && !state.pitActive) enterPit();
    }
    updateCamera(dt);
  }

  function resize() {
    const width = mount.clientWidth || 960;
    const height = mount.clientHeight || 540;
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function loop() {
    if (disposed) return;
    const dt = Math.min(0.033, clock.getDelta());
    try {
      update(dt);
      emitHud();
      composer.render();
    } catch (error) {
      console.error("Treadmill race loop recovered", error);
      Object.assign(state, { raceStatus: "running", autoThrottle: true, quizPaused: false, pitActive: false, pendingQuiz: null, pitDone: 0, pitCorrect: 0, boosting: false });
      onQuizPrompt?.(null);
    }
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize);
  resize();
  resetGrid("idle");
  onMessage?.("PRESS GAME START");
  if (startQueued) {
    startQueued = false;
    startRace();
  }
  requestAnimationFrame(loop);

  return {
    destroy() {
      disposed = true;
      window.removeEventListener("resize", resize);
      audio.destroy();
      composer.dispose?.();
      envRT?.dispose?.();
      renderer.dispose();
      scene.traverse((object) => {
        object.geometry?.dispose?.();
        const list = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
        list.forEach((material) => {
          material.map?.dispose?.();
          material.emissiveMap?.dispose?.();
          material.dispose?.();
        });
      });
      mount.innerHTML = "";
    },
    setInput(patch) {
      Object.assign(input, patch);
    },
    startRace,
    answerQuiz,
    restart() {
      resetGrid("idle");
      onMessage?.("PRESS GAME START");
    }
  };
}
