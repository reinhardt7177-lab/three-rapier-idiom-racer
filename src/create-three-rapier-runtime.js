import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { idiomQuizData } from "./idiom-quiz-data";

const CFG = {
  straightHalfLength: 185,
  turnRadius: 62,
  roadWidth: 22,
  runoff: 7,
  totalLaps: 2,
  maxSpeed: 58,
  cruiseSpeed: 28,
  recoverySpeed: 30,
  accel: 38,
  brake: 58,
  drag: 10,
  steerPower: 1.85,
  steerResponse: 8.5,
  highSpeedSteerLoss: 0.38,
  cornerSlowdown: 0.42,
  driftSlip: 0.48,
  driftGripBonus: 0.18,
  boostDrain: 22,
  boostRegen: 10,
  rivalMinSpeed: 31,
  rivalMaxSpeed: 53,
  rivalCatchUpMeters: 42,
  rivalPackMeters: 18,
  rivalLaneSpeed: 1.35,
  cameraBaseFov: 63,
  cameraMaxFov: 78,
  cameraShakeDecay: 4.5
};

const TWO_PI = Math.PI * 2;
const TRACK_LENGTH = CFG.straightHalfLength * 4 + Math.PI * CFG.turnRadius * 2;
const CAR_VISUAL_Y = 0.06;
const CAR_PHYSICS_Y = 0.66;
const QUIZ_CHECKPOINTS = [
  { ratio: 0.255, label: "CP 1" },
  { ratio: 0.505, label: "CP 2" },
  { ratio: 0.755, label: "CP 3" },
  { ratio: 1.055, label: "START LINE" }
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function wrapAngle(angle) {
  let next = angle;
  while (next < 0) next += TWO_PI;
  while (next >= TWO_PI) next -= TWO_PI;
  return next;
}

function angleDelta(from, to) {
  let diff = wrapAngle(to) - wrapAngle(from);
  if (diff > Math.PI) diff -= TWO_PI;
  if (diff < -Math.PI) diff += TWO_PI;
  return diff;
}

function lerpAngle(from, to, amount) {
  return wrapAngle(from + angleDelta(from, to) * amount);
}

function trackPoint(t) {
  const u = wrapAngle(t) / TWO_PI;
  const straight = 0.34;
  const turn = (1 - straight * 2) / 2;
  const half = CFG.straightHalfLength;
  const r = CFG.turnRadius;
  if (u < straight) return new THREE.Vector3(lerp(-half, half, u / straight), 0, r);
  if (u < straight + turn) {
    const k = (u - straight) / turn;
    const a = Math.PI * 0.5 - k * Math.PI;
    return new THREE.Vector3(half + Math.cos(a) * r, 0, Math.sin(a) * r);
  }
  if (u < straight * 2 + turn) {
    const k = (u - straight - turn) / straight;
    return new THREE.Vector3(lerp(half, -half, k), 0, -r);
  }
  const k = (u - straight * 2 - turn) / turn;
  const a = -Math.PI * 0.5 - k * Math.PI;
  return new THREE.Vector3(-half + Math.cos(a) * r, 0, Math.sin(a) * r);
}

function trackTangent(t) {
  return trackPoint(t + 0.003).sub(trackPoint(t - 0.003)).normalize();
}

function trackNormal(tangent) {
  return new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
}

const SAMPLES = Array.from({ length: 720 }, (_, i) => {
  const t = (i / 720) * TWO_PI;
  const center = trackPoint(t);
  const tangent = trackTangent(t);
  const normal = trackNormal(tangent);
  return { t, center, tangent, normal };
});

function nearestTrackInfo(position) {
  let best = SAMPLES[0];
  let bestDist = Infinity;
  for (const sample of SAMPLES) {
    const dx = position.x - sample.center.x;
    const dz = position.z - sample.center.z;
    const dist = dx * dx + dz * dz;
    if (dist < bestDist) {
      best = sample;
      bestDist = dist;
    }
  }
  const offset = new THREE.Vector3(position.x - best.center.x, 0, position.z - best.center.z);
  const lateral = offset.dot(best.normal);
  return { ...best, lateral, absLateral: Math.abs(lateral) };
}

function placeOnTrack(t, lateral = 0) {
  const center = trackPoint(t);
  const tangent = trackTangent(t);
  const normal = trackNormal(tangent);
  return {
    position: center.add(normal.multiplyScalar(lateral)),
    heading: Math.atan2(tangent.x, tangent.z),
    tangent,
    normal
  };
}

function raceProgressMeters(laps, t) {
  return ((laps * TWO_PI + t) / TWO_PI) * TRACK_LENGTH;
}

function curveIntensity(t) {
  return clamp(trackTangent(t - 0.035).angleTo(trackTangent(t + 0.035)) / 0.16, 0, 1);
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

function mat(color, roughness = 0.65, metalness = 0.08) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function createTrackGeometry(width, y = 0.02) {
  const positions = [];
  const indices = [];
  const segments = 360;
  for (let i = 0; i <= segments; i += 1) {
    const t = (i / segments) * TWO_PI;
    const center = trackPoint(t);
    const tangent = trackTangent(t);
    const normal = trackNormal(tangent);
    const left = center.clone().addScaledVector(normal, -width * 0.5);
    const right = center.clone().addScaledVector(normal, width * 0.5);
    positions.push(left.x, y, left.z, right.x, y, right.z);
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function labelTexture(text, bg = "#183956") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 192);
  ctx.strokeStyle = "#d8f9ff";
  ctx.lineWidth = 10;
  ctx.strokeRect(12, 12, 488, 168);
  ctx.fillStyle = "#d9fff5";
  ctx.font = "900 58px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 100);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSign(scene, t, lateral, text) {
  const s = placeOnTrack(t, lateral);
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(6, 2.2, 0.24),
    new THREE.MeshStandardMaterial({ map: labelTexture(text), roughness: 0.55, metalness: 0.06 })
  );
  sign.position.copy(s.position).setY(2.9);
  sign.rotation.y = s.heading + Math.PI * 0.5;
  scene.add(sign);
  const postMaterial = mat(0x74828a, 0.55, 0.2);
  for (const x of [-2.2, 2.2]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.7, 0.18), postMaterial);
    post.position.copy(s.position).setY(1.35);
    post.position.x += Math.cos(sign.rotation.y) * x;
    post.position.z -= Math.sin(sign.rotation.y) * x;
    scene.add(post);
  }
}

function createTree(scene, position, scale = 1) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * scale, 0.24 * scale, 2.4 * scale, 8), mat(0x86542e, 0.82, 0.02));
  trunk.position.copy(position).setY(1.2 * scale);
  scene.add(trunk);
  const top = new THREE.Mesh(new THREE.ConeGeometry(1.1 * scale, 2.5 * scale, 7), mat(0x137d3c, 0.74, 0.02));
  top.position.copy(position).setY(3 * scale);
  scene.add(top);
}

function createGuardRail(scene, t, lateral) {
  const s = placeOnTrack(t, lateral);
  const railMat = mat(0xc7d1d8, 0.45, 0.2);
  const postMat = mat(0x59646c, 0.55, 0.18);
  const heading = s.heading;
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 4.8), railMat);
  rail.position.copy(s.position).setY(0.72);
  rail.rotation.y = heading;
  scene.add(rail);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.05, 0.22), postMat);
  post.position.copy(s.position).setY(0.36);
  scene.add(post);
}

function createCheckpointGate(scene, t, text) {
  const center = placeOnTrack(t, 0);
  const gateMat = mat(0x1d3a5b, 0.42, 0.2);
  const bannerMat = new THREE.MeshStandardMaterial({ map: labelTexture(text, "#142a47"), roughness: 0.46, metalness: 0.08 });
  const left = placeOnTrack(t, -CFG.roadWidth * 0.5 - 1.9);
  const right = placeOnTrack(t, CFG.roadWidth * 0.5 + 1.9);
  const heading = center.heading;
  [left, right].forEach((spot) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.8, 0.5), gateMat);
    post.position.copy(spot.position).setY(2.4);
    post.rotation.y = heading;
    scene.add(post);
  });
  const banner = new THREE.Mesh(new THREE.BoxGeometry(CFG.roadWidth + 5.2, 2.0, 0.35), bannerMat);
  banner.position.copy(center.position).setY(5.1);
  banner.rotation.y = heading;
  scene.add(banner);
}

function createGrandstand(scene, t, lateral) {
  const s = placeOnTrack(t, lateral);
  const heading = s.heading + Math.PI * 0.5;
  const baseMat = mat(0x2d3d4c, 0.72, 0.08);
  const seatMats = [mat(0xffd247, 0.62, 0.02), mat(0x4db4ff, 0.62, 0.02), mat(0xff5f70, 0.62, 0.02)];
  const base = new THREE.Mesh(new THREE.BoxGeometry(18, 1.0, 5.6), baseMat);
  base.position.copy(s.position).setY(0.75);
  base.rotation.y = heading;
  scene.add(base);
  for (let row = 0; row < 3; row += 1) {
    const seats = new THREE.Mesh(new THREE.BoxGeometry(17 - row, 0.42, 0.7), seatMats[row]);
    seats.position.copy(s.position).setY(1.35 + row * 0.48);
    seats.position.x += Math.cos(heading) * (row * 0.3);
    seats.position.z -= Math.sin(heading) * (row * 0.3);
    seats.rotation.y = heading;
    scene.add(seats);
  }
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
  const redLight = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff1111, emissiveIntensity: 0.7 });
  const headLight = new THREE.MeshStandardMaterial({ color: 0xfff2b8, emissive: 0xffd36a, emissiveIntensity: 0.65 });
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
    lap() {
      beep(760, 0.08, 0.12);
      setTimeout(() => beep(990, 0.1, 0.12), 90);
    },
    finish(win) {
      beep(win ? 980 : 180, 0.2, 0.16, win ? "triangle" : "sawtooth");
    },
    update(speed, active, offroad) {
      if (!ctx || !gain || !engine || !buzz) return;
      const ratio = clamp(Math.abs(speed) / CFG.maxSpeed, 0, 1);
      const now = ctx.currentTime;
      gain.gain.setTargetAtTime(active ? 0.018 + ratio * 0.09 + offroad * 0.02 : 0.0001, now, 0.08);
      engine.frequency.setTargetAtTime(58 + ratio * 210 + offroad * 36, now, 0.06);
      buzz.frequency.setTargetAtTime(118 + ratio * 420, now, 0.06);
    },
    destroy() {
      ctx?.close?.().catch(() => {});
      ctx = null;
    }
  };
}

export function createThreeRapierRacingRuntime({ mount, onHudUpdate, onMessage, onGameOver, onQuizPrompt }) {
  let disposed = false;
  let ready = false;
  let startQueued = false;
  let world = null;
  let playerBody = null;
  const npcBodies = [];
  const dynamicObjects = [];
  const audio = createRaceAudio();
  const input = { accel: false, brake: false, boost: false, steerLeft: false, steerRight: false, steerAxis: 0 };
  let quizOrder = shuffledIndexes(idiomQuizData.length);
  const start = placeOnTrack(0.018, 0);
  const sim = { position: start.position.clone().setY(CAR_VISUAL_Y) };
  const state = {
    raceStatus: "loading",
    countdown: 0,
    lights: 0,
    autoThrottle: false,
    speed: 0,
    steer: 0,
    slide: 0,
    drift: 0,
    heading: start.heading,
    completedLaps: 0,
    lastT: 0.018,
    rank: 3,
    score: 0,
    boost: 72,
    offroad: 0,
    wallCooldown: 0,
    raceTimer: 0,
    lapTimer: 0,
    bestLap: null,
    lastLap: null,
    penaltyCooldown: 0,
    cameraShake: 0,
    quizPaused: false,
    pendingQuiz: null,
    quizCursor: 0,
    nextQuizIndex: 0,
    winner: ""
  };

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  mount.innerHTML = "";
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x73bfff);
  scene.fog = new THREE.Fog(0x86c9ff, 145, 520);
  const camera = new THREE.PerspectiveCamera(63, 16 / 9, 0.1, 900);
  const clock = new THREE.Clock();
  scene.add(new THREE.HemisphereLight(0xbfe7ff, 0x1f4a25, 1.55));
  const sun = new THREE.DirectionalLight(0xffffff, 2.15);
  sun.position.set(-45, 80, 55);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  Object.assign(sun.shadow.camera, { left: -140, right: 140, top: 140, bottom: -140 });
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(740, 430), mat(0x237c38, 0.88, 0.02));
  ground.rotation.x = -Math.PI * 0.5;
  ground.receiveShadow = true;
  scene.add(ground);
  const shoulder = new THREE.Mesh(createTrackGeometry(CFG.roadWidth + 5.5, 0), mat(0xb1bec9, 0.8, 0.02));
  shoulder.receiveShadow = true;
  scene.add(shoulder);
  const road = new THREE.Mesh(createTrackGeometry(CFG.roadWidth, 0.03), mat(0x3e4349, 0.92, 0.02));
  road.receiveShadow = true;
  scene.add(road);

  const curbRed = mat(0xe63b30, 0.62, 0.02);
  const curbWhite = mat(0xf0f3f2, 0.62, 0.02);
  const dashMat = mat(0xf4f6f7, 0.5, 0.02);
  for (let i = 0; i < 160; i += 1) {
    const t = (i / 160) * TWO_PI;
    const heading = Math.atan2(trackTangent(t).x, trackTangent(t).z);
    for (const side of [-1, 1]) {
      const s = placeOnTrack(t, side * (CFG.roadWidth * 0.5 + 0.9));
      const curb = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 2.4), i % 2 ? curbRed : curbWhite);
      curb.position.copy(s.position).setY(0.1);
      curb.rotation.y = heading;
      scene.add(curb);
    }
  }
  for (let i = 0; i < 120; i += 1) {
    const t = (i / 120) * TWO_PI;
    const heading = Math.atan2(trackTangent(t).x, trackTangent(t).z);
    for (const lane of [-CFG.roadWidth / 6, CFG.roadWidth / 6]) {
      const s = placeOnTrack(t, lane);
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 3.1), dashMat);
      dash.position.copy(s.position).setY(0.14);
      dash.rotation.y = heading;
      scene.add(dash);
    }
  }
  for (let i = 0; i < 50; i += 1) {
    const side = i % 2 ? 1 : -1;
    const s = placeOnTrack((i / 50) * TWO_PI, side * (CFG.roadWidth * 0.5 + 18 + (i % 5) * 3));
    createTree(scene, s.position, 0.8 + (i % 4) * 0.14);
  }
  for (let i = 0; i < 96; i += 1) {
    const t = (i / 96) * TWO_PI;
    createGuardRail(scene, t, -CFG.roadWidth * 0.5 - 2.2);
    createGuardRail(scene, t, CFG.roadWidth * 0.5 + 2.2);
  }
  [0.08, 0.28, 0.54, 0.76].forEach((ratio, i) => createSign(scene, ratio * TWO_PI, i % 2 ? -CFG.roadWidth * 0.5 - 16 : CFG.roadWidth * 0.5 + 16, ["PIT", "ECO", "BOOST", "FINAL"][i]));
  [0.055, 0.255, 0.505, 0.755].forEach((ratio, i) => createCheckpointGate(scene, ratio * TWO_PI, ["START", "CP 1", "CP 2", "CP 3"][i]));
  createGrandstand(scene, 0.18 * TWO_PI, CFG.roadWidth * 0.5 + 31);
  createGrandstand(scene, 0.68 * TWO_PI, -CFG.roadWidth * 0.5 - 31);

  const player = createCar(scene, 0xe71924, 0x1674ff, "07");
  const rivals = [
    {
      name: "NPC 21",
      mesh: createCar(scene, 0x1269e8, 0xffc338, "21"),
      t: 0.012,
      lateral: -4.7,
      currentLateral: -4.7,
      targetLateral: -4.7,
      speed: 0,
      baseSpeed: 39.2,
      aggression: 1.08,
      completedLaps: 0,
      lastT: 0.012,
      lastGapMeters: 0,
      finished: false
    },
    {
      name: "NPC 88",
      mesh: createCar(scene, 0xff8a17, 0x6334d9, "88"),
      t: 0.008,
      lateral: 4.8,
      currentLateral: 4.8,
      targetLateral: 4.8,
      speed: 0,
      baseSpeed: 38.2,
      aggression: 0.96,
      completedLaps: 0,
      lastT: 0.008,
      lastGapMeters: 0,
      finished: false
    }
  ];

  function syncPlayer() {
    player.position.copy(sim.position);
    player.rotation.set(0, state.heading + state.slide * 0.28, 0);
    if (!playerBody) return;
    playerBody.setNextKinematicTranslation({ x: sim.position.x, y: CAR_PHYSICS_Y, z: sim.position.z });
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, state.heading, 0));
    playerBody.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
  }

  function emitHud() {
    onHudUpdate?.({
      speed: Math.max(0, Math.round(state.speed * 5.2)),
      score: Math.round(state.score),
      time: `L${Math.min(CFG.totalLaps, state.completedLaps + 1)}/${CFG.totalLaps}`,
      boost: Math.round(clamp(state.boost, 0, 100)),
      rank: `${state.rank}/3`,
      lapTime: formatRaceTime(state.lapTimer),
      bestLap: state.bestLap ? formatRaceTime(state.bestLap) : "--:--",
      drift: Math.round(state.drift * 100),
      minimap: {
        player: { x: sim.position.x, z: sim.position.z },
        rivals: rivals.map((rival) => ({ x: rival.mesh.position.x, z: rival.mesh.position.z }))
      },
      raceStatus: state.raceStatus === "loading" ? "idle" : state.raceStatus,
      lights: state.lights,
      winner: state.winner
    });
  }

  function resetGrid(nextStatus = "idle") {
    const p = placeOnTrack(0.018, 0);
    sim.position.copy(p.position).setY(CAR_VISUAL_Y);
    Object.assign(state, {
      raceStatus: ready ? nextStatus : "loading",
      countdown: 0,
      lights: 0,
      autoThrottle: false,
      speed: 0,
      steer: 0,
      slide: 0,
      drift: 0,
      heading: p.heading,
      completedLaps: 0,
      lastT: 0.018,
      rank: 3,
      score: 0,
      boost: 72,
      offroad: 0,
      wallCooldown: 0,
      raceTimer: 0,
      lapTimer: 0,
      bestLap: null,
      lastLap: null,
      penaltyCooldown: 0,
      cameraShake: 0,
      quizPaused: false,
      pendingQuiz: null,
      quizCursor: 0,
      nextQuizIndex: 0,
      winner: ""
    });
    quizOrder = shuffledIndexes(idiomQuizData.length);
    onQuizPrompt?.(null);
    syncPlayer();
    rivals.forEach((rival, index) => {
      rival.t = 0.012 - index * 0.005;
      rival.speed = 0;
      rival.completedLaps = 0;
      rival.lastT = rival.t;
      rival.currentLateral = rival.lateral;
      rival.targetLateral = rival.lateral;
      rival.lastGapMeters = 0;
      rival.finished = false;
      const s = placeOnTrack(rival.t, rival.lateral);
      rival.mesh.position.copy(s.position).setY(CAR_VISUAL_Y);
      rival.mesh.rotation.set(0, s.heading, 0);
    });
    emitHud();
  }

  function startRace() {
    audio.unlock();
    if (!ready) {
      startQueued = true;
      onMessage?.("LOADING PHYSICS");
      return;
    }
    if (state.raceStatus === "countdown" || state.raceStatus === "running") return;
    if (state.raceStatus === "finished") resetGrid("idle");
    Object.assign(state, { raceStatus: "countdown", countdown: 3.15, lights: 1, autoThrottle: false });
    audio.countdown(1);
    onMessage?.("READY");
    emitHud();
  }

  function greenLightStart() {
    Object.assign(state, { raceStatus: "running", lights: 4, countdown: 0, autoThrottle: true, speed: Math.max(state.speed, 8) });
    audio.go();
    onMessage?.("GO!");
    emitHud();
  }

  function getQuizCheckpointTarget() {
    const lapOffset = Math.floor(state.nextQuizIndex / QUIZ_CHECKPOINTS.length);
    const checkpoint = QUIZ_CHECKPOINTS[state.nextQuizIndex % QUIZ_CHECKPOINTS.length];
    return {
      label: checkpoint.label,
      ratio: checkpoint.ratio + lapOffset,
      progress: (checkpoint.ratio + lapOffset) * TWO_PI
    };
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
    const id = `${checkpointLabel}-${state.completedLaps}-${state.nextQuizIndex}-${dataIndex}`;
    state.pendingQuiz = {
      id,
      correctOptionIndex,
      data: correct
    };
    return {
      id,
      checkpointLabel,
      hanja: correct.hanja,
      korean: correct.korean,
      question: "이 사자성어의 뜻으로 알맞은 것은?",
      options: options.map((option) => option.text)
    };
  }

  function triggerCheckpointQuiz(checkpointLabel) {
    if (state.quizPaused || state.pendingQuiz || state.raceStatus !== "running") return;
    state.quizPaused = true;
    state.autoThrottle = false;
    state.speed = Math.max(7, state.speed * 0.35);
    onQuizPrompt?.(makeQuizPayload(checkpointLabel));
    onMessage?.(`${checkpointLabel} QUIZ`);
    emitHud();
  }

  function updateCheckpointQuiz() {
    if (state.quizPaused || state.pendingQuiz || state.raceStatus !== "running") return;
    const info = nearestTrackInfo(sim.position);
    const progress = state.completedLaps * TWO_PI + info.t;
    const target = getQuizCheckpointTarget();
    if (progress >= target.progress) {
      state.nextQuizIndex += 1;
      triggerCheckpointQuiz(target.label);
    }
  }

  function answerQuiz(optionIndex) {
    if (!state.pendingQuiz) return { answered: false };
    const correct = optionIndex === state.pendingQuiz.correctOptionIndex;
    const quiz = state.pendingQuiz;
    state.pendingQuiz = null;
    state.quizPaused = false;
    state.autoThrottle = state.raceStatus === "running";
    if (correct) {
      state.score += 250;
      state.boost = clamp(state.boost + 28, 0, 100);
      state.speed = Math.max(state.speed, CFG.cruiseSpeed + 10);
      onMessage?.("정답! +250 BOOST");
    } else {
      state.score = Math.max(0, state.score - 120);
      state.boost = Math.max(0, state.boost - 24);
      state.speed = Math.max(12, state.speed * 0.52);
      state.cameraShake = Math.max(state.cameraShake, 0.65);
      onMessage?.("오답! 감속");
    }
    onQuizPrompt?.(null);
    emitHud();
    return {
      answered: true,
      correct,
      correctIndex: quiz.correctOptionIndex,
      meaning: quiz.data.meaning
    };
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

  function finishRace(winner) {
    if (state.raceStatus === "finished") return;
    updateRank();
    const rankBonus = winner === "YOU" ? 700 : Math.max(80, 360 - state.rank * 70);
    state.score += rankBonus;
    Object.assign(state, { raceStatus: "finished", winner, lights: 4, autoThrottle: false, quizPaused: false, pendingQuiz: null, speed: state.speed * 0.35 });
    onQuizPrompt?.(null);
    audio.finish(winner === "YOU");
    onMessage?.(`${winner} WINS!`);
    onGameOver?.({ title: "RACE FINISH", reason: `${winner} WINS!`, score: Math.round(state.score), winner });
    emitHud();
  }

  function updateRank() {
    const playerInfo = nearestTrackInfo(sim.position);
    const standings = [
      { player: true, progress: state.completedLaps * TWO_PI + playerInfo.t },
      ...rivals.map((rival) => ({ player: false, progress: rival.completedLaps * TWO_PI + rival.t }))
    ].sort((a, b) => b.progress - a.progress);
    state.rank = standings.findIndex((entry) => entry.player) + 1;
  }

  function resolveTrackLimits(dt) {
    const info = nearestTrackInfo(sim.position);
    const roadHalf = CFG.roadWidth * 0.5;
    const limit = roadHalf + CFG.runoff;
    state.offroad = lerp(state.offroad, clamp((info.absLateral - roadHalf) / CFG.runoff, 0, 1), Math.min(1, dt * 5));
    if (info.absLateral <= roadHalf * 0.92) return;
    const side = Math.sign(info.lateral) || 1;
    const tangent = info.tangent.clone();
    if (new THREE.Vector3(Math.sin(state.heading), 0, Math.cos(state.heading)).dot(tangent) < 0) tangent.multiplyScalar(-1);
    const tangentHeading = Math.atan2(tangent.x, tangent.z);
    if (info.absLateral > limit) {
      const safeLateral = side * (limit - 1);
      sim.position.x = info.center.x + info.normal.x * safeLateral;
      sim.position.z = info.center.z + info.normal.z * safeLateral;
      state.heading = lerpAngle(state.heading, tangentHeading, Math.min(1, dt * 8));
      state.speed = Math.max(CFG.recoverySpeed, state.speed * 0.86);
      if (state.wallCooldown <= 0) {
        audio.hit();
        onMessage?.("TRACK LIMIT");
        state.wallCooldown = 0.55;
        state.cameraShake = Math.max(state.cameraShake, 0.55);
        state.boost = Math.max(0, state.boost - 8);
        state.score = Math.max(0, state.score - 35);
      }
      return;
    }
    const nextLat = lerp(info.lateral, side * roadHalf * 0.78, Math.min(1, dt * (2.4 + state.offroad * 4.2)));
    sim.position.x = info.center.x + info.normal.x * nextLat;
    sim.position.z = info.center.z + info.normal.z * nextLat;
    state.heading = lerpAngle(state.heading, tangentHeading, Math.min(1, dt * (1.6 + state.offroad * 2.8)));
    if (state.speed < CFG.cruiseSpeed) state.speed = CFG.cruiseSpeed;
  }

  function updatePlayer(dt) {
    const buttonSteer = (input.steerLeft ? -1 : 0) + (input.steerRight ? 1 : 0);
    const steerInput = clamp(input.steerAxis || buttonSteer, -1, 1);
    const speedRatio = clamp(Math.abs(state.speed) / CFG.maxSpeed, 0.08, 1);
    const steerResponse = CFG.steerResponse * (1 - speedRatio * 0.28);
    state.steer = lerp(state.steer, steerInput, Math.min(1, dt * steerResponse));
    const powered = state.raceStatus === "running" && state.autoThrottle && !input.brake;
    if (input.accel) state.speed += CFG.accel * dt;
    else if (powered) state.speed += CFG.accel * 0.58 * dt;
    else state.speed -= CFG.drag * dt;
    if (input.brake) state.speed -= CFG.brake * dt;
    if (input.boost && state.boost > 2 && !input.brake) {
      state.speed += CFG.accel * 0.68 * dt;
      state.boost -= CFG.boostDrain * dt;
    } else state.boost += CFG.boostRegen * dt * (state.offroad > 0.25 ? 0.35 : 1);

    const cornerLoad = Math.abs(state.steer) * speedRatio;
    const curve = curveIntensity(nearestTrackInfo(sim.position).t);
    state.speed -= Math.max(0, state.speed) * (cornerLoad * cornerLoad * CFG.cornerSlowdown + curve * cornerLoad * 0.12) * dt;
    state.speed = clamp(state.speed, -10, CFG.maxSpeed);
    if (powered && state.speed < CFG.cruiseSpeed) state.speed = CFG.cruiseSpeed;

    const driftTarget = clamp((speedRatio - 0.52) / 0.42, 0, 1) * clamp((Math.abs(state.steer) - 0.38) / 0.52, 0, 1) * (input.brake ? 1.25 : 1);
    state.drift = lerp(state.drift, driftTarget, Math.min(1, dt * (input.brake ? 6.5 : 3.2)));
    state.slide = lerp(state.slide, -state.steer * state.drift * CFG.driftSlip, Math.min(1, dt * 4.2));
    const grip = clamp(1 - state.offroad * 0.42 - state.drift * 0.18 + CFG.driftGripBonus * state.drift, 0.48, 1);
    const highSpeedSteer = 1 - speedRatio * CFG.highSpeedSteerLoss;
    state.heading += state.steer * CFG.steerPower * speedRatio * grip * highSpeedSteer * dt;

    const forward = new THREE.Vector3(Math.sin(state.heading), 0, Math.cos(state.heading));
    const side = new THREE.Vector3(forward.z, 0, -forward.x);
    sim.position.addScaledVector(forward, state.speed * dt);
    sim.position.addScaledVector(side, state.speed * state.slide * dt);
    sim.position.y = CAR_VISUAL_Y;
    resolveTrackLimits(dt);
    syncPlayer();
    player.userData.wheels.forEach((wheel) => {
      wheel.rotation.x += state.speed * dt * 1.25;
    });
  }

  function updateRivals(dt) {
    if (state.raceStatus !== "running") return;
    const playerInfo = nearestTrackInfo(sim.position);
    const playerProgress = raceProgressMeters(state.completedLaps, playerInfo.t);
    const roadHalf = CFG.roadWidth * 0.5;

    rivals.forEach((rival, index) => {
      if (rival.finished) return;

      const rivalProgress = raceProgressMeters(rival.completedLaps, rival.t);
      const gapMeters = rivalProgress - playerProgress;
      const absGap = Math.abs(gapMeters);
      const packPressure = clamp(1 - absGap / CFG.rivalCatchUpMeters, 0, 1);
      const curve = curveIntensity(rival.t);
      let desiredSpeed = rival.baseSpeed + Math.sin(rival.t * 7 + index * 1.7) * 1.25 - curve * 7.5;

      // Rubber-band lightly so rivals stay visible, but still beatable.
      if (gapMeters < -CFG.rivalCatchUpMeters) desiredSpeed += 7.2 * rival.aggression;
      else if (gapMeters < -CFG.rivalPackMeters) desiredSpeed += 3.8 * rival.aggression;
      if (gapMeters > CFG.rivalCatchUpMeters) desiredSpeed -= 6.8;
      else if (gapMeters > CFG.rivalPackMeters) desiredSpeed -= 2.8;

      // If tucked behind the player, move out of the player's lane and try an overtake.
      if (gapMeters > -24 && gapMeters < 10) {
        const closeToPlayerLane = Math.abs(rival.currentLateral - playerInfo.lateral) < 5.3;
        if (closeToPlayerLane) {
          const escapeSide = Math.sign(rival.currentLateral - playerInfo.lateral) || (index === 0 ? -1 : 1);
          rival.targetLateral = clamp(escapeSide * (roadHalf - 3.6), -roadHalf + 2.6, roadHalf - 2.6);
          desiredSpeed += 3.2 * rival.aggression;
        } else {
          rival.targetLateral = lerp(rival.targetLateral, rival.lateral, 0.02);
        }
      } else {
        const racingLine = Math.sin(rival.t * 2 + index) * 0.85 + (index === 0 ? -1 : 1) * curve * (roadHalf - 5.6);
        rival.targetLateral = rival.lateral * 0.45 + racingLine;
      }

      // Rival-to-rival spacing so they do not stack on one exact line.
      rivals.forEach((other) => {
        if (other === rival) return;
        const otherProgress = raceProgressMeters(other.completedLaps, other.t);
        const otherGap = Math.abs(otherProgress - rivalProgress);
        if (otherGap < 11 && Math.abs(other.currentLateral - rival.currentLateral) < 4.2) {
          rival.targetLateral += index === 0 ? -2.2 : 2.2;
          desiredSpeed -= 1.2;
        }
      });

      if (gapMeters > -5 && gapMeters < 8 && Math.abs(rival.currentLateral - playerInfo.lateral) < 4.2) {
        desiredSpeed -= 4.8;
      }

      rival.targetLateral = clamp(rival.targetLateral, -roadHalf + 2.4, roadHalf - 2.4);
      rival.currentLateral = lerp(rival.currentLateral, rival.targetLateral, Math.min(1, dt * CFG.rivalLaneSpeed * (1 + packPressure)));
      rival.speed = lerp(rival.speed, clamp(desiredSpeed, CFG.rivalMinSpeed, CFG.rivalMaxSpeed), Math.min(1, dt * 0.9));
      rival.t = wrapAngle(rival.t + (rival.speed / TRACK_LENGTH) * TWO_PI * dt);
      if (rival.lastT > Math.PI * 1.7 && rival.t < Math.PI * 0.35) {
        rival.completedLaps += 1;
        if (rival.completedLaps >= CFG.totalLaps) {
          rival.finished = true;
          finishRace(rival.name);
        }
      }
      rival.lastT = rival.t;
      if (rival.lastGapMeters < -1.5 && gapMeters > 1.5 && absGap < 16) {
        onMessage?.(`${rival.name} ATTACK`);
      }
      rival.lastGapMeters = gapMeters;

      const s = placeOnTrack(rival.t, rival.currentLateral);
      rival.mesh.position.copy(s.position).setY(CAR_VISUAL_Y);
      rival.mesh.rotation.set(0, s.heading, 0);
      rival.mesh.userData.wheels.forEach((wheel) => {
        wheel.rotation.x += rival.speed * dt * 1.14;
      });
      const body = npcBodies[index];
      if (body) {
        body.setNextKinematicTranslation({ x: rival.mesh.position.x, y: CAR_PHYSICS_Y, z: rival.mesh.position.z });
        const q = new THREE.Quaternion().setFromEuler(rival.mesh.rotation);
        body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
      }
    });
  }

  function resolveImpacts() {
    let hit = false;
    for (const rival of rivals) {
      const delta = sim.position.clone().sub(rival.mesh.position);
      delta.y = 0;
      const dist = delta.length();
      if (dist > 0.001 && dist < 4.2) {
        delta.normalize();
        sim.position.addScaledVector(delta, 4.2 - dist);
        state.heading = lerpAngle(state.heading, Math.atan2(delta.x, delta.z), 0.2);
        state.speed = Math.max(CFG.recoverySpeed * 0.65, state.speed * 0.78);
        hit = true;
      }
    }
    for (const object of dynamicObjects) {
      const p = object.body.translation();
      const dx = sim.position.x - p.x;
      const dz = sim.position.z - p.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < object.radius * object.radius) {
        const dist = Math.sqrt(Math.max(0.001, distSq));
        const nx = dx / dist;
        const nz = dz / dist;
        sim.position.x += nx * (object.radius - dist + 0.3);
        sim.position.z += nz * (object.radius - dist + 0.3);
        object.body.applyImpulse({ x: -nx * Math.max(2, state.speed * 0.4), y: 1.8, z: -nz * Math.max(2, state.speed * 0.4) }, true);
        state.speed = Math.max(CFG.recoverySpeed * 0.72, state.speed * 0.82);
        hit = true;
      }
    }
    if (hit && state.wallCooldown <= 0) {
      audio.hit();
      onMessage?.("CONTACT");
      state.wallCooldown = 0.42;
      state.cameraShake = Math.max(state.cameraShake, 0.75);
      state.boost = Math.max(0, state.boost - 14);
      state.score = Math.max(0, state.score - 50);
    }
  }

  function updateLaps() {
    const info = nearestTrackInfo(sim.position);
    if (state.lastT > Math.PI * 1.7 && info.t < Math.PI * 0.35 && Math.abs(info.lateral) < CFG.roadWidth * 0.5 + 3 && state.speed > 12) {
      state.lastLap = state.lapTimer;
      state.bestLap = state.bestLap ? Math.min(state.bestLap, state.lapTimer) : state.lapTimer;
      state.lapTimer = 0;
      state.completedLaps = Math.min(CFG.totalLaps, state.completedLaps + 1);
      if (state.completedLaps >= CFG.totalLaps) finishRace("YOU");
      else {
        audio.lap();
        onMessage?.("FINAL LAP");
      }
    }
    state.lastT = info.t;
  }

  function updateCamera(dt) {
    const forward = new THREE.Vector3(Math.sin(state.heading), 0, Math.cos(state.heading));
    const speedRatio = clamp(Math.abs(state.speed) / CFG.maxSpeed, 0, 1);
    const boostPull = input.boost && state.boost > 2 ? 2.8 : 0;
    const driftLift = state.drift * 0.9;
    const trackGradeFeel = Math.sin(nearestTrackInfo(sim.position).t * 4.0 + 0.6) * 0.52;
    const desired = sim.position.clone().addScaledVector(forward, -15.5 - speedRatio * 4.4 - boostPull).add(new THREE.Vector3(0, 7.6 + speedRatio * 1.4 + driftLift + trackGradeFeel, 0));
    const shake = state.cameraShake;
    if (shake > 0.01) {
      desired.x += (Math.random() - 0.5) * shake * 0.7;
      desired.y += (Math.random() - 0.5) * shake * 0.42;
      desired.z += (Math.random() - 0.5) * shake * 0.7;
      state.cameraShake = Math.max(0, state.cameraShake - dt * CFG.cameraShakeDecay);
    }
    camera.position.lerp(desired, Math.min(1, dt * (5.5 + speedRatio * 2.2)));
    const look = sim.position.clone().addScaledVector(forward, 9 + speedRatio * 4).add(new THREE.Vector3(0, 2.1 + speedRatio * 0.45 + trackGradeFeel * 0.35, 0));
    camera.lookAt(look);
    const targetFov = CFG.cameraBaseFov + speedRatio * (CFG.cameraMaxFov - CFG.cameraBaseFov) + (input.boost && state.boost > 2 ? 5 : 0);
    camera.fov = lerp(camera.fov, targetFov, Math.min(1, dt * 3.6));
    camera.updateProjectionMatrix();
  }

  function updateDynamicMeshes() {
    for (const object of dynamicObjects) {
      const p = object.body.translation();
      const q = object.body.rotation();
      object.mesh.position.set(p.x, p.y, p.z);
      object.mesh.quaternion.set(q.x, q.y, q.z, q.w);
    }
  }

  function update(dt) {
    state.wallCooldown = Math.max(0, state.wallCooldown - dt);
    audio.update(state.speed, state.raceStatus === "countdown" || state.raceStatus === "running", state.offroad);
    if (state.quizPaused) {
      state.speed = lerp(state.speed, 0, Math.min(1, dt * 2.2));
      syncPlayer();
      updateCamera(dt);
      return;
    }
    if (updateCountdown(dt)) {
      updateCamera(dt);
      updateRank();
      return;
    }
    if (state.raceStatus === "running") {
      state.raceTimer += dt;
      state.lapTimer += dt;
      updatePlayer(dt);
      updateRivals(dt);
      resolveImpacts();
      syncPlayer();
      updateLaps();
      updateCheckpointQuiz();
      state.score += Math.max(0, state.speed) * dt * (1 + clamp(state.speed / CFG.maxSpeed, 0, 1));
    }
    if (world) {
      world.timestep = dt;
      world.step();
      updateDynamicMeshes();
    }
    updateCamera(dt);
    updateRank();
  }

  async function initPhysics() {
    try {
      await RAPIER.init();
      if (disposed) return;
      world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
      const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.06, 0));
      world.createCollider(RAPIER.ColliderDesc.cuboid(370, 0.05, 215).setFriction(1.1).setRestitution(0.02), groundBody);
      playerBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(sim.position.x, CAR_PHYSICS_Y, sim.position.z));
      world.createCollider(RAPIER.ColliderDesc.cuboid(1.55, 0.56, 2.45).setFriction(0.4).setRestitution(0.18), playerBody);
      rivals.forEach((rival) => {
        const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(rival.mesh.position.x, CAR_PHYSICS_Y, rival.mesh.position.z));
        world.createCollider(RAPIER.ColliderDesc.cuboid(1.55, 0.56, 2.45).setFriction(0.4).setRestitution(0.2), body);
        npcBodies.push(body);
      });
      for (let i = 0; i < 26; i += 1) {
        const s = placeOnTrack((i / 26) * TWO_PI, (i % 2 ? 1 : -1) * (CFG.roadWidth * 0.5 + 5.6));
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.25, 10), mat(0xff6a21, 0.58, 0.04));
        cone.position.copy(s.position).setY(0.65);
        cone.castShadow = true;
        scene.add(cone);
        const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(cone.position.x, cone.position.y, cone.position.z).setCanSleep(true));
        world.createCollider(RAPIER.ColliderDesc.cone(0.62, 0.55).setMass(0.45).setFriction(0.7).setRestitution(0.42), body);
        dynamicObjects.push({ mesh: cone, body, radius: 2.15 });
      }
      ready = true;
      resetGrid("idle");
      onMessage?.("THREE + RAPIER READY");
      if (startQueued) {
        startQueued = false;
        startRace();
      }
    } catch (error) {
      console.error(error);
      state.raceStatus = "idle";
      onMessage?.("RAPIER LOAD FAILED");
      emitHud();
    }
  }

  function resize() {
    const width = mount.clientWidth || 960;
    const height = mount.clientHeight || 540;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function loop() {
    if (disposed) return;
    const dt = Math.min(0.033, clock.getDelta());
    try {
      update(dt);
      emitHud();
      renderer.render(scene, camera);
    } catch (error) {
      console.error("Three/Rapier race loop recovered", error);
      Object.assign(state, { raceStatus: "running", lights: 4, autoThrottle: true, speed: Math.max(CFG.recoverySpeed, state.speed) });
      const info = nearestTrackInfo(sim.position);
      sim.position.copy(info.center.clone().addScaledVector(info.normal, clamp(info.lateral * 0.25, -3, 3))).setY(CAR_VISUAL_Y);
      state.heading = Math.atan2(info.tangent.x, info.tangent.z);
      syncPlayer();
    }
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize);
  resize();
  resetGrid("idle");
  onMessage?.("LOADING THREE + RAPIER");
  initPhysics();
  requestAnimationFrame(loop);

  return {
    destroy() {
      disposed = true;
      window.removeEventListener("resize", resize);
      audio.destroy();
      world?.free?.();
      renderer.dispose();
      scene.traverse((object) => {
        object.geometry?.dispose?.();
        const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
        materials.forEach((material) => {
          material.map?.dispose?.();
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
