import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { CITY_HALF, CITY_NODES, CITY_RIVER_PATH, CITY_ROADS, JUMP_RAMPS, CITY_SCENERY_HALF, CITY_SKYLINE_MAX_RADIUS, CITY_SKYLINE_MIN_RADIUS, CITY_TRAFFIC_LOOPS, DESTINATION_NODES, closestRoadPoint, distanceToRiver, isPointOnCityRoad, pathLength, roadBaseHeightAt, terrainHeightAt } from "./city-map.js";
import { buildCityBuildingPlans, buildCityLandmarkClearings } from "./city-layout.js";
import { DESTINATIONS } from "./game-data.js";
import { makeQuestion } from "./learning-packs.js";

const WORLD_HALF = CITY_HALF;
const DELIVERY_RADIUS = 12;
export const WORLD_SPEED_TO_KMH = 5;

// 레이싱 손맛 튜닝 수치는 전부 여기로 모은다 (docs/racing-feel-plan.md 참조).
export const DRIVE_TUNING = {
  overdriveRatio: 1.15,   // 터보 중 최고속 배율
  overdriveDecay: 2.6,    // 터보 해제 후 초당 감속 (world u/s²)
  boostAccel: 14.5,
  boostDrain: 30,
  boostRegen: 10,
  overheatThreshold: 25,  // 이 밑으로 태우면 과열
  overheatDelay: 2,       // 과열 시 회복 지연(초)
  fovPunch: 9,            // 터보 시작 순간 FOV 킥
  fovPunchDecay: 22,
  gearCount: 4,
  gearShiftDip: 0.35,     // 변속 순간 가속 감쇠 배율
  gearShiftTime: 0.12,
  driftMinRatio: 0.5,     // 드리프트 진입 최소 속도 비율
  driftSlipAngle: 0.31,   // 시각적 슬립각(rad) ≈ 18°
  driftYawBonus: 1.32,    // 드리프트 중 조향 배율
  driftScorePerTick: 40,  // 0.5초당 점수
  driftBoostReward: 8,    // 성공 종료 시 터보 게이지 환급
  nearMissRadius: 4.0,   // 중심 간 거리 기준
  collisionRadius: 2.3,
  nearMissScore: 60,
  nearMissBoost: 5,
  comboWindow: 8
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (value, target, smoothing, dt) => lerp(value, target, 1 - Math.exp(-smoothing * dt));

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function makeMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.72,
    metalness: options.metalness ?? 0.05,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1
  });
}

function box(width, height, depth, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function roundedBox(width, height, depth, material, radius = 0.22, x = 0, y = 0, z = 0) {
  const geometry = new RoundedBoxGeometry(width, height, depth, 3, Math.min(radius, width * 0.2, height * 0.2, depth * 0.2));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function grounded(mesh, x = mesh.position.x, z = mesh.position.z) {
  mesh.position.y += terrainHeightAt(x, z);
  return mesh;
}

function makeTextSprite(text, color = "#ffffff", background = "#25406a") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  context.fillStyle = background;
  context.roundRect(8, 8, 496, 144, 34);
  context.fill();
  context.strokeStyle = "rgba(255,255,255,.82)";
  context.lineWidth = 8;
  context.stroke();
  context.fillStyle = color;
  let fontSize = 55;
  context.font = `900 ${fontSize}px Arial, sans-serif`;
  while (fontSize > 22 && context.measureText(text).width > 470) {
    fontSize -= 3;
    context.font = `900 ${fontSize}px Arial, sans-serif`;
  }
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 256, 84);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(13, 4.1, 1);
  sprite.userData.texture = texture;
  return sprite;
}

function makeSkyTexture(mood = "morning") {
  const palettes = {
    morning: ["#55b8ea", "#9eddf4", "#d8f3f0", "#fff1c7"],
    festival: ["#687ad8", "#f39ab5", "#ffd19a", "#fff0c2"],
    space: ["#29396f", "#6d69b8", "#d792c4", "#f7c99a"]
  };
  const colors = palettes[mood] || palettes.morning;
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(0.48, colors[1]);
  gradient.addColorStop(0.78, colors[2]);
  gradient.addColorStop(1, colors[3]);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeLaneArrowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, 64, 128);
  context.fillStyle = "rgba(246,249,251,0.94)";
  context.fillRect(24, 46, 16, 74);
  context.beginPath();
  context.moveTo(32, 6);
  context.lineTo(8, 52);
  context.lineTo(56, 52);
  context.closePath();
  context.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeChevronMaterial(pointLeft) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 144;
  const context = canvas.getContext("2d");
  context.fillStyle = "#d64545";
  context.fillRect(0, 0, 256, 144);
  context.strokeStyle = "#ffffff";
  context.lineWidth = 17;
  context.lineCap = "round";
  for (let index = 0; index < 3; index += 1) {
    const centerX = 62 + index * 66;
    context.beginPath();
    if (pointLeft) {
      context.moveTo(centerX + 17, 26);
      context.lineTo(centerX - 17, 72);
      context.lineTo(centerX + 17, 118);
    } else {
      context.moveTo(centerX - 17, 26);
      context.lineTo(centerX + 17, 72);
      context.lineTo(centerX - 17, 118);
    }
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = makeMaterial(0xffffff, { roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.12 });
  material.map = texture;
  return material;
}

function makeAsphaltTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  // 재질 색과 텍스처가 곱해지는 WebGL 특성상 너무 어두운 원본 텍스처는 도로를 검게 만듭니다.
  // 중간 회색 노면을 기준으로 잡아 낮·해질녘 모두 차선과 도로 폭이 읽히게 합니다.
  context.fillStyle = "#59666e";
  context.fillRect(0, 0, 256, 256);
  for (let index = 0; index < 7200; index += 1) {
    const value = 66 + Math.floor(seeded(index + 4100, 2) * 54);
    const alpha = 0.06 + seeded(index + 4100, 3) * 0.16;
    context.fillStyle = `rgba(${value},${value + 3},${value + 6},${alpha})`;
    const size = seeded(index + 4100, 4) > 0.94 ? 2 : 1;
    context.fillRect(Math.floor(seeded(index + 4100, 5) * 256), Math.floor(seeded(index + 4100, 6) * 256), size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.4, 1.4);
  texture.anisotropy = 4;
  return texture;
}

function makeRoadSurfaceTextures() {
  const colorCanvas = document.createElement("canvas");
  const detailCanvas = document.createElement("canvas");
  colorCanvas.width = detailCanvas.width = 256;
  colorCanvas.height = detailCanvas.height = 256;
  const colorContext = colorCanvas.getContext("2d");
  const detailContext = detailCanvas.getContext("2d");

  colorContext.fillStyle = "#363d42";
  colorContext.fillRect(0, 0, 256, 256);
  detailContext.fillStyle = "#b8b8b8";
  detailContext.fillRect(0, 0, 256, 256);
  for (let index = 0; index < 8200; index += 1) {
    const x = Math.floor(seeded(index + 4100, 5) * 256);
    const y = Math.floor(seeded(index + 4100, 6) * 256);
    const grain = 34 + Math.floor(seeded(index + 4100, 2) * 44);
    const alpha = 0.035 + seeded(index + 4100, 3) * 0.1;
    const size = seeded(index + 4100, 4) > 0.965 ? 2 : 1;
    colorContext.fillStyle = `rgba(${grain},${grain + 3},${grain + 5},${alpha})`;
    colorContext.fillRect(x, y, size, size);
    const detail = 132 + Math.floor(seeded(index + 5100, 2) * 92);
    detailContext.fillStyle = `rgb(${detail},${detail},${detail})`;
    detailContext.fillRect(x, y, size, size);
  }

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(detailCanvas);
  for (const texture of [colorMap, bumpMap]) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.25, 1.25);
    texture.anisotropy = 8;
  }
  return { colorMap, bumpMap };
}

function createBoxInstances(scene, specs, material, { castShadow = false, receiveShadow = true, geometry = null } = {}) {
  if (!specs.length) return null;
  const mesh = new THREE.InstancedMesh(geometry || new THREE.BoxGeometry(1, 1, 1), material, specs.length);
  const helper = new THREE.Object3D();
  specs.forEach((spec, index) => {
    helper.position.set(spec.x, spec.y, spec.z);
    helper.scale.set(spec.width, spec.height, spec.depth);
    helper.rotation.set(0, spec.rotation || 0, 0);
    helper.updateMatrix();
    mesh.setMatrixAt(index, helper.matrix);
    if (spec.color !== undefined) mesh.setColorAt(index, new THREE.Color(spec.color));
  });
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  scene.add(mesh);
  return mesh;
}

function registerCameraObstacle(scene, object) {
  if (!object) return object;
  if (!scene.userData.cameraObstacles) scene.userData.cameraObstacles = [];
  scene.userData.cameraObstacles.push(object);
  return object;
}

function disposeObjectTree(root) {
  root?.traverse?.((object) => {
    object.geometry?.dispose?.();
    const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
    for (const material of materials) {
      material.map?.dispose?.();
      material.normalMap?.dispose?.();
      material.bumpMap?.dispose?.();
      material.roughnessMap?.dispose?.();
      material.metalnessMap?.dispose?.();
      material.dispose?.();
    }
  });
}

function createSkyline(scene) {
  const towerSpecs = [];
  const crownSpecs = [];
  const windowSpecs = [];
  const skylineColors = [0x9fc4d8, 0xb7d2e0, 0xc8d8e0, 0x94b8cc, 0xa8ccc4];
  for (let index = 0; index < 62; index += 1) {
    const angle = (index / 62) * Math.PI * 2 + seeded(index + 20, 1) * 0.045;
    // 외곽 고속 순환로 밖에만 원경 스카이라인을 배치해 도로를 침범하지 않습니다.
    const radius = CITY_SKYLINE_MIN_RADIUS + seeded(index + 20, 2) * (CITY_SKYLINE_MAX_RADIUS - CITY_SKYLINE_MIN_RADIUS);
    const width = 10 + seeded(index + 20, 3) * 11;
    const depth = 9 + seeded(index + 20, 4) * 10;
    const coastalBoost = Math.max(0, Math.cos(angle)) * 28;
    const height = 32 + seeded(index + 20, 5) * 58 + coastalBoost;
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    const baseY = terrainHeightAt(x, z);
    const rotation = -angle + (seeded(index + 20, 6) - 0.5) * 0.12;
    towerSpecs.push({ x, y: baseY + height / 2, z, width, height, depth, rotation, color: skylineColors[index % skylineColors.length] });
    crownSpecs.push({ x, y: baseY + height - 1.1, z, width: width * 1.05, height: 1.15, depth: depth * 1.05, rotation, color: index % 4 === 0 ? 0x7de8ff : 0xf2bf57 });
    const floorCount = Math.max(3, Math.floor(height / 7));
    const columns = width > 15 ? 3 : 2;
    for (let floor = 0; floor < floorCount; floor += 1) {
      for (let column = 0; column < columns; column += 1) {
        if (seeded(index * 31 + floor * 7 + column, 9) < 0.24) continue;
        const offset = columns === 2 ? (column ? 0.24 : -0.24) : (column - 1) * 0.27;
        const localX = offset * width;
        const localZ = depth / 2 + 0.08;
        windowSpecs.push({
          x: x + localX * Math.cos(rotation) + localZ * Math.sin(rotation),
          y: baseY + 4.6 + floor * 6.2,
          z: z - localX * Math.sin(rotation) + localZ * Math.cos(rotation),
          width: width / (columns + 1.45), height: 1.2, depth: 0.13, rotation,
          color: seeded(index + floor, column) > 0.48 ? 0xffd37c : 0x7ddfff
        });
      }
    }
  }
  createBoxInstances(scene, towerSpecs, makeMaterial(0xffffff, { roughness: 0.5, metalness: 0.16 }));
  const skylineGlow = makeMaterial(0xffffff, { roughness: 0.18, emissive: 0xffc963, emissiveIntensity: 0.62 });
  createBoxInstances(scene, crownSpecs, skylineGlow, { receiveShadow: false });
  createBoxInstances(scene, windowSpecs, skylineGlow, { receiveShadow: false });
  scene.userData.skylineGlowMaterial = skylineGlow;
}

function createClouds(scene) {
  // 로우폴리 구름: 납작한 아이코사히드론 3덩이 = 구름 1개. 전체가 천천히 표류한다.
  const cloudMaterial = makeMaterial(0xffffff, { roughness: 1, transparent: true, opacity: 0.92, emissive: 0xffffff, emissiveIntensity: 0.18 });
  const puffGeometry = new THREE.IcosahedronGeometry(1, 0);
  const specs = [];
  for (let index = 0; index < 22; index += 1) {
    const angle = seeded(index + 40, 1) * Math.PI * 2;
    const radius = 70 + seeded(index + 40, 2) * 260;
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    // 스카이라인(최고 ~90) 사이·위로 보이도록 낮게 깔되, 시내 상공에도 몇 점 띄운다.
    const y = 46 + seeded(index + 40, 3) * 28;
    const scale = 8 + seeded(index + 40, 4) * 10;
    specs.push({ x, y, z, width: scale * 1.9, height: scale * 0.62, depth: scale, rotation: angle });
    specs.push({ x: x + scale * 1.15, y: y - scale * 0.1, z: z + scale * 0.35, width: scale * 1.25, height: scale * 0.5, depth: scale * 0.8, rotation: angle });
    specs.push({ x: x - scale * 1.05, y: y - scale * 0.14, z: z - scale * 0.3, width: scale * 1.05, height: scale * 0.45, depth: scale * 0.72, rotation: angle });
  }
  const mesh = new THREE.InstancedMesh(puffGeometry, cloudMaterial, specs.length);
  const helper = new THREE.Object3D();
  specs.forEach((spec, index) => {
    helper.position.set(spec.x, spec.y, spec.z);
    helper.scale.set(spec.width, spec.height, spec.depth);
    helper.rotation.set(0, spec.rotation, 0);
    helper.updateMatrix();
    mesh.setMatrixAt(index, helper.matrix);
  });
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  scene.add(mesh);
  scene.userData.cloudLayer = mesh;
}

function createRibbonMesh(path, width, material, y = 0.1) {
  const positions = [];
  const indices = [];
  for (let index = 0; index < path.length; index += 1) {
    const previous = path[Math.max(0, index - 1)];
    const next = path[Math.min(path.length - 1, index + 1)];
    const dx = next.x - previous.x;
    const dz = next.z - previous.z;
    const length = Math.hypot(dx, dz) || 1;
    const nx = -dz / length;
    const nz = dx / length;
    positions.push(path[index].x + nx * width / 2, terrainHeightAt(path[index].x, path[index].z) + y, path[index].z + nz * width / 2);
    positions.push(path[index].x - nx * width / 2, terrainHeightAt(path[index].x, path[index].z) + y, path[index].z - nz * width / 2);
    if (index < path.length - 1) {
      const base = index * 2;
      indices.push(base, base + 2, base + 1, base + 2, base + 3, base + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  sceneAddUvs(geometry, path);
  return mesh;
}

function roadSurfaceHeight(road, pathPosition, lift = 0.32) {
  const maxIndex = Math.max(1, road.path.length - 1);
  const clampedPosition = clamp(pathPosition, 0, maxIndex);
  if (road.bridge) {
    const bridgeT = clampedPosition / maxIndex;
    const bridgeArch = Math.sin(bridgeT * Math.PI) * 1.8;
    return lerp(roadBaseHeightAt(road, 0), roadBaseHeightAt(road, maxIndex), bridgeT) + bridgeArch + lift;
  }
  return roadBaseHeightAt(road, clampedPosition) + lift;
}

function drivingSurfaceHeightAt(x, z) {
  const hit = closestRoadPoint(x, z);
  if (!hit || hit.distance > hit.road.width / 2 + 2.4) return terrainHeightAt(x, z);
  return roadSurfaceHeight(hit.road, hit.segmentIndex + hit.t, 0.32);
}

function roadSamplesBetween(road, requestedStartInset = 0, requestedEndInset = 0) {
  const cumulative = [0];
  for (let index = 1; index < road.path.length; index += 1) {
    cumulative.push(cumulative.at(-1) + Math.hypot(road.path[index].x - road.path[index - 1].x, road.path[index].z - road.path[index - 1].z));
  }
  const totalDistance = cumulative.at(-1);
  const startInset = clamp(requestedStartInset, 0, totalDistance * 0.42);
  const endInset = clamp(requestedEndInset, 0, totalDistance * 0.42);
  const sampleAtDistance = (distance) => {
    for (let index = 1; index < cumulative.length; index += 1) {
      if (cumulative[index] < distance) continue;
      const segmentLength = Math.max(0.001, cumulative[index] - cumulative[index - 1]);
      const t = (distance - cumulative[index - 1]) / segmentLength;
      return {
        point: {
          x: lerp(road.path[index - 1].x, road.path[index].x, t),
          z: lerp(road.path[index - 1].z, road.path[index].z, t)
        },
        pathPosition: index - 1 + t
      };
    }
    return { point: road.path.at(-1), pathPosition: road.path.length - 1 };
  };
  const finishDistance = totalDistance - endInset;
  const samples = [sampleAtDistance(startInset)];
  for (let index = 1; index < road.path.length - 1; index += 1) {
    if (cumulative[index] > startInset && cumulative[index] < finishDistance) {
      samples.push({ point: road.path[index], pathPosition: index });
    }
  }
  samples.push(sampleAtDistance(finishDistance));
  return samples;
}

function createRoadDeckMesh(road, width, material, { lift = 0.2, thickness = 0.5, startInset = 0, endInset = 0, offset = 0 } = {}) {
  const positions = [];
  const indices = [];
  const uvs = [];
  const roadSamples = roadSamplesBetween(road, startInset, endInset);
  let textureDistance = 0;
  for (let index = 0; index < roadSamples.length; index += 1) {
    const sample = roadSamples[index];
    const rawPoint = sample.point;
    const previous = roadSamples[Math.max(0, index - 1)].point;
    const next = roadSamples[Math.min(roadSamples.length - 1, index + 1)].point;
    const dx = next.x - previous.x;
    const dz = next.z - previous.z;
    const length = Math.hypot(dx, dz) || 1;
    const nx = -dz / length;
    const nz = dx / length;
    // offset은 도로 중심선에서 법선 방향으로 데크를 평행 이동시킵니다(인도용).
    const point = { x: rawPoint.x + nx * offset, z: rawPoint.z + nz * offset };
    const topY = roadSurfaceHeight(road, sample.pathPosition, lift);
    const bottomY = topY - thickness;
    if (index > 0) textureDistance += Math.hypot(point.x - previous.x, point.z - previous.z);
    const textureV = textureDistance / 10;
    positions.push(
      point.x + nx * width / 2, topY, point.z + nz * width / 2,
      point.x - nx * width / 2, topY, point.z - nz * width / 2,
      point.x + nx * width / 2, bottomY, point.z + nz * width / 2,
      point.x - nx * width / 2, bottomY, point.z - nz * width / 2
    );
    uvs.push(0, textureV, 1, textureV, 0, textureV, 1, textureV);
    if (index >= roadSamples.length - 1) continue;
    const current = index * 4;
    const following = current + 4;
    indices.push(
      current, following, current + 1, following, following + 1, current + 1,
      current + 2, current + 3, following + 2, following + 2, current + 3, following + 3,
      current, current + 2, following, following, current + 2, following + 2,
      current + 1, following + 1, current + 3, following + 1, following + 3, current + 3
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = road.bridge || road.skyway;
  mesh.receiveShadow = true;
  return mesh;
}

function createRoadMarkingMesh(road, offsets, lineWidth, material, { startInset = 6.5, endInset = 6.5 } = {}) {
  const positions = [];
  const indices = [];
  const roadSamples = roadSamplesBetween(road, startInset, endInset);
  for (const offset of offsets) {
    const stripeStart = positions.length / 3;
    for (let index = 0; index < roadSamples.length; index += 1) {
      const sample = roadSamples[index];
      const point = sample.point;
      const previous = roadSamples[Math.max(0, index - 1)].point;
      const next = roadSamples[Math.min(roadSamples.length - 1, index + 1)].point;
      const dx = next.x - previous.x;
      const dz = next.z - previous.z;
      const length = Math.hypot(dx, dz) || 1;
      const nx = -dz / length;
      const nz = dx / length;
      const centerX = point.x + nx * offset;
      const centerZ = point.z + nz * offset;
      const y = roadSurfaceHeight(road, sample.pathPosition, 0.382);
      positions.push(
        centerX + nx * lineWidth / 2, y, centerZ + nz * lineWidth / 2,
        centerX - nx * lineWidth / 2, y, centerZ - nz * lineWidth / 2
      );
      if (index >= roadSamples.length - 1) continue;
      const current = stripeStart + index * 2;
      const following = current + 2;
      indices.push(current, following, current + 1, following, following + 1, current + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.renderOrder = 2;
  return mesh;
}

const smoothRoadCache = new WeakMap();

function getSmoothRoadData(road) {
  const cached = smoothRoadCache.get(road);
  if (cached) return cached;
  const points = road.path.map((point) => new THREE.Vector3(point.x, 0, point.z));
  const curve = points.length === 2
    ? new THREE.LineCurve3(points[0], points[1])
    : new THREE.CatmullRomCurve3(points, false, "centripetal", 0.5);
  curve.arcLengthDivisions = Math.max(120, Math.ceil(pathLength(road.path) * 2.4));
  const length = Math.max(0.001, curve.getLength());
  const originalCumulative = [0];
  for (let index = 1; index < road.path.length; index += 1) {
    originalCumulative.push(originalCumulative.at(-1) + Math.hypot(
      road.path[index].x - road.path[index - 1].x,
      road.path[index].z - road.path[index - 1].z
    ));
  }
  const data = { curve, length, originalCumulative, originalLength: Math.max(0.001, originalCumulative.at(-1)) };
  smoothRoadCache.set(road, data);
  return data;
}

function pathPositionAtRoadFraction(road, fraction) {
  const data = getSmoothRoadData(road);
  const target = clamp(fraction, 0, 1) * data.originalLength;
  for (let index = 1; index < data.originalCumulative.length; index += 1) {
    if (data.originalCumulative[index] < target) continue;
    const segmentLength = Math.max(0.001, data.originalCumulative[index] - data.originalCumulative[index - 1]);
    return index - 1 + (target - data.originalCumulative[index - 1]) / segmentLength;
  }
  return road.path.length - 1;
}

function smoothRoadSampleAt(road, distance) {
  const data = getSmoothRoadData(road);
  const clampedDistance = clamp(distance, 0, data.length);
  const fraction = clampedDistance / data.length;
  const point = data.curve.getPointAt(fraction);
  const tangent = data.curve.getTangentAt(fraction).normalize();
  return {
    point: { x: point.x, z: point.z },
    tangent: { x: tangent.x, z: tangent.z },
    pathPosition: pathPositionAtRoadFraction(road, fraction),
    distance: clampedDistance
  };
}

function smoothRoadSamplesBetween(road, requestedStartInset = 0, requestedEndInset = 0, spacing = 0.85) {
  const data = getSmoothRoadData(road);
  const startInset = clamp(requestedStartInset, 0, data.length * 0.42);
  const endInset = clamp(requestedEndInset, 0, data.length * 0.42);
  const finishDistance = Math.max(startInset, data.length - endInset);
  const segmentCount = Math.max(1, Math.ceil((finishDistance - startInset) / Math.max(0.35, spacing)));
  const samples = [];
  for (let index = 0; index <= segmentCount; index += 1) {
    samples.push(smoothRoadSampleAt(road, lerp(startInset, finishDistance, index / segmentCount)));
  }
  return samples;
}

function createSmoothRoadDeckMesh(road, width, material, { lift = 0.2, thickness = 0.5, startInset = 0, endInset = 0, offset = 0, spacing = 0.85 } = {}) {
  const positions = [];
  const indices = [];
  const uvs = [];
  const roadSamples = smoothRoadSamplesBetween(road, startInset, endInset, spacing);
  for (let index = 0; index < roadSamples.length; index += 1) {
    const sample = roadSamples[index];
    const nx = -sample.tangent.z;
    const nz = sample.tangent.x;
    const pointX = sample.point.x + nx * offset;
    const pointZ = sample.point.z + nz * offset;
    const topY = roadSurfaceHeight(road, sample.pathPosition, lift);
    const bottomY = topY - thickness;
    const textureV = (sample.distance - roadSamples[0].distance) / 10;
    positions.push(
      pointX + nx * width / 2, topY, pointZ + nz * width / 2,
      pointX - nx * width / 2, topY, pointZ - nz * width / 2,
      pointX + nx * width / 2, bottomY, pointZ + nz * width / 2,
      pointX - nx * width / 2, bottomY, pointZ - nz * width / 2
    );
    const textureU = Math.max(0.25, width / 10);
    uvs.push(0, textureV, textureU, textureV, 0, textureV, textureU, textureV);
    if (index >= roadSamples.length - 1) continue;
    const current = index * 4;
    const following = current + 4;
    indices.push(
      current, following, current + 1, following, following + 1, current + 1,
      current + 2, current + 3, following + 2, following + 2, current + 3, following + 3,
      current, current + 2, following, following, current + 2, following + 2,
      current + 1, following + 1, current + 3, following + 1, following + 3, current + 3
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = road.bridge || road.skyway;
  mesh.receiveShadow = true;
  return mesh;
}

function createRoadPaintMesh(road, offsets, lineWidth, material, {
  startInset = 0,
  endInset = 0,
  dashLength = 0,
  gapLength = 0,
  lift = 0.348,
  dashOffset = 0
} = {}) {
  const positions = [];
  const indices = [];
  const samples = smoothRoadSamplesBetween(road, startInset, endInset, 0.72);
  const dashPeriod = dashLength + gapLength;
  for (const offset of offsets) {
    for (let index = 0; index < samples.length - 1; index += 1) {
      const start = samples[index];
      const finish = samples[index + 1];
      const midpoint = (start.distance + finish.distance) / 2 + dashOffset;
      if (dashPeriod > 0 && ((midpoint % dashPeriod) + dashPeriod) % dashPeriod >= dashLength) continue;
      const startNx = -start.tangent.z;
      const startNz = start.tangent.x;
      const finishNx = -finish.tangent.z;
      const finishNz = finish.tangent.x;
      const startX = start.point.x + startNx * offset;
      const startZ = start.point.z + startNz * offset;
      const finishX = finish.point.x + finishNx * offset;
      const finishZ = finish.point.z + finishNz * offset;
      const startY = roadSurfaceHeight(road, start.pathPosition, lift);
      const finishY = roadSurfaceHeight(road, finish.pathPosition, lift);
      const vertex = positions.length / 3;
      positions.push(
        startX + startNx * lineWidth / 2, startY, startZ + startNz * lineWidth / 2,
        startX - startNx * lineWidth / 2, startY, startZ - startNz * lineWidth / 2,
        finishX + finishNx * lineWidth / 2, finishY, finishZ + finishNz * lineWidth / 2,
        finishX - finishNx * lineWidth / 2, finishY, finishZ - finishNz * lineWidth / 2
      );
      indices.push(vertex, vertex + 2, vertex + 1, vertex + 2, vertex + 3, vertex + 1);
    }
  }
  if (!indices.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.renderOrder = 3;
  return mesh;
}

function junctionApproaches(nodeId, roads) {
  const node = CITY_NODES[nodeId];
  return roads.map((road) => {
    const startsHere = road.a === nodeId;
    const inner = startsHere ? road.path[Math.min(1, road.path.length - 1)] : road.path[Math.max(0, road.path.length - 2)];
    const dx = inner.x - node.x;
    const dz = inner.z - node.z;
    const length = Math.hypot(dx, dz) || 1;
    return { road, x: dx / length, z: dz / length };
  });
}

function createJunctionSurfaceMesh(nodeId, junction, material, { depth, extra = 0, lift = 0.34 } = {}) {
  const node = CITY_NODES[nodeId];
  const approaches = junctionApproaches(nodeId, junction.roads);
  const resolution = Math.max(72, junction.degree * 18);
  const minimumHalfWidth = Math.min(...junction.roads.map((road) => road.width / 2 + extra));
  const coreRadius = Math.max(2.8 + extra, minimumHalfWidth * 0.24);
  const radii = [];
  for (let index = 0; index < resolution; index += 1) {
    const angle = index / resolution * Math.PI * 2;
    const rayX = Math.cos(angle);
    const rayZ = Math.sin(angle);
    let radius = coreRadius;
    for (const approach of approaches) {
      const forward = rayX * approach.x + rayZ * approach.z;
      if (forward <= 0.001) continue;
      const sideways = Math.abs(rayX * approach.z - rayZ * approach.x);
      const halfWidth = approach.road.width / 2 + extra;
      const forwardLimit = depth / forward;
      const sideLimit = halfWidth / Math.max(0.0001, sideways);
      radius = Math.max(radius, Math.min(forwardLimit, sideLimit));
    }
    radii.push(radius);
  }

  const positions = [node.x, terrainHeightAt(node.x, node.z) + lift, node.z];
  const uvs = [node.x / 12, node.z / 12];
  const indices = [];
  const topY = terrainHeightAt(node.x, node.z) + lift;
  for (let index = 0; index < resolution; index += 1) {
    const angle = index / resolution * Math.PI * 2;
    positions.push(node.x + Math.cos(angle) * radii[index], topY, node.z + Math.sin(angle) * radii[index]);
    uvs.push((node.x + Math.cos(angle) * radii[index]) / 12, (node.z + Math.sin(angle) * radii[index]) / 12);
  }
  for (let index = 0; index < resolution; index += 1) {
    const current = index + 1;
    const next = (index + 1) % resolution + 1;
    indices.push(0, next, current);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

function createMountainTerrain(scene) {
  const segments = 112;
  const size = CITY_SCENERY_HALF * 2;
  const positions = [];
  const colors = [];
  const indices = [];
  const concrete = new THREE.Color(0xa4afb2);
  const park = new THREE.Color(0x6f896d);
  const waterfront = new THREE.Color(0x59767b);
  const citySoil = new THREE.Color(0x748074);
  for (let zIndex = 0; zIndex <= segments; zIndex += 1) {
    const z = -size / 2 + (zIndex / segments) * size;
    for (let xIndex = 0; xIndex <= segments; xIndex += 1) {
      const x = -size / 2 + (xIndex / segments) * size;
      const y = terrainHeightAt(x, z);
      positions.push(x, y, z);
      const cityCore = clamp(1 - Math.hypot(x, z - 38) / 350, 0, 1);
      const harbourZone = clamp((z - 142) / 182, 0, 1);
      const parkPattern = clamp((Math.sin(x * 0.041) + Math.cos(z * 0.034) + 1.15) / 2.9, 0, 1);
      const base = new THREE.Color().lerpColors(citySoil, concrete, cityCore * 0.82);
      base.lerp(park, (1 - cityCore) * parkPattern * 0.54);
      base.lerp(waterfront, harbourZone * 0.18);
      colors.push(base.r, base.g, base.b);
      if (xIndex < segments && zIndex < segments) {
        const row = segments + 1;
        const a = zIndex * row + xIndex;
        indices.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const terrain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
  terrain.receiveShadow = true;
  scene.add(terrain);

  const sea = box(CITY_SCENERY_HALF * 2, 0.45, 180, makeMaterial(0x356d85, { roughness: 0.2, metalness: 0.12 }), 0, 0.8, 410);
  sea.castShadow = false;
  scene.add(sea);
}

function sceneAddUvs(geometry) {
  const position = geometry.getAttribute("position");
  const uvs = [];
  for (let index = 0; index < position.count; index += 1) uvs.push(index % 2, Math.floor(index / 2));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
}

function createRoadNetwork(scene) {
  const markerSpecs = [];
  const localMarkerSpecs = [];
  const bridgeRailSpecs = [];
  const junctionShoulderSpecs = [];
  const junctionSurfaceSpecs = [];
  const crosswalkSpecs = [];
  const laneArrowSpecs = [];
  const lampPostSpecs = [];
  const lampHeadSpecs = [];
  const pierSpecs = [];
  const rumbleRedSpecs = [];
  const rumbleWhiteSpecs = [];
  const shoulderMaterial = makeMaterial(0x50575d, { roughness: 0.98 });
  const sidewalkMaterial = makeMaterial(0xd8dfe3, { roughness: 0.96 });
  const gutterMaterial = makeMaterial(0x39434b, { roughness: 0.96 });
  const asphaltTexture = makeAsphaltTexture();
  const asphaltMaterial = makeMaterial(0xffffff, { roughness: 0.94 });
  asphaltMaterial.map = asphaltTexture;
  const bridgeAsphaltMaterial = makeMaterial(0xd4dde1, { roughness: 0.92 });
  bridgeAsphaltMaterial.map = asphaltTexture;
  const edgeLineMaterial = makeMaterial(0xf5f7f8, { roughness: 0.76, emissive: 0xffffff, emissiveIntensity: 0.12 });
  const centerLineMaterial = makeMaterial(0xffc928, { roughness: 0.72, emissive: 0xffb000, emissiveIntensity: 0.22 });
  scene.userData.roadGlowMaterials = [edgeLineMaterial, centerLineMaterial];
  const nodeDegree = new Map();
  for (const road of CITY_ROADS) {
    nodeDegree.set(road.a, (nodeDegree.get(road.a) || 0) + 1);
    nodeDegree.set(road.b, (nodeDegree.get(road.b) || 0) + 1);
  }
  const junctionInfo = new Map();
  for (const [nodeId, degree] of nodeDegree) {
    if (degree < 2) continue;
    const connectedRoads = CITY_ROADS.filter((road) => road.a === nodeId || road.b === nodeId);
    const widestRoad = Math.max(...connectedRoads.map((road) => road.width));
    junctionInfo.set(nodeId, {
      degree,
      shoulderRadius: widestRoad / 2 + (degree >= 3 ? 1.8 : 1.15),
      surfaceRadius: widestRoad / 2 + (degree >= 3 ? 1.2 : 0.72)
    });
  }

  for (const road of CITY_ROADS) {
    const startJunction = junctionInfo.get(road.a);
    const endJunction = junctionInfo.get(road.b);
    const elevatedDeck = road.bridge || road.skyway;
    const shoulderWidth = road.width + (elevatedDeck ? 3.2 : 2.5);
    const circleJoinInset = (junction, radius, halfRoadWidth) => {
      if (!junction) return 0;
      return Math.max(0, Math.sqrt(Math.max(0, radius * radius - halfRoadWidth * halfRoadWidth)) - 0.55);
    };
    const shoulderStartInset = circleJoinInset(startJunction, startJunction?.shoulderRadius || 0, shoulderWidth / 2);
    const shoulderEndInset = circleJoinInset(endJunction, endJunction?.shoulderRadius || 0, shoulderWidth / 2);
    const surfaceStartInset = circleJoinInset(startJunction, startJunction?.surfaceRadius || 0, road.width / 2);
    const surfaceEndInset = circleJoinInset(endJunction, endJunction?.surfaceRadius || 0, road.width / 2);
    scene.add(createRoadDeckMesh(road, shoulderWidth, shoulderMaterial, {
      lift: 0.2, thickness: elevatedDeck ? 1.05 : 0.5, startInset: shoulderStartInset, endInset: shoulderEndInset
    }));
    scene.add(createRoadDeckMesh(road, road.width, elevatedDeck ? bridgeAsphaltMaterial : asphaltMaterial, {
      lift: 0.34, thickness: elevatedDeck ? 0.88 : 0.42, startInset: surfaceStartInset, endInset: surfaceEndInset
    }));

    // 스카이웨이 교각: 데크 아래를 일정 간격 콘크리트 기둥이 받친다.
    if (road.skyway) {
      const roadLengthTotal = pathLength(road.path);
      for (let pierDistance = 14; pierDistance < roadLengthTotal - 14; pierDistance += 20) {
        const spot = pointAlongRoute(road.path, pierDistance);
        if (!spot) continue;
        const pathPosition = pierDistance / roadLengthTotal * (road.path.length - 1);
        const deckBottom = roadSurfaceHeight(road, pathPosition, 0.2) - 1.0;
        const groundHeight = terrainHeightAt(spot.x, spot.z);
        if (deckBottom - groundHeight < 1.4) continue;
        pierSpecs.push({
          x: spot.x, y: (deckBottom + groundHeight) / 2, z: spot.z,
          width: 1.8, height: deckBottom - groundHeight, depth: 1.8,
          rotation: Math.atan2(spot.dirX, spot.dirZ)
        });
        pierSpecs.push({
          x: spot.x, y: deckBottom - 0.35, z: spot.z,
          width: road.width + 1.6, height: 0.7, depth: 1.6,
          rotation: Math.atan2(spot.dirX, spot.dirZ)
        });
      }
    }

    // 아스팔트보다 높은 연석 인도를 도로 양쪽에 두르면 도시 골목의 스케일이 살아납니다.
    if (!elevatedDeck && road.type !== "alley") {
      const sidewalkWidth = 2.3;
      const sidewalkOffset = road.width / 2 + 1.05 + sidewalkWidth / 2;
      for (const side of [-1, 1]) {
        scene.add(createRoadDeckMesh(road, sidewalkWidth, sidewalkMaterial, {
          lift: 0.52,
          thickness: 0.74,
          startInset: Math.max(shoulderStartInset + 2.4, 2.4),
          endInset: Math.max(shoulderEndInset + 2.4, 2.4),
          offset: side * sidewalkOffset
        }));
      }
    }

    // 3거리 이상 교차로 진입부마다 횡단보도를 그려 교차로가 읽히게 합니다.
    for (const [junction, nodeEndIndex] of [[startJunction, 0], [endJunction, 1]]) {
      if (!junction || junction.degree < 3 || elevatedDeck) continue;
      const nodePoint = nodeEndIndex === 0 ? road.path[0] : road.path.at(-1);
      const innerPoint = nodeEndIndex === 0 ? road.path[1] : road.path.at(-2);
      const dirX = innerPoint.x - nodePoint.x;
      const dirZ = innerPoint.z - nodePoint.z;
      const dirLength = Math.hypot(dirX, dirZ) || 1;
      const ux = dirX / dirLength;
      const uz = dirZ / dirLength;
      const crossX = nodePoint.x + ux * (junction.surfaceRadius + 2.2);
      const crossZ = nodePoint.z + uz * (junction.surfaceRadius + 2.2);
      const crossY = drivingSurfaceHeightAt(crossX, crossZ) + 0.062;
      const stripeCount = Math.max(4, Math.floor(road.width / 1.45));
      for (let stripe = 0; stripe < stripeCount; stripe += 1) {
        const lateral = (stripe / Math.max(1, stripeCount - 1) - 0.5) * (road.width - 1.7);
        crosswalkSpecs.push({
          x: crossX - uz * lateral, y: crossY, z: crossZ + ux * lateral,
          width: 0.6, height: 0.045, depth: 1.9, rotation: Math.atan2(ux, uz)
        });
      }
      // 횡단보도 앞 정지선 — 교차로에서 멈출 위치가 그림만으로 읽히게
      const stopX = crossX + ux * 2.1;
      const stopZ = crossZ + uz * 2.1;
      crosswalkSpecs.push({
        x: stopX, y: drivingSurfaceHeightAt(stopX, stopZ) + 0.062, z: stopZ,
        width: road.width - 1.7, height: 0.045, depth: 0.5, rotation: Math.atan2(ux, uz)
      });
      // 정지선 뒤 차선 화살표 데칼 — 간선은 차로별 2개, 지선은 중앙 1개
      const arrowOffsets = road.type === "arterial" ? [-road.width * 0.245, road.width * 0.245] : [0];
      const arrowX = crossX + ux * 6.4;
      const arrowZ = crossZ + uz * 6.4;
      for (const lateral of arrowOffsets) {
        laneArrowSpecs.push({
          x: arrowX - uz * lateral, y: drivingSurfaceHeightAt(arrowX, arrowZ) + 0.066, z: arrowZ + ux * lateral,
          width: 1.05, height: 1, depth: 2.4, rotation: Math.atan2(-ux, -uz)
        });
      }
    }
    const edgeOffset = Math.max(2.1, road.width / 2 - 0.62);
    scene.add(createRoadMarkingMesh(road, [-edgeOffset, edgeOffset], 0.18, edgeLineMaterial, {
      startInset: startJunction ? startJunction.surfaceRadius + 1.2 : 0,
      endInset: endJunction ? endJunction.surfaceRadius + 1.2 : 0
    }));
    // 흰 실선 바깥의 어두운 거터 라인 — 노면에 폭 정보를 한 겹 더 준다.
    if (!elevatedDeck && road.type !== "alley") {
      const gutterOffset = road.width / 2 - 0.18;
      scene.add(createRoadMarkingMesh(road, [-gutterOffset, gutterOffset], 0.3, gutterMaterial, {
        startInset: startJunction ? startJunction.surfaceRadius + 0.9 : 0,
        endInset: endJunction ? endJunction.surfaceRadius + 0.9 : 0
      }));
    }
    if (road.type !== "local" && road.type !== "alley") {
      scene.add(createRoadMarkingMesh(road, [-0.2, 0.2], 0.12, centerLineMaterial, {
        startInset: startJunction ? startJunction.surfaceRadius + 1.2 : 0,
        endInset: endJunction ? endJunction.surfaceRadius + 1.2 : 0
      }));
    }

    // 가로등: 간선·보조 도로의 인도 위에 26m 간격, 좌우 교대로 세운다.
    if (!elevatedDeck && road.type !== "local" && road.type !== "alley") {
      const roadLength = pathLength(road.path);
      const lampLateral = road.width / 2 + 1.05 + 1.15;
      let lampDistance = Math.max(9, surfaceStartInset + 6);
      let lampSide = 1;
      const lampSample = (distance) => {
        let walked = 0;
        for (let segment = 0; segment < road.path.length - 1; segment += 1) {
          const from = road.path[segment];
          const to = road.path[segment + 1];
          const segmentLength = Math.hypot(to.x - from.x, to.z - from.z);
          if (walked + segmentLength >= distance) {
            const t = (distance - walked) / Math.max(0.001, segmentLength);
            return {
              x: lerp(from.x, to.x, t), z: lerp(from.z, to.z, t),
              nx: -(to.z - from.z) / Math.max(0.001, segmentLength),
              nz: (to.x - from.x) / Math.max(0.001, segmentLength),
              heading: Math.atan2(to.x - from.x, to.z - from.z)
            };
          }
          walked += segmentLength;
        }
        return null;
      };
      while (lampDistance < roadLength - Math.max(9, surfaceEndInset + 6)) {
        const spot = lampSample(lampDistance);
        if (spot) {
          const lampX = spot.x + spot.nx * lampLateral * lampSide;
          const lampZ = spot.z + spot.nz * lampLateral * lampSide;
          const lampBase = terrainHeightAt(lampX, lampZ);
          lampPostSpecs.push({ x: lampX, y: lampBase + 2.65, z: lampZ, width: 0.15, height: 4.7, depth: 0.15 });
          const armDir = -lampSide;
          lampPostSpecs.push({
            x: lampX + spot.nx * armDir * 0.75, y: lampBase + 4.9, z: lampZ + spot.nz * armDir * 0.75,
            width: 0.12, height: 0.12, depth: 1.6, rotation: spot.heading + Math.PI / 2
          });
          lampHeadSpecs.push({
            x: lampX + spot.nx * armDir * 1.45, y: lampBase + 4.82, z: lampZ + spot.nz * armDir * 1.45,
            width: 0.55, height: 0.2, depth: 0.9, rotation: spot.heading
          });
        }
        lampDistance += 26;
        lampSide *= -1;
      }
    }

    const roadTotalLength = pathLength(road.path);
    let roadWalked = 0;
    let nextMarkerDistance = Math.max(6, surfaceStartInset + 3.4);
    const markerFinishDistance = roadTotalLength - Math.max(6, surfaceEndInset + 3.4);
    for (let segmentIndex = 0; segmentIndex < road.path.length - 1; segmentIndex += 1) {
      const start = road.path[segmentIndex];
      const end = road.path[segmentIndex + 1];
      const dx = end.x - start.x;
      const dz = end.z - start.z;
      const length = Math.hypot(dx, dz);
      const angle = Math.atan2(dx, dz);
      const nx = -dz / Math.max(length, 0.001);
      const nz = dx / Math.max(length, 0.001);
      while (nextMarkerDistance <= roadWalked + length && nextMarkerDistance <= markerFinishDistance) {
        const t = (nextMarkerDistance - roadWalked) / Math.max(0.001, length);
        const offsets = road.type === "arterial" ? [-road.width * 0.245, road.width * 0.245] : road.type === "local" ? [0] : [];
        for (const offset of offsets) {
          const markerX = lerp(start.x, end.x, t) + nx * offset;
          const markerZ = lerp(start.z, end.z, t) + nz * offset;
          (road.type === "arterial" ? markerSpecs : localMarkerSpecs).push({
            x: markerX, y: roadSurfaceHeight(road, segmentIndex + t, 0.385), z: markerZ,
            width: 0.16, height: 0.04, depth: 4.8, rotation: angle
          });
        }
        nextMarkerDistance += 12;
      }
      if (road.bridge || road.skyway) {
        const midX = (start.x + end.x) / 2;
        const midZ = (start.z + end.z) / 2;
        // 램프가 합류하는 3거리 이상 교점 앞에서는 난간을 끊어 진입로를 연다.
        const nearOpenJunction = [[road.a, startJunction], [road.b, endJunction]].some(([nodeId, junction]) => {
          if (!junction || junction.degree < 3) return false;
          const node = CITY_NODES[nodeId];
          return Math.hypot(midX - node.x, midZ - node.z) < junction.surfaceRadius + 6;
        });
        if (!nearOpenJunction) {
          for (const side of [-1, 1]) {
            const railX = midX + nx * side * (road.width / 2 + 1.25);
            const railZ = midZ + nz * side * (road.width / 2 + 1.25);
            bridgeRailSpecs.push({ x: railX, y: roadSurfaceHeight(road, segmentIndex + 0.5, 1.08), z: railZ, width: 0.38, height: 1.45, depth: length + 0.4, rotation: angle });
          }
        }
      }
      // 시내 간선에는 가드레일을 두지 않습니다. 난간은 교량 전용 레일로만 처리해
      // 건물가 도로가 외곽 고속도로처럼 보이거나 시야를 어지럽히지 않게 합니다.
      roadWalked += length;
    }
  }

  for (const [nodeId, degree] of nodeDegree) {
    if (degree < 2) continue;
    const node = CITY_NODES[nodeId];
    const junction = junctionInfo.get(nodeId);
    const baseY = terrainHeightAt(node.x, node.z);
    junctionShoulderSpecs.push({ x: node.x, y: baseY + 0.11, z: node.z, width: junction.shoulderRadius, height: 0.18, depth: junction.shoulderRadius });
    junctionSurfaceSpecs.push({ x: node.x, y: baseY + 0.31, z: node.z, width: junction.surfaceRadius, height: 0.1, depth: junction.surfaceRadius });
  }

  // 급코너 예고 쉐브론: 도로 폴리라인의 회전각을 분석해 코너 바깥쪽에 자동 배치.
  const chevronPostSpecs = [];
  const chevronLeftSpecs = [];
  const chevronRightSpecs = [];
  const placedChevrons = [];
  for (const road of CITY_ROADS) {
    if (road.bridge || road.skyway) continue;
    for (let index = 1; index < road.path.length - 1; index += 1) {
      const before = road.path[index - 1];
      const corner = road.path[index];
      const after = road.path[index + 1];
      const headingIn = Math.atan2(corner.x - before.x, corner.z - before.z);
      const headingOut = Math.atan2(after.x - corner.x, after.z - corner.z);
      const turn = normalizeAngle(headingOut - headingIn);
      if (Math.abs(turn) < 0.42) continue;
      if (placedChevrons.some((point) => Math.hypot(point.x - corner.x, point.z - corner.z) < 22)) continue;
      // 급코너 바깥 연석에 적백 럼블 스트립 — 코너의 리듬이 노면에서 읽힌다.
      const outsideSign = turn > 0 ? -1 : 1;
      for (let strip = -7; strip <= 7; strip += 1) {
        const stripIndex = index + strip;
        if (stripIndex < 1 || stripIndex >= road.path.length - 1) continue;
        const stripPoint = road.path[stripIndex];
        const stripNext = road.path[Math.min(road.path.length - 1, stripIndex + 1)];
        const stripHeading = Math.atan2(stripNext.x - stripPoint.x, stripNext.z - stripPoint.z);
        const stripNx = Math.cos(stripHeading) * outsideSign;
        const stripNz = -Math.sin(stripHeading) * outsideSign;
        const rumbleX = stripPoint.x + stripNx * (road.width / 2 + 0.55);
        const rumbleZ = stripPoint.z + stripNz * (road.width / 2 + 0.55);
        ((strip % 2 + 2) % 2 === 0 ? rumbleRedSpecs : rumbleWhiteSpecs).push({
          x: rumbleX, y: drivingSurfaceHeightAt(rumbleX, rumbleZ) + 0.14, z: rumbleZ,
          width: 1.0, height: 0.3, depth: 2.1, rotation: stripHeading
        });
      }
      const ux = Math.sin(headingIn);
      const uz = Math.cos(headingIn);
      // 좌회전(+)의 바깥은 오른쪽, 우회전(-)의 바깥은 왼쪽
      const outsideX = turn > 0 ? -uz : uz;
      const outsideZ = turn > 0 ? ux : -ux;
      const lateral = road.width / 2 + 4.1;
      const signX = corner.x - ux * 12 + outsideX * lateral;
      const signZ = corner.z - uz * 12 + outsideZ * lateral;
      const roadCheck = closestRoadPoint(signX, signZ);
      if (roadCheck && roadCheck.distance < roadCheck.road.width / 2 + 3.5) continue;
      placedChevrons.push({ x: corner.x, z: corner.z });
      const baseY = terrainHeightAt(signX, signZ);
      const facing = headingIn + Math.PI;
      chevronPostSpecs.push({ x: signX, y: baseY + 1.05, z: signZ, width: 0.16, height: 2.1, depth: 0.16 });
      (turn > 0 ? chevronLeftSpecs : chevronRightSpecs).push({
        x: signX, y: baseY + 2.35, z: signZ, width: 1.7, height: 0.95, depth: 0.12, rotation: facing
      });
    }
  }
  createBoxInstances(scene, chevronPostSpecs, makeMaterial(0x77828a, { roughness: 0.6, metalness: 0.35 }), { castShadow: true });
  createBoxInstances(scene, chevronLeftSpecs, makeChevronMaterial(true), { castShadow: true });
  createBoxInstances(scene, chevronRightSpecs, makeChevronMaterial(false), { castShadow: true });

  const junctionGeometry = new THREE.CylinderGeometry(1, 1, 1, 36);
  createBoxInstances(scene, junctionShoulderSpecs, shoulderMaterial, { geometry: junctionGeometry, castShadow: false });
  createBoxInstances(scene, junctionSurfaceSpecs, asphaltMaterial, { geometry: junctionGeometry, castShadow: false });
  createBoxInstances(scene, markerSpecs, makeMaterial(0xf6f7f8, { emissive: 0xffffff, emissiveIntensity: 0.16 }));
  createBoxInstances(scene, localMarkerSpecs, makeMaterial(0xf7fbff, { emissive: 0xffffff, emissiveIntensity: 0.08 }));
  createBoxInstances(scene, crosswalkSpecs, makeMaterial(0xf3f6f8, { roughness: 0.8, emissive: 0xffffff, emissiveIntensity: 0.1 }));
  const laneArrowGeometry = new THREE.PlaneGeometry(1, 1);
  laneArrowGeometry.rotateX(-Math.PI / 2);
  const laneArrowMaterial = makeMaterial(0xffffff, { roughness: 0.78, emissive: 0xffffff, emissiveIntensity: 0.1, transparent: true });
  laneArrowMaterial.map = makeLaneArrowTexture();
  laneArrowMaterial.depthWrite = false;
  createBoxInstances(scene, laneArrowSpecs, laneArrowMaterial, { geometry: laneArrowGeometry, castShadow: false });
  createBoxInstances(scene, bridgeRailSpecs, makeMaterial(0x8b969e, { roughness: 0.42, metalness: 0.58 }), { castShadow: true });
  createBoxInstances(scene, pierSpecs, makeMaterial(0xb9c0c6, { roughness: 0.85 }), { castShadow: true });
  createBoxInstances(scene, rumbleRedSpecs, makeMaterial(0xd64545, { roughness: 0.7, emissive: 0xd64545, emissiveIntensity: 0.08 }));
  createBoxInstances(scene, rumbleWhiteSpecs, makeMaterial(0xf2f5f7, { roughness: 0.7, emissive: 0xffffff, emissiveIntensity: 0.08 }));
  createBoxInstances(scene, lampPostSpecs, makeMaterial(0x5b6870, { roughness: 0.55, metalness: 0.4 }), { castShadow: true });
  const lampHeadMaterial = makeMaterial(0xfff4d6, { roughness: 0.3, emissive: 0xffd88a, emissiveIntensity: 0.35 });
  createBoxInstances(scene, lampHeadSpecs, lampHeadMaterial, { receiveShadow: false });
  scene.userData.streetLampMaterial = lampHeadMaterial;
}

function createSmoothRoadNetwork(scene) {
  const bridgeRailSpecs = [];
  const pierSpecs = [];
  const crosswalkSpecs = [];
  const shoulderMaterial = makeMaterial(0x555c61, { roughness: 0.98 });
  const sidewalkMaterial = makeMaterial(0xb8bec1, { roughness: 0.94 });
  const { colorMap: asphaltColorMap, bumpMap: asphaltBumpMap } = makeRoadSurfaceTextures();
  const asphaltMaterial = makeMaterial(0xffffff, { roughness: 0.9 });
  asphaltMaterial.map = asphaltColorMap;
  asphaltMaterial.bumpMap = asphaltBumpMap;
  asphaltMaterial.bumpScale = 0.045;
  const bridgeAsphaltMaterial = makeMaterial(0xe2e5e7, { roughness: 0.88 });
  bridgeAsphaltMaterial.map = asphaltColorMap;
  bridgeAsphaltMaterial.bumpMap = asphaltBumpMap;
  bridgeAsphaltMaterial.bumpScale = 0.035;

  const edgeLineMaterial = makeMaterial(0xe7eaeb, { roughness: 0.58 });
  const laneLineMaterial = makeMaterial(0xe4e7e8, { roughness: 0.56 });
  const centerLineMaterial = makeMaterial(0xe7b72d, { roughness: 0.54 });
  const crosswalkMaterial = makeMaterial(0xe3e6e7, { roughness: 0.6 });
  for (const material of [edgeLineMaterial, laneLineMaterial, centerLineMaterial, crosswalkMaterial]) {
    material.polygonOffset = true;
    material.polygonOffsetFactor = -2;
    material.polygonOffsetUnits = -2;
  }

  const roadsByNode = new Map();
  for (const road of CITY_ROADS) {
    for (const nodeId of [road.a, road.b]) {
      if (!roadsByNode.has(nodeId)) roadsByNode.set(nodeId, []);
      roadsByNode.get(nodeId).push(road);
    }
  }
  const junctionInfo = new Map();
  for (const [nodeId, roads] of roadsByNode) {
    if (roads.length < 2) continue;
    const widestRoad = Math.max(...roads.map((road) => road.width));
    const surfaceDepth = Math.max(8.5, widestRoad * 0.68 + Math.max(0, roads.length - 3) * 0.72);
    junctionInfo.set(nodeId, {
      degree: roads.length,
      roads,
      surfaceDepth,
      shoulderDepth: surfaceDepth + 1.35
    });
  }

  const addPaint = (mesh) => {
    if (mesh) scene.add(mesh);
  };

  for (const road of CITY_ROADS) {
    const startJunction = junctionInfo.get(road.a);
    const endJunction = junctionInfo.get(road.b);
    const elevatedDeck = road.bridge || road.skyway;
    const shoulderWidth = road.width + (elevatedDeck ? 2.8 : 2.2);
    const shoulderStartInset = startJunction?.shoulderDepth || 0;
    const shoulderEndInset = endJunction?.shoulderDepth || 0;
    const surfaceStartInset = startJunction?.surfaceDepth || 0;
    const surfaceEndInset = endJunction?.surfaceDepth || 0;

    scene.add(createSmoothRoadDeckMesh(road, shoulderWidth, shoulderMaterial, {
      lift: 0.2,
      thickness: elevatedDeck ? 1.05 : 0.46,
      startInset: shoulderStartInset,
      endInset: shoulderEndInset
    }));
    scene.add(createSmoothRoadDeckMesh(road, road.width, elevatedDeck ? bridgeAsphaltMaterial : asphaltMaterial, {
      lift: 0.34,
      thickness: elevatedDeck ? 0.88 : 0.36,
      startInset: surfaceStartInset,
      endInset: surfaceEndInset
    }));

    if (!elevatedDeck && road.type !== "alley") {
      const sidewalkWidth = road.type === "local" ? 1.75 : 2.2;
      const sidewalkOffset = road.width / 2 + 0.7 + sidewalkWidth / 2;
      for (const side of [-1, 1]) {
        scene.add(createSmoothRoadDeckMesh(road, sidewalkWidth, sidewalkMaterial, {
          lift: 0.48,
          thickness: 0.62,
          startInset: shoulderStartInset + 1.5,
          endInset: shoulderEndInset + 1.5,
          offset: side * sidewalkOffset,
          spacing: 0.7
        }));
      }
    }

    const paintStartInset = surfaceStartInset + (startJunction ? 0.8 : 0);
    const paintEndInset = surfaceEndInset + (endJunction ? 0.8 : 0);
    if (road.type !== "local" && road.type !== "alley") {
      const edgeOffset = Math.max(2, road.width / 2 - 0.54);
      addPaint(createRoadPaintMesh(road, [-edgeOffset, edgeOffset], 0.14, edgeLineMaterial, {
        startInset: paintStartInset,
        endInset: paintEndInset
      }));
    }
    if (road.type === "arterial") {
      addPaint(createRoadPaintMesh(road, [-road.width * 0.25, road.width * 0.25], 0.14, laneLineMaterial, {
        startInset: paintStartInset,
        endInset: paintEndInset,
        dashLength: 4.2,
        gapLength: 6.3
      }));
    }
    if (road.type !== "alley") {
      const centerOffsets = road.type === "local" ? [0] : [-0.17, 0.17];
      addPaint(createRoadPaintMesh(road, centerOffsets, road.type === "local" ? 0.1 : 0.11, centerLineMaterial, {
        startInset: paintStartInset,
        endInset: paintEndInset,
        dashLength: road.type === "local" ? 3.2 : 0,
        gapLength: road.type === "local" ? 4.8 : 0
      }));
    }

    // Crosswalks are reserved for readable three- and four-way urban junctions.
    // High-degree hubs are intentionally kept clean until their topology is split.
    for (const [junction, startsHere] of [[startJunction, true], [endJunction, false]]) {
      if (!junction || junction.degree < 3 || junction.degree > 4 || elevatedDeck || road.type === "alley" || road.type === "scenic") continue;
      const data = getSmoothRoadData(road);
      const fromNodeBase = junction.surfaceDepth + 1.8;
      // Four broad bars stay legible at chase-camera distance without turning
      // every approach into a dense ladder of white lines.
      for (let stripe = 0; stripe < 4; stripe += 1) {
        const fromNode = fromNodeBase + stripe * 1.15;
        const sample = smoothRoadSampleAt(road, startsHere ? fromNode : data.length - fromNode);
        crosswalkSpecs.push({
          x: sample.point.x,
          y: roadSurfaceHeight(road, sample.pathPosition, 0.352),
          z: sample.point.z,
          width: Math.max(3.5, road.width - 1.5),
          height: 0.006,
          depth: 0.52,
          rotation: Math.atan2(sample.tangent.x, sample.tangent.z)
        });
      }
      const stopFromNode = fromNodeBase + 5.55;
      const stopSample = smoothRoadSampleAt(road, startsHere ? stopFromNode : data.length - stopFromNode);
      crosswalkSpecs.push({
        x: stopSample.point.x,
        y: roadSurfaceHeight(road, stopSample.pathPosition, 0.352),
        z: stopSample.point.z,
        width: Math.max(3.5, road.width - 1.5),
        height: 0.006,
        depth: 0.24,
        rotation: Math.atan2(stopSample.tangent.x, stopSample.tangent.z)
      });
    }

    if (road.skyway) {
      const data = getSmoothRoadData(road);
      for (let pierDistance = 16; pierDistance < data.length - 16; pierDistance += 22) {
        const spot = smoothRoadSampleAt(road, pierDistance);
        const deckBottom = roadSurfaceHeight(road, spot.pathPosition, 0.2) - 1;
        const groundHeight = terrainHeightAt(spot.point.x, spot.point.z);
        if (deckBottom - groundHeight < 1.4) continue;
        const rotation = Math.atan2(spot.tangent.x, spot.tangent.z);
        pierSpecs.push({
          x: spot.point.x,
          y: (deckBottom + groundHeight) / 2,
          z: spot.point.z,
          width: 1.8,
          height: deckBottom - groundHeight,
          depth: 1.8,
          rotation
        });
        pierSpecs.push({
          x: spot.point.x,
          y: deckBottom - 0.35,
          z: spot.point.z,
          width: road.width + 1.5,
          height: 0.7,
          depth: 1.7,
          rotation
        });
      }
    }

    if (elevatedDeck) {
      const railSamples = smoothRoadSamplesBetween(road, shoulderStartInset + 1, shoulderEndInset + 1, 2.6);
      for (let index = 0; index < railSamples.length - 1; index += 1) {
        const start = railSamples[index];
        const finish = railSamples[index + 1];
        const midX = (start.point.x + finish.point.x) / 2;
        const midZ = (start.point.z + finish.point.z) / 2;
        const dx = finish.point.x - start.point.x;
        const dz = finish.point.z - start.point.z;
        const length = Math.hypot(dx, dz) || 1;
        const nx = -dz / length;
        const nz = dx / length;
        const angle = Math.atan2(dx, dz);
        for (const side of [-1, 1]) {
          const railX = midX + nx * side * (road.width / 2 + 1.05);
          const railZ = midZ + nz * side * (road.width / 2 + 1.05);
          bridgeRailSpecs.push({
            x: railX,
            y: roadSurfaceHeight(road, (start.pathPosition + finish.pathPosition) / 2, 1.02),
            z: railZ,
            width: 0.24,
            height: 1.24,
            depth: length + 0.18,
            rotation: angle
          });
        }
      }
    }
  }

  for (const [nodeId, junction] of junctionInfo) {
    scene.add(createJunctionSurfaceMesh(nodeId, junction, shoulderMaterial, {
      depth: junction.shoulderDepth,
      extra: 1.1,
      lift: 0.2
    }));
    scene.add(createJunctionSurfaceMesh(nodeId, junction, asphaltMaterial, {
      depth: junction.surfaceDepth,
      lift: 0.34
    }));
  }

  createBoxInstances(scene, crosswalkSpecs, crosswalkMaterial, { castShadow: false });
  createBoxInstances(scene, bridgeRailSpecs, makeMaterial(0x596167, { roughness: 0.45, metalness: 0.52 }), { castShadow: true });
  createBoxInstances(scene, pierSpecs, makeMaterial(0xa4aaad, { roughness: 0.88 }), { castShadow: true });
}

function seeded(seed, salt = 0) {
  const value = Math.sin(seed * 91.127 + salt * 17.31) * 43758.5453;
  return value - Math.floor(value);
}

function createRegionalScenery(scene) {
  const ridgeRock = [];
  const ridgeSnow = [];
  // The former alpine cones blocked the chase camera. The city keeps a clean
  // skyline; elevation is handled by the road embankment and distant towers.
  const peaks = [];
  peaks.forEach(([x, z, radius, height], index) => {
    const road = closestRoadPoint(x, z);
    if (road && road.distance < road.road.width / 2 + 12) return;
    const baseY = terrainHeightAt(x, z);
    ridgeRock.push({ x, y: baseY + height / 2, z, width: radius, height, depth: radius, rotation: index * 0.37, color: index % 2 ? 0x52606a : 0x66747b });
    ridgeSnow.push({ x, y: baseY + height * 0.79, z, width: radius * 0.56, height: height * 0.42, depth: radius * 0.56, rotation: index * 0.37, color: index % 2 ? 0xf8fbfc : 0xe5f0f3 });
  });
  registerCameraObstacle(scene, createBoxInstances(scene, ridgeRock, makeMaterial(0xffffff, { roughness: 1 }), {
    castShadow: true,
    geometry: new THREE.ConeGeometry(1, 1, 7)
  }));
  registerCameraObstacle(scene, createBoxInstances(scene, ridgeSnow, makeMaterial(0xffffff, { roughness: 0.94 }), {
    castShadow: true,
    geometry: new THREE.ConeGeometry(1, 1, 7)
  }));

  const canyonRocks = [];
  const canyonPositions = [];
  canyonPositions.forEach(([x, z, radius, height], index) => {
    const road = closestRoadPoint(x, z);
    if (road && road.distance < road.road.width / 2 + 10) return;
    canyonRocks.push({
      x, y: terrainHeightAt(x, z) + height / 2, z,
      width: radius, height, depth: radius * 0.82,
      rotation: index * 0.51,
      color: [0x7d5c4d, 0x9b6b55, 0x6d5147][index % 3]
    });
  });
  registerCameraObstacle(scene, createBoxInstances(scene, canyonRocks, makeMaterial(0xffffff, { roughness: 1 }), {
    castShadow: true,
    geometry: new THREE.DodecahedronGeometry(1, 0)
  }));

  const coastalBuildings = [];
  const coastSites = [
    [-118, 218, 12, 31], [-88, 232, 10, 40], [-52, 246, 13, 26], [108, 220, 12, 34],
    [140, 232, 11, 45], [172, 216, 13, 37], [202, 244, 10, 51]
  ];
  coastSites.forEach(([x, z, width, height], index) => {
    const road = closestRoadPoint(x, z);
    const footprintRadius = Math.hypot(width, width * 0.82) * 0.5;
    if (road && road.distance < road.road.width / 2 + footprintRadius + 4.5) return;
    coastalBuildings.push({
      x, y: terrainHeightAt(x, z) + height / 2, z,
      width, height, depth: width * 0.82,
      rotation: (index % 3 - 1) * 0.08,
      color: [0x617f91, 0x8297a4, 0x4d6d80, 0x9a8175][index % 4]
    });
  });
  registerCameraObstacle(scene, createBoxInstances(scene, coastalBuildings, makeMaterial(0xffffff, { roughness: 0.58, metalness: 0.08 }), {
    castShadow: true,
    geometry: new RoundedBoxGeometry(1, 1, 1, 2, 0.06)
  }));

  const dockMaterial = makeMaterial(0x6d5144, { roughness: 0.92 });
  for (const x of [-120, -45, 45, 120]) {
    const dock = roundedBox(16, 0.65, 70, dockMaterial, 0.18, x, terrainHeightAt(x, 250) + 0.15, 281);
    dock.castShadow = false;
    scene.add(dock);
  }
}

function createTrafficLoop(roadIds) {
  const roads = roadIds.map((id) => CITY_ROADS.find((road) => road.id === id)).filter(Boolean);
  const points = [];
  let cursor = null;
  for (const road of roads) {
    let oriented = null;
    if (cursor === null || road.a === cursor) {
      oriented = road.path;
      cursor = road.b;
    } else if (road.b === cursor) {
      oriented = [...road.path].reverse();
      cursor = road.a;
    }
    if (!oriented) return [];
    points.push(...(points.length ? oriented.slice(1) : oriented));
  }
  return points;
}

function sampleTrafficLoop(points, distance) {
  const total = pathLength(points);
  if (points.length < 2 || total < 0.001) return null;
  let remaining = ((distance % total) + total) % total;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const length = Math.hypot(end.x - start.x, end.z - start.z);
    if (remaining <= length || index === points.length - 1) {
      const t = remaining / Math.max(0.001, length);
      return { x: lerp(start.x, end.x, t), z: lerp(start.z, end.z, t), dx: end.x - start.x, dz: end.z - start.z };
    }
    remaining -= length;
  }
  return null;
}

function updateCityTraffic(scene, dt) {
  for (const vehicle of scene.userData.cityTraffic || []) {
    vehicle.distance += vehicle.speed * dt;
    const sample = sampleTrafficLoop(vehicle.points, vehicle.distance);
    if (!sample) continue;
    const length = Math.hypot(sample.dx, sample.dz) || 1;
    const normalX = -sample.dz / length;
    const normalZ = sample.dx / length;
    const road = closestRoadPoint(sample.x, sample.z);
    const laneOffset = vehicle.lane * Math.max(2.05, Math.min(road?.road.width * 0.24 || 2.8, 4.5));
    const x = sample.x + normalX * laneOffset;
    const z = sample.z + normalZ * laneOffset;
    vehicle.group.position.set(x, drivingSurfaceHeightAt(x, z) + 0.05, z);
    vehicle.group.rotation.y = Math.atan2(sample.dx, sample.dz);
    for (const wheel of vehicle.wheels) wheel.rotation.x += vehicle.speed * dt / 0.42;
  }
}

function createCityTraffic(scene) {
  const paints = [0xd62f3f, 0xf2c14e, 0x2f8fbf, 0x44515c, 0xf0f4f7, 0x38a169, 0x8a4fff];
  const glassMaterial = makeMaterial(0x182733, { roughness: 0.18, metalness: 0.38 });
  const tireMaterial = makeMaterial(0x151a1e, { roughness: 0.86 });
  const chromeMaterial = makeMaterial(0xb8c4c9, { roughness: 0.24, metalness: 0.9 });
  const headlightMaterial = makeMaterial(0xe9fbff, { roughness: 0.12, emissive: 0xaeeaff, emissiveIntensity: 0.35 });
  const taillightMaterial = makeMaterial(0xff3548, { roughness: 0.22, emissive: 0xff1d35, emissiveIntensity: 0.52 });

  const outerLoop = createTrafficLoop(CITY_TRAFFIC_LOOPS.outer);
  const innerLoop = createTrafficLoop(CITY_TRAFFIC_LOOPS.inner);
  const routes = [
    { points: outerLoop, lane: -1, count: 6, speed: 25 },
    { points: [...outerLoop].reverse(), lane: -1, count: 5, speed: 23 },
    { points: innerLoop, lane: -1, count: 5, speed: 18 },
    { points: [...innerLoop].reverse(), lane: -1, count: 4, speed: 16 }
  ].filter((route) => route.points.length > 1);
  const vehicles = [];
  let index = 0;
  for (const route of routes) {
    const routeLengthTotal = pathLength(route.points);
    for (let routeIndex = 0; routeIndex < route.count; routeIndex += 1) {
    const group = new THREE.Group();
    const bodyColor = paints[index % paints.length];
    const body = roundedBox(2.05, 0.68, 4.5, makeMaterial(bodyColor, { roughness: 0.4, metalness: 0.18 }), 0.22, 0, 0.72, 0);
    const cabin = roundedBox(1.62, 0.72, 2.08, glassMaterial, 0.2, 0, 1.25, -0.22);
    const bumper = roundedBox(2.12, 0.16, 0.26, chromeMaterial, 0.05, 0, 0.48, -2.15);
    group.add(body, cabin, bumper);
    if (index % 5 === 0) {
      const cargo = roundedBox(1.74, 1.2, 1.6, makeMaterial(index % 10 === 0 ? 0xf4f6f7 : bodyColor, { roughness: 0.48 }), 0.16, 0, 1.43, -0.48);
      group.add(cargo);
    }
    const wheels = [];
    for (const wheelX of [-0.92, 0.92]) {
      for (const wheelZ of [-1.35, 1.35]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14), tireMaterial);
        wheel.position.set(wheelX, 0.44, wheelZ);
        wheel.rotation.z = Math.PI / 2;
        wheel.castShadow = true;
        group.add(wheel);
        wheels.push(wheel);
      }
    }
    for (const lightX of [-0.62, 0.62]) {
      group.add(roundedBox(0.34, 0.16, 0.08, headlightMaterial, 0.03, lightX, 0.84, 2.27));
      group.add(roundedBox(0.36, 0.14, 0.08, taillightMaterial, 0.03, lightX, 0.84, -2.27));
    }
    group.traverse((object) => { if (object.isMesh) object.castShadow = true; });
    scene.add(group);
    vehicles.push({
      group,
      wheels,
      points: route.points,
      lane: route.lane,
      speed: route.speed + seeded(index + 420, 1) * 4,
      distance: routeLengthTotal * (routeIndex / route.count + seeded(index + 420, 2) * 0.09)
    });
    index += 1;
    }
  }
  scene.userData.cityTraffic = vehicles;
  updateCityTraffic(scene, 0);
}

function createCity(scene) {
  createMountainTerrain(scene);

  // The canal bends through the harbour district; bridges connect all three corridors.
  const river = createRibbonMesh(CITY_RIVER_PATH, 24, makeMaterial(0x45b7e8, { roughness: 0.22, metalness: 0.08 }), 0.03);
  river.castShadow = false;
  scene.add(river);
  createSmoothRoadNetwork(scene);
  createCityTraffic(scene);
  createRegionalScenery(scene);

  const buildingSpecs = [];
  const roofSpecs = [];
  const houseRoofSpecs = [];
  const windowSpecs = [];
  const doorSpecs = [];
  const awningSpecs = [];
  const signSpecs = [];
  const balconySpecs = [];
  const lotSpecs = [];
  const trunkSpecs = [];
  const crownSpecs = [];
  const pilasterSpecs = [];
  const tankSpecs = [];
  const tankRoofSpecs = [];
  const billboardSpecs = [];
  const landmarkClearings = buildCityLandmarkClearings(DESTINATIONS);
  const buildingPlans = buildCityBuildingPlans(landmarkClearings);
  const placedBuildings = buildingPlans.map((plan) => ({ x: plan.x, z: plan.z, radius: plan.footprintRadius }));

  const rotatePoint = (localX, localZ, rotation) => ({
    x: localX * Math.cos(rotation) + localZ * Math.sin(rotation),
    z: -localX * Math.sin(rotation) + localZ * Math.cos(rotation)
  });

  for (const plan of buildingPlans) {
    const { seed, district, residential, highRise, x, z, width, depth, height, rotation, color, baseY } = plan;
      buildingSpecs.push({ x, y: baseY + height / 2 + 0.25, z, width, height, depth, color, rotation });
      lotSpecs.push({ x, y: baseY + 0.14, z, width: width + 3.1, height: 0.18, depth: depth + 3.1, color: residential ? 0xe5edf0 : district.id === "center" ? 0xdce7ed : 0xcfe9d8, rotation });
      if (residential) houseRoofSpecs.push({ x, y: baseY + height + 1.15, z, width: width * 0.83, height: 2.7, depth: depth * 0.83, rotation: rotation + Math.PI / 4, color: seed % 2 ? 0x8f4f46 : 0x5f7fca });
      else roofSpecs.push({ x, y: baseY + height + 0.52, z, width: width + 0.48, height: 0.55, depth: depth + 0.48, color: 0xf2f7f9, rotation });

      const frontNormal = rotatePoint(0, depth / 2 + 0.08, rotation);
      const windowColor = seed % 3 === 0 ? 0xffe99a : 0x8ee6ff;
      const unlitColor = 0x33475a;
      // 창문을 폭에 비례한 규칙적인 그리드로 배치해 슬래브 느낌을 없앱니다.
      const floorCount = residential ? 1 : Math.min(11, Math.max(2, Math.floor(height / 5.2)));
      const columnCount = residential ? 2 : Math.min(5, Math.max(2, Math.round(width / 3.4)));
      const columnSpan = width * 0.72;
      const windowWidth = Math.min(2.0, (columnSpan / columnCount) * 0.68);
      for (let floor = 0; floor < floorCount; floor += 1) {
        const windowY = residential ? 3.2 : 3.4 + floor * ((height - 4.5) / Math.max(1, floorCount - 1));
        for (let column = 0; column < columnCount; column += 1) {
          const offsetX = (column / Math.max(1, columnCount - 1) - 0.5) * columnSpan;
          for (const facing of residential ? [1] : [1, -1]) {
            const lit = seeded(seed * 13 + floor * 7 + column, facing + 8) > 0.3;
            const local = rotatePoint(offsetX, facing * (depth / 2 + 0.08), rotation);
            windowSpecs.push({
              x: x + local.x, y: baseY + windowY, z: z + local.z,
              width: windowWidth, height: residential ? 1.65 : 1.72, depth: 0.12,
              color: lit ? windowColor : unlitColor, rotation
            });
          }
        }
        if (!residential) {
          const rowCount = Math.min(4, Math.max(2, Math.round(depth / 3.6)));
          const rowSpan = depth * 0.66;
          for (let row = 0; row < rowCount; row += 1) {
            const offsetZ = (row / Math.max(1, rowCount - 1) - 0.5) * rowSpan;
            for (const side of [-1, 1]) {
              const lit = seeded(seed * 17 + floor * 5 + row, side + 9) > 0.34;
              const local = rotatePoint(side * (width / 2 + 0.08), offsetZ, rotation);
              windowSpecs.push({
                x: x + local.x, y: baseY + windowY, z: z + local.z,
                width: 0.12, height: 1.72, depth: Math.min(1.9, (rowSpan / rowCount) * 0.68),
                color: lit ? windowColor : unlitColor, rotation
              });
            }
          }
        }
      }
      // 저층 상가 1층은 통유리 쇼윈도로 처리해 거리에 생기를 줍니다.
      if (!residential && height < 40) {
        windowSpecs.push({
          x: x + frontNormal.x, y: baseY + 1.9, z: z + frontNormal.z,
          width: width * 0.78, height: 1.5, depth: 0.14, color: 0xbde9f7, rotation
        });
      }
      // 고층 빌딩 옥상에는 설비 구조물을 올려 스카이라인 실루엣을 다양화합니다.
      if (highRise) {
        const unit = rotatePoint(width * 0.16, -depth * 0.14, rotation);
        roofSpecs.push({
          x: x + unit.x, y: baseY + height + 1.4, z: z + unit.z,
          width: Math.min(3, width * 0.32), height: 1.7, depth: Math.min(2.6, depth * 0.28),
          color: 0xdde6ea, rotation
        });
      }
      // 파사드 필라스터: 상업 건물 모서리에 수직 스트립을 세워 밋밋한 슬래브를 깬다.
      if (!residential) {
        const pilasterColor = new THREE.Color(color).multiplyScalar(0.82).getHex();
        for (const side of [-1, 1]) {
          const edge = rotatePoint(side * (width / 2 - 0.12), 0, rotation);
          pilasterSpecs.push({
            x: x + edge.x, y: baseY + height / 2 + 0.25, z: z + edge.z,
            width: 0.45, height: height - 0.5, depth: depth + 0.22, color: pilasterColor, rotation
          });
        }
      }
      // 중층 상업 건물 1/3에는 급수탑, 고층 1/3에는 발광 광고판을 올린다.
      if (!residential && !highRise && height >= 14 && seed % 3 === 1) {
        const spot = rotatePoint(width * 0.22, depth * 0.18, rotation);
        tankSpecs.push({ x: x + spot.x, y: baseY + height + 2.15, z: z + spot.z, width: 1.9, height: 2.3, depth: 1.9 });
        tankRoofSpecs.push({ x: x + spot.x, y: baseY + height + 3.85, z: z + spot.z, width: 2.2, height: 1.1, depth: 2.2 });
      }
      if (highRise && seed % 3 === 0) {
        const spot = rotatePoint(-width * 0.1, depth * 0.16, rotation);
        billboardSpecs.push({
          x: x + spot.x, y: baseY + height + 2.5, z: z + spot.z,
          width: Math.min(5, width * 0.55), height: 2.2, depth: 0.2,
          color: district.colors[(seed + 1) % district.colors.length], rotation
        });
      }
      doorSpecs.push({ x: x + frontNormal.x, y: baseY + 1.55, z: z + frontNormal.z, width: residential ? 1.3 : 1.6, height: 2.7, depth: 0.18, color: residential ? 0xffffff : 0x314a5c, rotation });
      if (residential) balconySpecs.push({ x: x + frontNormal.x * 1.04, y: baseY + 3.1, z: z + frontNormal.z * 1.04, width: width * 0.5, height: 0.18, depth: 0.8, color: 0xffffff, rotation });
      else if (height < 40) {
        awningSpecs.push({ x: x + frontNormal.x * 1.05, y: baseY + 3.1, z: z + frontNormal.z * 1.05, width: width * 0.76, height: 0.42, depth: 0.85, color: district.colors[(seed + 2) % district.colors.length], rotation });
        signSpecs.push({ x: x + frontNormal.x * 1.01, y: baseY + 4.15, z: z + frontNormal.z * 1.01, width: width * 0.58, height: 0.85, depth: 0.16, color: district.colors[(seed + 3) % district.colors.length], rotation });
      }
  }

  // Trees fill the irregular leftover parcels instead of marking a square block center.
  for (let index = 0; index < 180; index += 1) {
    const x = -245 + seeded(index + 900, 1) * 490;
    const z = -235 + seeded(index + 900, 2) * 485;
    const roadHit = closestRoadPoint(x, z);
    if (!roadHit || roadHit.distance < roadHit.road.width / 2 + 4 || distanceToRiver(x, z) < 14) continue;
    if (placedBuildings.some((item) => Math.hypot(x - item.x, z - item.z) < item.radius + 3.8)) continue;
    const treeScale = 0.72 + seeded(index + 900, 3) * 0.5;
    const baseY = terrainHeightAt(x, z);
    const leafColor = index % 2 ? 0x315f43 : 0x416f4e;
    trunkSpecs.push({ x, y: baseY + 1.2 * treeScale, z, width: 0.65 * treeScale, height: 2.4 * treeScale, depth: 0.65 * treeScale });
    // 2단 원뿔 수관 — 로우폴리 침엽수 실루엣
    crownSpecs.push({ x, y: baseY + 3.1 * treeScale, z, width: 2.55 * treeScale, height: 3.3 * treeScale, depth: 2.55 * treeScale, color: leafColor });
    crownSpecs.push({ x, y: baseY + 5.2 * treeScale, z, width: 1.8 * treeScale, height: 2.6 * treeScale, depth: 1.8 * treeScale, color: index % 2 ? 0x3c6f4e : 0x4b7d58 });
  }

  createBoxInstances(scene, lotSpecs, makeMaterial(0xffffff, { roughness: 1 }));
  registerCameraObstacle(scene, createBoxInstances(scene, buildingSpecs, makeMaterial(0xffffff, { roughness: 0.7 }), {
    castShadow: false,
    geometry: new RoundedBoxGeometry(1, 1, 1, 2, 0.08)
  }));
  registerCameraObstacle(scene, createBoxInstances(scene, roofSpecs, makeMaterial(0xf8fbff, { roughness: 0.92 })));
  registerCameraObstacle(scene, createBoxInstances(scene, houseRoofSpecs, makeMaterial(0xffffff, { roughness: 0.9 }), {
    castShadow: true,
    geometry: new THREE.ConeGeometry(1, 1, 4)
  }));
  const cityWindowMaterial = makeMaterial(0xffe7a0, { roughness: 0.26, emissive: 0xffc86b, emissiveIntensity: 0.24 });
  scene.userData.cityWindowMaterial = cityWindowMaterial;
  createBoxInstances(scene, windowSpecs, cityWindowMaterial);
  createBoxInstances(scene, doorSpecs, makeMaterial(0xffffff, { roughness: 0.7 }));
  createBoxInstances(scene, awningSpecs, makeMaterial(0xffffff, { roughness: 0.82 }));
  createBoxInstances(scene, signSpecs, makeMaterial(0xffffff, { roughness: 0.7, emissive: 0xffffff, emissiveIntensity: 0.12 }));
  createBoxInstances(scene, balconySpecs, makeMaterial(0xffffff, { roughness: 0.9 }));
  createBoxInstances(scene, trunkSpecs, makeMaterial(0x9c6644));
  createBoxInstances(scene, crownSpecs, makeMaterial(0xffffff, { roughness: 0.94 }), {
    castShadow: true,
    geometry: new THREE.ConeGeometry(1, 1, 9)
  });
  createBoxInstances(scene, pilasterSpecs, makeMaterial(0xffffff, { roughness: 0.74 }));
  createBoxInstances(scene, tankSpecs, makeMaterial(0xb5c3cb, { roughness: 0.5, metalness: 0.4 }), {
    castShadow: true,
    geometry: new THREE.CylinderGeometry(0.5, 0.5, 1, 10)
  });
  createBoxInstances(scene, tankRoofSpecs, makeMaterial(0x8d6a56, { roughness: 0.8 }), {
    geometry: new THREE.ConeGeometry(0.5, 1, 10)
  });
  const billboardMaterial = makeMaterial(0xffffff, { roughness: 0.35, emissive: 0xfff2c8, emissiveIntensity: 0.7 });
  createBoxInstances(scene, billboardSpecs, billboardMaterial, { receiveShadow: false });
  scene.userData.billboardMaterial = billboardMaterial;
  createCentralHub(scene);
  createLandmarks(scene);
  createSkyline(scene);
  createClouds(scene);
  createJumpRamps(scene);
  scene.userData.cityStats = { roads: CITY_ROADS.length, buildings: buildingSpecs.length };
}

function addLandmarkLabel(scene, text, x, y, z, color) {
  const label = makeTextSprite(text, "#ffffff", color);
  label.position.set(x, y, z);
  label.scale.set(11, 3.4, 1);
  scene.add(label);
}

function createCentralHub(scene) {
  const hubX = CITY_NODES.hub.x;
  const hubZ = CITY_NODES.hub.z;
  const baseY = terrainHeightAt(hubX, hubZ);
  const hubGroup = new THREE.Group();
  hubGroup.position.y = baseY;
  const depotX = hubX - 34;
  const depotZ = hubZ - 30;
  const depotGround = terrainHeightAt(depotX, depotZ) - baseY;
  const workshopX = hubX + 34;
  const workshopZ = hubZ - 30;
  const workshopGround = terrainHeightAt(workshopX, workshopZ) - baseY;
  const hubBase = roundedBox(18.5, 6.3, 13, makeMaterial(0xff8a00), 0.85, depotX, depotGround + 3.45, depotZ);
  const hubRoof = roundedBox(19.6, 1.05, 14, makeMaterial(0xffffff), 0.38, depotX, depotGround + 7.15, depotZ);
  const garageDoor = roundedBox(9.6, 4.2, 0.35, makeMaterial(0x35b7c8, { roughness: 0.55 }), 0.22, depotX, depotGround + 2.55, depotZ + 6.62);
  const sideWing = roundedBox(5.1, 4.6, 13.8, makeMaterial(0xffc857), 0.55, depotX - 6.2, depotGround + 2.65, depotZ);
  hubGroup.add(hubBase, hubRoof, garageDoor, sideWing);

  for (const offset of [-3.3, 0, 3.3]) {
    hubGroup.add(box(0.18, 4, 0.42, makeMaterial(0xe9fbff), depotX + offset, depotGround + 2.5, depotZ + 6.85));
  }
  const parcel = roundedBox(3.5, 2.8, 3.5, makeMaterial(0xffd166), 0.4, depotX, depotGround + 9.1, depotZ);
  const ribbonA = box(0.45, 3, 3.7, makeMaterial(0x4361ee), depotX, depotGround + 9.15, depotZ);
  const ribbonB = box(3.7, 3, 0.45, makeMaterial(0x4361ee), depotX, depotGround + 9.15, depotZ);
  hubGroup.add(parcel, ribbonA, ribbonB);
  addLandmarkLabel(scene, "센트럴 배송 허브", depotX, terrainHeightAt(depotX, depotZ) + 13, depotZ, "#ff6b00");

  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(9.2, 9.2, 0.32, 48), makeMaterial(0xdce7ea));
  plaza.position.set(hubX + 16, 0.12, hubZ + 16);
  plaza.receiveShadow = true;
  const fountainBase = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 4.2, 0.85, 32), makeMaterial(0x496573));
  fountainBase.position.set(hubX + 16, 0.72, hubZ + 16);
  const fountainTop = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.7, 3.2, 16), makeMaterial(0xffb703, { emissive: 0xff7b00, emissiveIntensity: 0.4 }));
  fountainTop.position.set(hubX + 16, 2.15, hubZ + 16);
  hubGroup.add(plaza, fountainBase, fountainTop);
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const bench = roundedBox(3.2, 0.45, 0.8, makeMaterial(0x9c6644), 0.18);
    bench.position.set(hubX + 16 + Math.sin(angle) * 6.5, 0.65, hubZ + 16 + Math.cos(angle) * 6.5);
    bench.rotation.y = angle;
    hubGroup.add(bench);
  }

  const cafe = roundedBox(13.5, 4.8, 11.5, makeMaterial(0x355a64), 0.7, workshopX, workshopGround + 2.7, workshopZ);
  const cafeRoof = roundedBox(14.4, 0.65, 12.4, makeMaterial(0xffffff), 0.28, workshopX, workshopGround + 5.45, workshopZ);
  const cafeWindow = roundedBox(8.8, 2.4, 0.3, makeMaterial(0x7de2f2, { roughness: 0.18 }), 0.12, workshopX, workshopGround + 2.7, workshopZ + 5.8);
  const cafeAwning = roundedBox(10.8, 0.45, 1.3, makeMaterial(0xff9f1c), 0.18, workshopX, workshopGround + 4.35, workshopZ + 6.15);
  hubGroup.add(cafe, cafeRoof, cafeWindow, cafeAwning);
  addLandmarkLabel(scene, "시티 튜닝숍", workshopX, terrainHeightAt(workshopX, workshopZ) + 8.2, workshopZ, "#e85280");

  const playLawn = new THREE.Mesh(new THREE.CylinderGeometry(8.6, 8.6, 0.28, 40), makeMaterial(0xe8f1f3));
  playLawn.position.set(hubX - 16, 0.14, hubZ + 16);
  hubGroup.add(playLawn);
  const slideDeck = roundedBox(3.5, 0.45, 3.5, makeMaterial(0xb08152), 0.18, hubX - 16, 3.2, hubZ + 16);
  const slide = box(2.2, 0.35, 6.2, makeMaterial(0x6f8792), hubX - 16, 1.65, hubZ + 19.5);
  slide.rotation.x = -0.5;
  const ladderPoleA = box(0.3, 3.1, 0.3, makeMaterial(0xff6b6b), hubX - 17.2, 1.8, hubZ + 14.5);
  const ladderPoleB = box(0.3, 3.1, 0.3, makeMaterial(0xff6b6b), hubX - 14.8, 1.8, hubZ + 14.5);
  const playRoof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 2.4, 6), makeMaterial(0xf2f7f9));
  playRoof.position.set(hubX - 16, 4.6, hubZ + 16);
  hubGroup.add(slideDeck, slide, ladderPoleA, ladderPoleB, playRoof);
  for (const [treeX, treeZ] of [[-22, 11], [-10, 11], [-22, 22], [-10, 22]]) {
    hubGroup.add(box(0.55, 2.2, 0.55, makeMaterial(0x9c6644), hubX + treeX, 1.25, hubZ + treeZ));
    const crown = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4.8, 9), makeMaterial(0x315f43));
    crown.position.set(hubX + treeX, 3.15, hubZ + treeZ);
    hubGroup.add(crown);
  }
  scene.add(hubGroup);
  registerCameraObstacle(scene, hubGroup);
}

function createDistrictHighlights(scene) {
  const gardenX = -135;
  const gardenZ = -145;
  // 햇살마을 정원: 낮은 주거지 사이에서 바로 알아볼 수 있는 원형 녹지입니다.
  const garden = new THREE.Mesh(new THREE.CylinderGeometry(9.4, 9.4, 0.3, 40), makeMaterial(0x92df72));
  garden.position.set(gardenX, 0.18, gardenZ);
  scene.add(garden);
  const gazeboRoof = new THREE.Mesh(new THREE.ConeGeometry(4.8, 2.2, 8), makeMaterial(0xff8a65));
  gazeboRoof.position.set(gardenX, 5.5, gardenZ);
  scene.add(gazeboRoof);
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    const post = box(0.35, 4.2, 0.35, makeMaterial(0xffffff), gardenX + Math.sin(angle) * 3.9, 2.3, gardenZ + Math.cos(angle) * 3.9);
    scene.add(post);
  }
  addLandmarkLabel(scene, "햇살마을 정원", gardenX, 9, gardenZ, "#ed7658");

  // 상상예술길: 작은 야외 갤러리와 컬러 마켓을 한 블록에 묶었습니다.
  scene.add(roundedBox(20, 0.35, 20, makeMaterial(0xf5e7ff), 0.3, -162, 0.2, 72));
  const artColors = [0xff4d8d, 0x4361ee, 0xffc857, 0x2ec4b6];
  for (let index = 0; index < 4; index += 1) {
    const x = -168 + (index % 2) * 12;
    const z = 66 + Math.floor(index / 2) * 12;
    scene.add(roundedBox(7.8, 2.7, 5.8, makeMaterial(0xffffff), 0.5, x, 1.55, z));
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(5, 2.3, 4), makeMaterial(artColors[index]));
    canopy.position.set(x, 4.05, z);
    canopy.rotation.y = Math.PI / 4;
    scene.add(canopy);
  }
  const sculpture = new THREE.Mesh(new THREE.TorusKnotGeometry(2.2, 0.48, 64, 10), makeMaterial(0xffd60a, { emissive: 0xffb703, emissiveIntensity: 0.28 }));
  sculpture.position.set(-162, 5.2, 72);
  scene.add(sculpture);
  addLandmarkLabel(scene, "상상 컬러마켓", -162, 10, 72, "#d53f78");

  // 별빛테크로: 유리 타워와 빛나는 데이터 링이 구역의 스카이라인을 만듭니다.
  scene.add(roundedBox(20, 0.32, 20, makeMaterial(0xdff5ff), 0.3, 145, 0.2, -88));
  const techTower = roundedBox(7.6, 18, 7.6, makeMaterial(0x5f7fca, { metalness: 0.2 }), 1.05, 145, 9.3, -88);
  const techCore = roundedBox(5.4, 15.5, 5.4, makeMaterial(0x72ddf7, { emissive: 0x37b9d1, emissiveIntensity: 0.32 }), 0.8, 145, 10, -88);
  scene.add(techTower, techCore);
  for (const y of [5.2, 10.2, 15.2]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5.1, 0.28, 10, 36), makeMaterial(0xb9f4ff, { emissive: 0x72ddf7, emissiveIntensity: 0.7 }));
    ring.position.set(145, y, -88);
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);
  }
  addLandmarkLabel(scene, "별빛 테크캠퍼스", 145, 23, -88, "#516bc1");

  // 리버파크 푸드마켓: 강을 건넌 뒤 만나는 활기찬 휴식 지점입니다.
  scene.add(roundedBox(20, 0.34, 20, makeMaterial(0xfff0c2), 0.3, -20, 0.22, 208));
  const truckColors = [0xff6b6b, 0x2ec4b6, 0xffc857];
  for (let index = 0; index < 3; index += 1) {
    const x = -27 + index * 7;
    const truck = roundedBox(5.4, 3.2, 3.6, makeMaterial(truckColors[index]), 0.55, x, 1.9, 208);
    const serviceWindow = roundedBox(3.2, 1.4, 0.2, makeMaterial(0xe9fbff), 0.1, x, 2.2, 209.85);
    scene.add(truck, serviceWindow);
  }
  for (const x of [-26, -14]) {
    const umbrella = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.2, 16), makeMaterial(x === -26 ? 0xff8fab : 0x72ddf7));
    umbrella.position.set(x, 4.5, 216);
    scene.add(box(0.25, 3.4, 0.25, makeMaterial(0xffffff), x, 2.35, 216), umbrella);
  }
  addLandmarkLabel(scene, "리버 푸드마켓", -20, 9.5, 208, "#d66d24");

  // 강변 산책로 난간은 대각선으로 흐르는 강의 곡선을 그대로 따라갑니다.
  const riverRails = [];
  for (let index = 0; index < CITY_RIVER_PATH.length - 1; index += 1) {
    const start = CITY_RIVER_PATH[index];
    const end = CITY_RIVER_PATH[index + 1];
    const midpoint = { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 };
    const roadHit = closestRoadPoint(midpoint.x, midpoint.z);
    if (roadHit?.road.bridge && roadHit.distance < 16) continue;
    const length = Math.hypot(end.x - start.x, end.z - start.z) || 1;
    const nx = -(end.z - start.z) / length;
    const nz = (end.x - start.x) / length;
    const rotation = Math.atan2(end.x - start.x, end.z - start.z);
    for (const side of [-1, 1]) riverRails.push({ x: midpoint.x + nx * side * 12.5, y: 0.82, z: midpoint.z + nz * side * 12.5, width: 0.3, height: 1.1, depth: length + 0.5, rotation });
  }
  createBoxInstances(scene, riverRails, makeMaterial(0x2e5664, { roughness: 0.46, metalness: 0.58 }));
  addLandmarkLabel(scene, "무지개대교", 10, 9, 140, "#138ca1");
}

function createLandmarks(scene) {
  const school = DESTINATIONS.school;
  const library = DESTINATIONS.library;
  const museum = DESTINATIONS.museum;
  const observatory = DESTINATIONS.observatory;
  const park = DESTINATIONS.park;
  // School campus
  scene.add(grounded(roundedBox(19, 6.5, 12, makeMaterial(0xffd166), 0.7, school.landmarkX, 3.55, school.landmarkZ)));
  scene.add(grounded(roundedBox(20, 0.8, 13, makeMaterial(0xf8f9fa), 0.22, school.landmarkX, 7.15, school.landmarkZ)));
  scene.add(grounded(box(3, 3.3, 0.5, makeMaterial(0x3a86ff), school.landmarkX, 1.95, school.landmarkZ + 6.3)));
  const schoolRoof = new THREE.Mesh(new THREE.ConeGeometry(8.2, 3.2, 4), makeMaterial(0xff6b6b));
  schoolRoof.position.set(school.landmarkX, 8.7, school.landmarkZ);
  schoolRoof.position.y += terrainHeightAt(school.landmarkX, school.landmarkZ);
  schoolRoof.rotation.y = Math.PI / 4;
  scene.add(schoolRoof);
  addLandmarkLabel(scene, school.name, school.landmarkX, terrainHeightAt(school.landmarkX, school.landmarkZ) + 10.5, school.landmarkZ, "#e6a400");

  // Library, shaped like stacked books.
  scene.add(grounded(roundedBox(18, 3.8, 13, makeMaterial(0x4361ee), 0.65, library.landmarkX, 2.2, library.landmarkZ)));
  scene.add(grounded(roundedBox(15, 3.2, 14, makeMaterial(0x72ddf7), 0.65, library.landmarkX, 5.7, library.landmarkZ)));
  scene.add(grounded(roundedBox(12, 2.8, 12, makeMaterial(0xffd166), 0.65, library.landmarkX, 8.7, library.landmarkZ)));
  addLandmarkLabel(scene, library.name, library.landmarkX, terrainHeightAt(library.landmarkX, library.landmarkZ) + 12.2, library.landmarkZ, "#4361ee");

  // Museum with a broad entrance and columns.
  scene.add(grounded(roundedBox(19, 6, 13, makeMaterial(0xff8fab), 0.7, museum.landmarkX, 3.3, museum.landmarkZ)));
  scene.add(grounded(box(20.5, 0.7, 14.5, makeMaterial(0xffffff), museum.landmarkX, 6.65, museum.landmarkZ)));
  for (const offset of [-6, -2, 2, 6]) {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 5.2, 12), makeMaterial(0xffffff));
    column.position.set(museum.landmarkX + offset, 2.9, museum.landmarkZ + 6.8);
    column.position.y += terrainHeightAt(column.position.x, column.position.z);
    scene.add(column);
  }
  addLandmarkLabel(scene, museum.name, museum.landmarkX, terrainHeightAt(museum.landmarkX, museum.landmarkZ) + 10, museum.landmarkZ, "#e84d8a");

  // Observatory tower and dome.
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(5.8, 7, 9, 20), makeMaterial(0x7b2cbf));
  tower.position.set(observatory.landmarkX, terrainHeightAt(observatory.landmarkX, observatory.landmarkZ) + 4.7, observatory.landmarkZ);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(6.2, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), makeMaterial(0xd6c2ff, { metalness: 0.18 }));
  dome.position.set(observatory.landmarkX, terrainHeightAt(observatory.landmarkX, observatory.landmarkZ) + 9.1, observatory.landmarkZ);
  scene.add(tower, dome);
  addLandmarkLabel(scene, observatory.name, observatory.landmarkX, terrainHeightAt(observatory.landmarkX, observatory.landmarkZ) + 14.5, observatory.landmarkZ, "#6f2dbd");

  // Harbour terminal: a working cargo yard replaces the former park prop so
  // the final delivery feels like reaching a real City Racer destination.
  const terminalX = park.landmarkX;
  const terminalZ = park.landmarkZ;
  scene.add(grounded(roundedBox(26, 0.5, 22, makeMaterial(0xd9e1e5), 0.3, terminalX, 0.35, terminalZ)));
  const containerColors = [0x1f93a8, 0xf2a93b, 0xd65552, 0x5870c0];
  for (const [index, offsetX, offsetZ, stacked] of [[0, -7, -4, false], [1, 1, -4, true], [2, 8, 4, false], [3, -4, 5, false]]) {
    const baseHeight = stacked ? 2.6 : 1.55;
    scene.add(grounded(roundedBox(6.4, 2.6, 4.4, makeMaterial(containerColors[index]), 0.18, terminalX + offsetX, baseHeight, terminalZ + offsetZ)));
    if (stacked) scene.add(grounded(roundedBox(6.4, 2.2, 4.4, makeMaterial(containerColors[(index + 2) % containerColors.length]), 0.18, terminalX + offsetX, 5.0, terminalZ + offsetZ)));
  }
  const craneMaterial = makeMaterial(0xffc857, { roughness: 0.48, metalness: 0.18 });
  for (const offsetX of [-10.5, 10.5]) scene.add(grounded(box(0.7, 8.2, 0.7, craneMaterial, terminalX + offsetX, 4.35, terminalZ + 7.5)));
  scene.add(grounded(box(22.2, 0.7, 0.9, craneMaterial, terminalX, 8.2, terminalZ + 7.5)));
  scene.add(grounded(box(0.22, 4.1, 0.22, makeMaterial(0x40515d), terminalX + 4.6, 5.8, terminalZ + 7.5)));
  scene.add(grounded(roundedBox(2.6, 1.6, 2.6, makeMaterial(0x4e6573), 0.18, terminalX + 4.6, 3.55, terminalZ + 7.5)));
  addLandmarkLabel(scene, park.name, terminalX, terrainHeightAt(terminalX, terminalZ) + 11.5, terminalZ, "#2f9e44");

  createTownLife(scene);
}

function createJumpRamps(scene) {
  for (const ramp of JUMP_RAMPS) {
    const group = new THREE.Group();
    const baseY = terrainHeightAt(ramp.x, ramp.z);
    group.position.set(ramp.x, baseY, ramp.z);
    group.rotation.y = ramp.heading;
    const deckMaterial = makeMaterial(0x2e3d4a, { roughness: 0.6, metalness: 0.3 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 10), deckMaterial);
    deck.rotation.x = -0.19;
    deck.position.set(0, 1.1, 2);
    deck.castShadow = true;
    const support = box(6.2, 1.6, 1.1, makeMaterial(0x51606d, { roughness: 0.7 }), 0, 0.8, 6.2);
    const stripeMaterial = makeMaterial(0xffd137, { roughness: 0.5, emissive: 0xffc928, emissiveIntensity: 0.3 });
    for (const side of [-1, 1]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.62, 10), stripeMaterial);
      stripe.rotation.x = -0.19;
      stripe.position.set(side * 3.5, 1.25, 2);
      group.add(stripe);
    }
    const sign = makeTextSprite("🚀 JUMP! 80km/h+", "#ffffff", "#d64545");
    sign.position.set(-5.2, 4.2, -4);
    sign.scale.set(8.5, 2.7, 1);
    group.add(deck, support, sign);
    scene.add(group);
  }
}

function createTownLife(scene) {
  const skin = makeMaterial(0xffd6a5, { roughness: 0.86 });
  const wheel = makeMaterial(0x273746, { roughness: 0.82 });
  const outfits = [0xff595e, 0x4361ee, 0x2ec4b6, 0xff9f1c, 0x9b5de5];
  const people = [[-205, -190], [-224, -178], [205, -116], [225, -122], [-212, 52], [58, 228], [78, 219], [214, 205]];
  people.forEach(([x, z], index) => {
    const person = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.15, 4, 8), makeMaterial(outfits[index % outfits.length]));
    body.position.y = 1.45;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.58, 14, 10), skin);
    head.position.y = 2.75;
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2), makeMaterial(index % 2 ? 0xffd166 : 0x264653));
    hat.position.y = 3.08;
    person.add(body, head, hat);
    person.position.set(x, terrainHeightAt(x, z) + 0.24, z);
    person.rotation.y = seeded(index + 300) * Math.PI * 2;
    scene.add(person);
  });

  const scooterColors = [0x70e000, 0xff595e, 0xffca3a, 0x00b4d8];
  [[-202, -176, 0], [202, -124, Math.PI], [-210, 62, 0], [58, 218, Math.PI]].forEach(([x, z, rotation], index) => {
    const scooter = new THREE.Group();
    const color = makeMaterial(scooterColors[index]);
    const deck = roundedBox(1.1, 0.45, 2.7, color, 0.18, 0, 0.72, 0);
    const seat = roundedBox(0.9, 0.38, 1.25, makeMaterial(0x293744), 0.16, 0, 1.38, -0.55);
    const cargo = roundedBox(1.35, 1.15, 1.25, makeMaterial(0xff3b30), 0.22, 0, 1.55, -1.25);
    scooter.add(deck, seat, cargo);
    for (const wheelZ of [-1, 1]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.25, 16), wheel);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(0, 0.48, wheelZ);
      scooter.add(tire);
    }
    scooter.position.set(x, terrainHeightAt(x, z) + 0.2, z);
    scooter.rotation.y = rotation;
    scene.add(scooter);
  });
}

function createDestinationMarkers(scene) {
  const markers = new Map();
  for (const destination of Object.values(DESTINATIONS)) {
    const group = new THREE.Group();
    group.position.set(destination.x, terrainHeightAt(destination.x, destination.z) + 0.35, destination.z);
    const color = new THREE.Color(destination.color);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.4,
      transparent: true,
      opacity: 0.72
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(7, 0.48, 10, 48), ringMaterial);
    ring.rotation.x = Math.PI / 2;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 4.4, 14, 32, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.11, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.y = 7;
    const parcel = box(2.2, 2.2, 2.2, makeMaterial(0xffd166), 0, 3, 0);
    parcel.rotation.y = Math.PI / 4;
    const label = makeTextSprite(`${destination.icon} ${destination.short}`, "#ffffff", destination.color);
    label.position.set(0, 10.5, 0);
    label.scale.set(9, 2.8, 1);
    group.add(ring, beam, parcel, label);
    group.visible = false;
    group.userData = { ring, parcel, beam };
    scene.add(group);
    markers.set(destination.id, group);
  }
  return markers;
}

function makeDecalSprite(icon) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.fillStyle = "rgba(255,255,255,.92)";
  context.beginPath();
  context.arc(64, 64, 55, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#243b53";
  context.font = "900 66px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(icon, 64, 67);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.55, 1.55, 1);
  sprite.userData.texture = texture;
  return sprite;
}

function createSectionedCarMesh(sections, material) {
  const positions = [];
  const indices = [];
  for (const section of sections) {
    positions.push(
      -section.lowerWidth, section.lowerY, section.z,
      section.lowerWidth, section.lowerY, section.z,
      -section.upperWidth, section.upperY, section.z,
      section.upperWidth, section.upperY, section.z
    );
  }
  for (let index = 0; index < sections.length - 1; index += 1) {
    const a = index * 4;
    const b = a + 4;
    indices.push(
      a, b, a + 1, b, b + 1, a + 1,
      a + 2, a + 3, b + 2, a + 3, b + 3, b + 2,
      a, a + 2, b, a + 2, b + 2, b,
      a + 1, b + 1, a + 3, a + 3, b + 1, b + 3
    );
  }
  const finish = (sections.length - 1) * 4;
  indices.push(0, 1, 2, 2, 1, 3, finish, finish + 2, finish + 1, finish + 2, finish + 3, finish + 1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createWheelAssembly(radius, width, tireMaterial, rimMaterial, accentMaterial) {
  const assembly = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 28), tireMaterial);
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, width * 1.03, 18), rimMaterial);
  rim.rotation.z = Math.PI / 2;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.2, radius * 0.2, width * 1.08, 16), accentMaterial);
  hub.rotation.z = Math.PI / 2;
  const spokeMaterial = makeMaterial(0xdde5ea, { roughness: 0.22, metalness: 0.86 });
  const spokeGroup = new THREE.Group();
  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2;
    const spoke = roundedBox(width * 1.08, radius * 0.52, radius * 0.085, spokeMaterial, 0.025);
    spoke.position.set(0, Math.sin(angle) * radius * 0.27, Math.cos(angle) * radius * 0.27);
    spoke.rotation.x = -angle;
    spokeGroup.add(spoke);
  }
  assembly.add(tire, rim, spokeGroup, hub);
  assembly.userData.radius = radius;
  return assembly;
}

function carGroundOffset(car) {
  const profile = car.profile || getVehicleProfile("snowbug");
  return 0.035 - profile.clearance * 0.5 * profile.scale;
}

function getVehicleProfile(vehicleId) {
  return {
    snowbug: { length: 6.85, width: 3.25, roof: 1.92, wheel: 0.62, clearance: 0.09, cabinStart: -1.66, cabinEnd: 1.18, scale: 0.93, kind: "sedan", spoiler: true },
    trailfox: { length: 7.2, width: 3.34, roof: 1.88, wheel: 0.66, clearance: 0.09, cabinStart: -1.7, cabinEnd: 1.26, scale: 0.94, kind: "sedan", spoiler: true },
    snowcat: { length: 6.72, width: 3.27, roof: 1.66, wheel: 0.65, clearance: 0.08, cabinStart: -1.18, cabinEnd: 0.75, scale: 0.95, kind: "roadster" },
    ridgegt: { length: 7.18, width: 3.45, roof: 1.74, wheel: 0.69, clearance: 0.07, cabinStart: -1.16, cabinEnd: 0.9, scale: 0.96, kind: "super", spoiler: true },
    aurora: { length: 7.3, width: 3.5, roof: 1.79, wheel: 0.7, clearance: 0.065, cabinStart: -1.32, cabinEnd: 0.96, scale: 0.96, kind: "coupe", spoiler: true, glow: true }
  }[vehicleId] || { length: 6.85, width: 3.25, roof: 1.92, wheel: 0.62, clearance: 0.09, cabinStart: -1.66, cabinEnd: 1.18, scale: 0.93, kind: "sedan", spoiler: true };
}

function createDeliveryCar(scene, initialStyle) {
  const group = new THREE.Group();
  // metalness가 높으면 환경맵 없는 씬에서 차체가 검게 죽는다 — 로우폴리엔 낮은 금속성이 맞다.
  const bodyMaterial = makeMaterial(initialStyle.paint.body, {
    roughness: 0.34,
    metalness: 0.16,
    emissive: initialStyle.paint.body,
    emissiveIntensity: 0.09
  });
  const accentMaterial = makeMaterial(initialStyle.paint.accent, { roughness: 0.32, metalness: 0.34 });
  // 유리는 살짝 투명한 청록 틴트로 — 불투명 검정 캐빈이 차를 통째로 어둡게 만들지 않게 합니다.
  const glassMaterial = makeMaterial(0x1a3346, { roughness: 0.08, metalness: 0.62, emissive: 0x2c5a74, emissiveIntensity: 0.22, transparent: true, opacity: 0.86 });
  const wheelMaterial = makeMaterial(0x171c22, { roughness: 0.74 });
  const rimMaterial = makeMaterial(initialStyle.wheel.color, { roughness: 0.2, metalness: 0.82 });
  const darkMaterial = makeMaterial(0x1c2733, { roughness: 0.68, metalness: 0.22 });
  const chromeMaterial = makeMaterial(0xcbd5dd, { roughness: 0.16, metalness: 0.92 });
  const headlightMaterial = makeMaterial(0xeaf8ff, { roughness: 0.08, emissive: 0xc9efff, emissiveIntensity: 1.5 });
  const taillightMaterial = makeMaterial(0xff2438, { roughness: 0.15, emissive: 0xff071e, emissiveIntensity: 1.6 });
  const vehicleKit = new THREE.Group();
  const topper = new THREE.Group();
  group.add(vehicleKit, topper);
  const decal = makeDecalSprite(initialStyle.decal.icon);
  decal.material.rotation = -Math.PI / 2;
  decal.scale.set(0.68, 0.68, 1);
  group.add(decal);
  group.position.set(0, drivingSurfaceHeightAt(0, 0) + 0.25, 0);
  scene.add(group);
  return {
    group, bodyMaterial, accentMaterial, glassMaterial, wheelMaterial, rimMaterial, darkMaterial,
    chromeMaterial, headlightMaterial, taillightMaterial, wheels: [], topper, vehicleKit, decal, profile: null
  };
}

function createVehicleNavigator(car) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 1.45);
  shape.lineTo(-0.72, 0.22);
  shape.lineTo(-0.28, 0.22);
  shape.lineTo(-0.28, -1.08);
  shape.lineTo(0.28, -1.08);
  shape.lineTo(0.28, 0.22);
  shape.lineTo(0.72, 0.22);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ color: 0xffbd2e, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthTest: false, depthWrite: false });
  const navigator = new THREE.Mesh(geometry, material);
  navigator.name = "vehicle-navigation-arrow";
  navigator.position.set(0, 3.1, 0);
  navigator.renderOrder = 8;
  navigator.visible = false;
  car.group.add(navigator);
  return navigator;
}

function clearVehicleKit(car) {
  const protectedMaterials = new Set([
    car.bodyMaterial, car.accentMaterial, car.glassMaterial, car.wheelMaterial, car.rimMaterial,
    car.darkMaterial, car.chromeMaterial, car.headlightMaterial, car.taillightMaterial
  ]);
  while (car.vehicleKit.children.length) {
    const child = car.vehicleKit.children[0];
    car.vehicleKit.remove(child);
    child.traverse((object) => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach((material) => { if (!protectedMaterials.has(material)) material.dispose?.(); });
      else if (object.material && !protectedMaterials.has(object.material)) object.material.dispose?.();
    });
  }
}

function rebuildVehicleKit(car, style) {
  clearVehicleKit(car);
  const vehicleId = style.vehicle?.id || "snowbug";
  const profile = getVehicleProfile(vehicleId);
  car.profile = profile;
  const { length, width, roof, wheel, clearance } = profile;
  const halfWidth = width / 2;
  const bodyBottom = 0.48 + clearance;
  const body = createSectionedCarMesh([
    { z: -length / 2, lowerY: bodyBottom + 0.12, upperY: bodyBottom + 0.69, lowerWidth: halfWidth * 0.82, upperWidth: halfWidth * 0.72 },
    { z: -length * 0.38, lowerY: bodyBottom, upperY: bodyBottom + 0.98, lowerWidth: halfWidth, upperWidth: halfWidth * 0.94 },
    { z: length * 0.28, lowerY: bodyBottom, upperY: bodyBottom + 0.9, lowerWidth: halfWidth, upperWidth: halfWidth * 0.95 },
    { z: length * 0.43, lowerY: bodyBottom + 0.08, upperY: bodyBottom + 0.72, lowerWidth: halfWidth * 0.96, upperWidth: halfWidth * 0.8 },
    { z: length / 2, lowerY: bodyBottom + 0.18, upperY: bodyBottom + 0.52, lowerWidth: halfWidth * 0.78, upperWidth: halfWidth * 0.66 }
  ], car.bodyMaterial);
  car.vehicleKit.add(body);

  const cabinRear = profile.cabinStart;
  const cabinFront = profile.cabinEnd;
  const cabin = createSectionedCarMesh([
    { z: cabinRear, lowerY: bodyBottom + 0.84, upperY: roof * 0.82, lowerWidth: halfWidth * 0.87, upperWidth: halfWidth * 0.7 },
    { z: cabinRear + 0.5, lowerY: bodyBottom + 0.84, upperY: roof, lowerWidth: halfWidth * 0.86, upperWidth: halfWidth * 0.66 },
    { z: cabinFront - 0.45, lowerY: bodyBottom + 0.84, upperY: roof + (profile.kind === "wagon" ? 0.05 : 0), lowerWidth: halfWidth * 0.86, upperWidth: halfWidth * 0.67 },
    { z: cabinFront, lowerY: bodyBottom + 0.82, upperY: bodyBottom + 1.0, lowerWidth: halfWidth * 0.84, upperWidth: halfWidth * 0.76 }
  ], car.glassMaterial);
  car.vehicleKit.add(cabin);

  const rearGlassHeight = Math.max(0.52, roof - (bodyBottom + 1.08));
  const rearGlass = roundedBox(
    width * (profile.kind === "coupe" || profile.kind === "super" ? 0.58 : 0.66),
    rearGlassHeight,
    0.115,
    car.glassMaterial,
    0.08,
    0,
    bodyBottom + 1.03 + rearGlassHeight / 2,
    cabinRear - 0.065
  );
  const rearGlassTrim = roundedBox(width * 0.72, rearGlassHeight + 0.18, 0.075, car.darkMaterial, 0.08, 0, bodyBottom + 1.03 + rearGlassHeight / 2, cabinRear - 0.015);
  car.vehicleKit.add(rearGlassTrim, rearGlass);

  const roofPanel = roundedBox(width * 0.58, 0.12, Math.max(0.8, cabinFront - cabinRear - 0.8), car.bodyMaterial, 0.06, 0, roof + 0.02, (cabinFront + cabinRear) / 2);
  const frontSplitter = roundedBox(width * 0.86, 0.14, 0.48, car.darkMaterial, 0.05, 0, bodyBottom + 0.04, length / 2 + 0.08);
  const rearDiffuser = roundedBox(width * 0.9, 0.18, 0.42, car.darkMaterial, 0.05, 0, bodyBottom + 0.06, -length / 2 - 0.06);
  const rearBumper = roundedBox(width * 0.9, 0.2, 0.22, car.accentMaterial, 0.07, 0, bodyBottom + 0.33, -length / 2 - 0.1);
  const tailgateBand = roundedBox(width * 0.72, 0.14, 0.11, car.chromeMaterial, 0.04, 0, bodyBottom + 0.82, -length / 2 - 0.065);
  const trunkLip = roundedBox(width * 0.68, 0.09, 0.26, car.bodyMaterial, 0.045, 0, bodyBottom + 1.02, -length * 0.385);
  const leftSkirt = roundedBox(0.14, 0.16, length * 0.72, car.darkMaterial, 0.04, -halfWidth - 0.035, bodyBottom + 0.08, 0);
  const rightSkirt = roundedBox(0.14, 0.16, length * 0.72, car.darkMaterial, 0.04, halfWidth + 0.035, bodyBottom + 0.08, 0);
  // 사이드 액센트 스트라이프 — 옆면에 스포티한 라인을 그어 스탠스를 강조
  const leftStripe = roundedBox(0.05, 0.12, length * 0.6, car.accentMaterial, 0.02, -halfWidth - 0.015, bodyBottom + 0.58, 0.1);
  const rightStripe = roundedBox(0.05, 0.12, length * 0.6, car.accentMaterial, 0.02, halfWidth + 0.015, bodyBottom + 0.58, 0.1);
  const splitterAccent = roundedBox(width * 0.62, 0.06, 0.1, car.accentMaterial, 0.02, 0, bodyBottom + 0.14, length / 2 + 0.3);
  car.vehicleKit.add(leftStripe, rightStripe, splitterAccent);
  car.vehicleKit.add(roofPanel, frontSplitter, rearDiffuser, rearBumper, tailgateBand, trunkLip, leftSkirt, rightSkirt);

  car.flames = [];
  for (const side of [-1, 1]) {
    const headlight = roundedBox(width * 0.25, 0.2, 0.12, car.headlightMaterial, 0.05, side * width * 0.28, bodyBottom + 0.62, length / 2 + 0.05);
    const taillight = roundedBox(width * 0.28, 0.19, 0.12, car.taillightMaterial, 0.05, side * width * 0.27, bodyBottom + 0.68, -length / 2 - 0.03);
    const mirror = roundedBox(0.33, 0.16, 0.42, car.bodyMaterial, 0.08, side * (halfWidth + 0.17), bodyBottom + 1.15, cabinFront - 0.35);
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.44, 14), car.chromeMaterial);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(side * width * 0.27, bodyBottom + 0.13, -length / 2 - 0.22);
    // 터보 전용 배기 화염 — 평소엔 숨겨 두고 부스트 중에만 깜빡인다.
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.85, 8),
      makeMaterial(0xffb347, { emissive: 0xff7a1a, emissiveIntensity: 2.4, roughness: 0.3, transparent: true, opacity: 0.92 })
    );
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(side * width * 0.27, bodyBottom + 0.13, -length / 2 - 0.7);
    flame.visible = false;
    car.flames.push(flame);
    car.vehicleKit.add(headlight, taillight, mirror, exhaust, flame);
  }

  const plate = roundedBox(width * 0.32, 0.3, 0.08, makeMaterial(0xe7edf1, { roughness: 0.55 }), 0.04, 0, bodyBottom + 0.45, -length / 2 - 0.12);
  const rearBadge = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 8, 20), car.chromeMaterial);
  rearBadge.position.set(0, bodyBottom + 0.88, -length / 2 - 0.13);
  rearBadge.rotation.x = Math.PI / 2;
  car.vehicleKit.add(plate, rearBadge);

  // 바퀴는 펜더 안쪽으로 밀어 넣어 차체 밖으로 튀어나오지 않게 합니다.
  // 바깥 면이 차체 옆면보다 6cm만 돌출되도록 휠 폭의 절반만큼 안쪽에 축을 둡니다.
  const wheelWidth = 0.48;
  const axleX = halfWidth - wheelWidth / 2 + 0.06;
  const wheelY = wheel + clearance * 0.5;
  const axleZ = length * 0.31;
  car.wheels = [];
  for (const x of [-axleX, axleX]) {
    for (const z of [-axleZ, axleZ]) {
      const wheelAssembly = createWheelAssembly(wheel, wheelWidth, car.wheelMaterial, car.rimMaterial, car.accentMaterial);
      wheelAssembly.userData.radius = wheel * profile.scale;
      wheelAssembly.position.set(x, wheelY, z);
      wheelAssembly.userData.home = { x, y: wheelY, z, radius: wheel * profile.scale };
      car.vehicleKit.add(wheelAssembly);
      car.wheels.push(wheelAssembly);
      const arch = new THREE.Mesh(new THREE.TorusGeometry(wheel * 1.14, 0.115, 6, 16, Math.PI), car.darkMaterial);
      arch.position.set(Math.sign(x) * (halfWidth + 0.03), wheelY, z);
      arch.rotation.y = Math.PI / 2;
      car.vehicleKit.add(arch);
    }
  }

  if (profile.kind === "rally") {
    const hoodVent = roundedBox(width * 0.34, 0.09, 0.72, car.darkMaterial, 0.04, 0, bodyBottom + 0.98, length * 0.27);
    const rallyBar = roundedBox(width * 0.76, 0.12, 0.18, car.accentMaterial, 0.04, 0, roof + 0.08, cabinRear + 0.2);
    car.vehicleKit.add(hoodVent, rallyBar);
  }
  if (profile.spoiler) {
    const wing = roundedBox(width * 0.86, 0.12, 0.42, car.darkMaterial, 0.04, 0, bodyBottom + 1.28, -length * 0.39);
    const leftPost = roundedBox(0.12, 0.62, 0.16, car.darkMaterial, 0.03, -width * 0.29, bodyBottom + 1.02, -length * 0.39);
    const rightPost = roundedBox(0.12, 0.62, 0.16, car.darkMaterial, 0.03, width * 0.29, bodyBottom + 1.02, -length * 0.39);
    car.vehicleKit.add(wing, leftPost, rightPost);
  }
  if (profile.glow) {
    const glowMaterial = makeMaterial(style.paint.glow || 0x72ddf7, { emissive: style.paint.glow || 0x72ddf7, emissiveIntensity: 2.1, roughness: 0.18 });
    car.vehicleKit.add(roundedBox(width * 0.92, 0.055, length * 0.68, glowMaterial, 0.02, 0, bodyBottom - 0.03, 0));
  }

  car.topper.position.set(0, roof + 0.18, (cabinRear + cabinFront) / 2 - 0.15);
  car.decal.position.set(halfWidth + 0.06, bodyBottom + 0.76, -0.1);
  car.decal.scale.set(0.62, 0.62, 1);
  car.group.scale.setScalar(profile.scale);
}

function rebuildTopper(car, style) {
  while (car.topper.children.length) {
    const child = car.topper.children[0];
    car.topper.remove(child);
    child.geometry?.dispose();
    child.material?.dispose();
  }
  const accent = car.accentMaterial;
  if (style.topper.id === "stock") {
    return;
  } else if (style.topper.id === "parcel") {
    const cargoCase = roundedBox(1.75, 0.42, 1.15, makeMaterial(0x2a3138, { roughness: 0.48, metalness: 0.28 }), 0.14, 0, 0.3, 0);
    const crossbarA = roundedBox(2.25, 0.09, 0.12, car.chromeMaterial, 0.03, 0, 0.08, -0.48);
    const crossbarB = roundedBox(2.25, 0.09, 0.12, car.chromeMaterial, 0.03, 0, 0.08, 0.48);
    const deliveryStripe = roundedBox(0.2, 0.46, 1.19, accent, 0.03, 0, 0.31, 0);
    car.topper.add(cargoCase, crossbarA, crossbarB, deliveryStripe);
  } else if (style.topper.id === "cat") {
    const earMaterial = makeMaterial(style.paint.accent, { roughness: 0.28, metalness: 0.5 });
    for (const x of [-0.72, 0.72]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.48, 4), earMaterial);
      ear.position.set(x * 0.6, 0.24, 0);
      ear.rotation.y = Math.PI / 4;
      car.topper.add(ear);
    }
  } else if (style.topper.id === "rocket") {
    const rocket = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.78, 16), accent);
    rocket.rotation.x = Math.PI / 2;
    rocket.position.y = 0.25;
    car.topper.add(rocket);
  } else {
    const taxiLight = roundedBox(1.2, 0.32, 0.42, makeMaterial(0xffd60a, { emissive: 0xffb703, emissiveIntensity: 0.8, metalness: 0.18 }), 0.1, 0, 0.2, 0);
    car.topper.add(taxiLight);
  }
}

function createCoins(scene) {
  const positions = [];
  let candidateIndex = 0;
  while (positions.length < 84 && candidateIndex < 500) {
    const road = CITY_ROADS[(candidateIndex * 7) % CITY_ROADS.length];
    const segmentIndex = (candidateIndex * 3) % Math.max(1, road.path.length - 1);
    const start = road.path[segmentIndex];
    const end = road.path[segmentIndex + 1] || start;
    const t = 0.2 + seeded(candidateIndex + 600, 2) * 0.6;
    const position = [lerp(start.x, end.x, t), lerp(start.z, end.z, t)];
    candidateIndex += 1;
    if (Math.hypot(position[0], position[1]) < 24) continue;
    if (Object.values(DESTINATIONS).some((destination) => Math.hypot(position[0] - destination.x, position[1] - destination.z) < 18)) continue;
    if (positions.some(([x, z]) => Math.hypot(position[0] - x, position[1] - z) < 7)) continue;
    positions.push(position);
  }
  const material = makeMaterial(0xffd60a, { emissive: 0xffb703, emissiveIntensity: 0.65, metalness: 0.3 });
  // 납작한 실린더를 세워서 진짜 동전처럼 — 도넛(토러스) 모양 탈피
  const coinGeometry = new THREE.CylinderGeometry(0.62, 0.62, 0.16, 18);
  coinGeometry.rotateX(Math.PI / 2);
  return positions.map(([x, z], index) => {
    const mesh = new THREE.Mesh(coinGeometry, material.clone());
    mesh.position.set(x, drivingSurfaceHeightAt(x, z) + 1.6, z);
    mesh.rotation.y = index * 0.7;
    mesh.castShadow = true;
    scene.add(mesh);
    return { mesh, x, z, collected: false, phase: index * 0.45 };
  });
}

function isRoad(x, z) {
  return isPointOnCityRoad(x, z, 1.4) || Math.hypot(x, z) < 8;
}

function roadRecoveryPose(x, z, heading) {
  const hit = closestRoadPoint(x, z);
  if (!hit) return null;
  const start = hit.road.path[hit.segmentIndex];
  const end = hit.road.path[hit.segmentIndex + 1];
  const forwardHeading = Math.atan2(end.x - start.x, end.z - start.z);
  const reverseHeading = normalizeAngle(forwardHeading + Math.PI);
  const targetHeading = Math.abs(normalizeAngle(forwardHeading - heading)) <= Math.abs(normalizeAngle(reverseHeading - heading))
    ? forwardHeading
    : reverseHeading;
  return { x: hit.point.x, z: hit.point.z, heading: targetHeading };
}

function roadPathToEndpoint(hit, endpointId) {
  if (endpointId === hit.road.a) return [hit.point, ...hit.road.path.slice(0, hit.segmentIndex + 1).reverse()];
  return [hit.point, ...hit.road.path.slice(hit.segmentIndex + 1)];
}

function roadCost(road) {
  const classFactor = road.type === "arterial" ? 0.8 : road.type === "collector" ? 0.9 : road.type === "alley" ? 1.9 : 1;
  return pathLength(road.path) * classFactor;
}

function shortestNodeRoute(startId, finishId) {
  const open = [{ nodeId: startId, score: 0 }];
  const best = new Map([[startId, 0]]);
  const previous = new Map();
  while (open.length) {
    let bestIndex = 0;
    for (let index = 1; index < open.length; index += 1) if (open[index].score < open[bestIndex].score) bestIndex = index;
    const current = open.splice(bestIndex, 1)[0];
    if (current.score > (best.get(current.nodeId) ?? Infinity) + 0.001) continue;
    if (current.nodeId === finishId) {
      const roads = [];
      let cursor = finishId;
      while (cursor !== startId) {
        const entry = previous.get(cursor);
        if (!entry) return null;
        roads.unshift(entry.road);
        cursor = entry.nodeId;
      }
      return { roads, cost: current.score };
    }
    for (const road of CITY_ROADS) {
      let neighborId = null;
      if (road.a === current.nodeId) neighborId = road.b;
      else if (road.b === current.nodeId) neighborId = road.a;
      if (!neighborId) continue;
      const nextScore = current.score + roadCost(road);
      if (nextScore >= (best.get(neighborId) ?? Infinity) - 0.001) continue;
      best.set(neighborId, nextScore);
      previous.set(neighborId, { nodeId: current.nodeId, road });
      open.push({ nodeId: neighborId, score: nextScore });
    }
  }
  return null;
}

export function routeLength(points) {
  return pathLength(points);
}

export function buildRoadRoute(x, z, target, heading = 0) {
  if (!target) return [];
  const start = { x, z };
  const hit = closestRoadPoint(x, z);
  const finishNodeId = DESTINATION_NODES[target.id];
  if (!hit || !finishNodeId) return [start, { x: target.x, z: target.z }];
  const candidates = [];
  for (const endpointId of [hit.road.a, hit.road.b]) {
    const graph = shortestNodeRoute(endpointId, finishNodeId);
    if (!graph) continue;
    const partial = roadPathToEndpoint(hit, endpointId);
    const route = [start, ...partial];
    let cursor = endpointId;
    for (const road of graph.roads) {
      const forward = road.a === cursor;
      const oriented = forward ? road.path : [...road.path].reverse();
      route.push(...oriented.slice(1));
      cursor = forward ? road.b : road.a;
    }
    route.push({ x: target.x, z: target.z });
    const unique = route.filter((point, index) => index === 0 || Math.hypot(point.x - route[index - 1].x, point.z - route[index - 1].z) > 0.18);
    if (Math.hypot(unique.at(-1).x - target.x, unique.at(-1).z - target.z) > 0.001) unique.push({ x: target.x, z: target.z });
    else unique[unique.length - 1] = { x: target.x, z: target.z };
    const next = unique.find((point, index) => index > 0 && Math.hypot(point.x - x, point.z - z) > 3) || unique.at(-1);
    const headingPenalty = Math.abs(normalizeAngle(Math.atan2(next.x - x, next.z - z) - heading)) * 2.4;
    candidates.push({ route: unique, cost: graph.cost + pathLength(partial) + hit.distance + headingPenalty });
  }
  candidates.sort((a, b) => a.cost - b.cost || routeLength(a.route) - routeLength(b.route));
  return candidates[0]?.route || [start, { x: target.x, z: target.z }];
}

function normalizeAngle(angle) {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

export function navigationForRoute(route, heading) {
  if (route.length < 2) return { kind: "arrive", label: "배달존에 도착했어요", relativeAngle: 0, waypointDistance: 0 };
  let walked = 0;
  let waypoint = route.at(-1);
  let waypointIndex = route.length - 1;
  for (let index = 1; index < route.length; index += 1) {
    walked += Math.hypot(route[index].x - route[index - 1].x, route[index].z - route[index - 1].z);
    if (walked >= 18) {
      waypoint = route[index];
      waypointIndex = index;
      break;
    }
  }
  const dx = waypoint.x - route[0].x;
  const dz = waypoint.z - route[0].z;
  const waypointDistance = Math.hypot(dx, dz);
  const relativeAngle = normalizeAngle(Math.atan2(dx, dz) - heading);
  if (Math.abs(relativeAngle) > 2.45) {
    return { kind: "uturn", label: "안전하게 유턴", relativeAngle, waypointDistance };
  }
  let turnDistance = 0;
  for (let index = 1; index < Math.min(route.length - 1, waypointIndex + 8); index += 1) {
    const previous = route[index - 1];
    const current = route[index];
    const next = route[index + 1];
    turnDistance += Math.hypot(current.x - previous.x, current.z - previous.z);
    const incoming = Math.atan2(current.x - previous.x, current.z - previous.z);
    const outgoing = Math.atan2(next.x - current.x, next.z - current.z);
    const turn = normalizeAngle(outgoing - incoming);
    if (Math.abs(turn) > 0.48 && turnDistance < 85) {
      const left = turn > 0;
      return { kind: left ? "left" : "right", label: `${Math.max(1, Math.round(turnDistance))}m 후 ${left ? "좌회전" : "우회전"}`, relativeAngle, waypointDistance };
    }
  }
  if (Math.abs(relativeAngle) > 0.28) {
    const left = relativeAngle > 0;
    return { kind: left ? "left" : "right", label: `${left ? "왼쪽" : "오른쪽"} 곡선 따라가기`, relativeAngle, waypointDistance };
  }
  return { kind: "straight", label: `앞 도로 ${Math.max(1, Math.round(Math.min(60, routeLength(route))))}m`, relativeAngle, waypointDistance };
}

function districtFor(x, z) {
  if (Math.hypot(x, z - 72) < 108) return { name: "센트럴 배송 허브", color: "#247ba0" };
  if (z > 144) return { name: "하버 프론트", color: "#168aad" };
  if (x < -48 && z < 32) return { name: "웨스트 엔진 지구", color: "#52796f" };
  if (x < 0 && z >= 32) return { name: "웨스트 마켓", color: "#bc6c5c" };
  return { name: "이스트 스카이라인", color: "#5e60ce" };
}

function pointAlongRoute(route, distance) {
  let walked = 0;
  for (let index = 0; index < route.length - 1; index += 1) {
    const from = route[index];
    const to = route[index + 1];
    const segmentLength = Math.hypot(to.x - from.x, to.z - from.z);
    if (walked + segmentLength >= distance && segmentLength > 0.01) {
      const t = (distance - walked) / segmentLength;
      return {
        x: lerp(from.x, to.x, t),
        z: lerp(from.z, to.z, t),
        dirX: (to.x - from.x) / segmentLength,
        dirZ: (to.z - from.z) / segmentLength
      };
    }
    walked += segmentLength;
  }
  return null;
}

// 보스 퀴즈(최종 배송지 모달): 계약의 학습팩에서 4지선다로 출제한다.
function makeBossQuiz(label, packId, wanted, mathLevel) {
  const question = makeQuestion(packId, { choiceCount: 4, wanted, level: mathLevel });
  return {
    label,
    packId: question.packId,
    quizKey: question.key,
    hanja: question.headline,
    korean: "",
    question: question.prompt,
    options: question.choices,
    correctIndex: question.correctIndex,
    meaning: question.explain
  };
}

function createDriftSmokePool(scene) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(32, 32, 4, 32, 32, 30);
  gradient.addColorStop(0, "rgba(235,240,244,0.85)");
  gradient.addColorStop(1, "rgba(235,240,244,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  const pool = [];
  for (let index = 0; index < 14; index += 1) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false }));
    sprite.visible = false;
    scene.add(sprite);
    pool.push({ sprite, life: 0 });
  }
  let cursor = 0;
  let spawnAccumulator = 0;
  return {
    emit(x, y, z, dt) {
      spawnAccumulator += dt;
      if (spawnAccumulator < 0.045) return;
      spawnAccumulator = 0;
      const puff = pool[cursor];
      cursor = (cursor + 1) % pool.length;
      puff.life = 0.55;
      puff.sprite.visible = true;
      puff.sprite.position.set(x + (Math.random() - 0.5) * 0.7, y, z + (Math.random() - 0.5) * 0.7);
      puff.sprite.scale.setScalar(0.65);
    },
    update(dt) {
      for (const puff of pool) {
        if (puff.life <= 0) continue;
        puff.life -= dt;
        const progress = 1 - Math.max(0, puff.life) / 0.55;
        puff.sprite.scale.setScalar(0.65 + progress * 1.1);
        puff.sprite.position.y += dt * 0.9;
        puff.sprite.material.opacity = 0.5 * (1 - progress);
        if (puff.life <= 0) puff.sprite.visible = false;
      }
    }
  };
}

function createGameAudio() {
  let context = null;
  let muted = false;
  function unlock() {
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    if (!AudioEngine) return;
    if (!context) context = new AudioEngine();
    if (context.state === "suspended") context.resume();
  }
  function tone(frequency, duration = 0.1, type = "sine", volume = 0.06, delay = 0) {
    if (muted) return;
    unlock();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime + delay);
    gain.gain.setValueAtTime(0.0001, context.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + delay + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(context.currentTime + delay);
    oscillator.stop(context.currentTime + delay + duration + 0.03);
  }
  let engineNodes = null;
  function ensureEngine() {
    unlock();
    if (!context || engineNodes) return;
    const osc1 = context.createOscillator();
    osc1.type = "sawtooth";
    const osc2 = context.createOscillator();
    osc2.type = "square";
    osc2.detune.value = 7;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 640;
    const gain = context.createGain();
    gain.gain.value = 0;
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain).connect(context.destination);
    osc1.start();
    osc2.start();
    engineNodes = { osc1, osc2, gain, filter };
  }
  function setEngine(rpm, gear, boosting, speedRatio) {
    if (muted) { engineNodes?.gain.gain.setTargetAtTime(0, context?.currentTime || 0, 0.05); return; }
    ensureEngine();
    if (!engineNodes || context.state !== "running") return;
    const now = context.currentTime;
    let frequency = 52 + gear * 16 + rpm * 88;
    if (boosting) frequency *= 1.12;
    engineNodes.osc1.frequency.setTargetAtTime(frequency, now, 0.05);
    engineNodes.osc2.frequency.setTargetAtTime(frequency * 1.004, now, 0.05);
    engineNodes.filter.frequency.setTargetAtTime(420 + speedRatio * 2300 + (boosting ? 520 : 0), now, 0.08);
    const volume = 0.008 + speedRatio * 0.03 + (boosting ? 0.013 : 0);
    engineNodes.gain.gain.setTargetAtTime(volume, now, 0.1);
  }
  function stopEngine() {
    if (engineNodes && context) engineNodes.gain.gain.setTargetAtTime(0, context.currentTime, 0.12);
  }
  return {
    unlock,
    setMuted(value) { muted = value; if (value) stopEngine(); },
    setEngine,
    stopEngine,
    start() { tone(440, 0.1, "square", 0.04); tone(660, 0.14, "square", 0.05, 0.11); },
    coin() { tone(880, 0.08, "sine", 0.05); tone(1320, 0.1, "sine", 0.04, 0.06); },
    bump() { tone(110, 0.12, "sawtooth", 0.04); },
    delivery() { tone(523, 0.12, "sine", 0.05); tone(659, 0.12, "sine", 0.05, 0.1); tone(784, 0.18, "sine", 0.05, 0.2); },
    answer(correct) { tone(correct ? 988 : 180, correct ? 0.2 : 0.25, correct ? "sine" : "square", 0.05); },
    gearShift(gear) { tone(240 + gear * 60, 0.07, "square", 0.028); },
    nearMiss() { tone(1240, 0.09, "sine", 0.045); tone(1560, 0.08, "sine", 0.035, 0.06); },
    crash() { tone(90, 0.22, "sawtooth", 0.07); tone(60, 0.3, "square", 0.05, 0.05); },
    drift() { tone(320, 0.1, "sawtooth", 0.02); },
    dispose() { context?.close?.(); context = null; engineNodes = null; }
  };
}

export function createDeliveryRuntime({ mount, initialStyle, onHud, onDelivery, onFinish, onMessage, onQuizOutcome }) {
  let disposed = false;
  let animationId = 0;
  let hudAccumulator = 0;
  let messageCooldown = 0;
  let activeMission = null;
  let stopIds = [];
  let latestRoute = [];
  let style = initialStyle;
  let pendingQuiz = null;
  let activeGates = [];
  let gateWanted = [];
  let rivalCar = null;
  let rivalRace = null;

  function ensureRivalCar() {
    if (rivalCar) return rivalCar;
    const group = new THREE.Group();
    const bodyMaterial = makeMaterial(0xff2e4d, { roughness: 0.3, metalness: 0.18, emissive: 0xff2e4d, emissiveIntensity: 0.12 });
    const body = roundedBox(2.5, 0.72, 5.4, bodyMaterial, 0.24, 0, 0.78, 0);
    const cabin = roundedBox(1.9, 0.74, 2.3, makeMaterial(0x101c26, { roughness: 0.12, metalness: 0.5 }), 0.22, 0, 1.38, -0.25);
    const wing = roundedBox(2.3, 0.13, 0.5, makeMaterial(0x1c2733, { roughness: 0.6 }), 0.05, 0, 1.5, -2.45);
    const wingPostL = box(0.12, 0.5, 0.16, makeMaterial(0x1c2733), -0.7, 1.2, -2.45);
    const wingPostR = box(0.12, 0.5, 0.16, makeMaterial(0x1c2733), 0.7, 1.2, -2.45);
    group.add(body, cabin, wing, wingPostL, wingPostR);
    const tireMaterial = makeMaterial(0x14181c, { roughness: 0.8 });
    const wheels = [];
    for (const wheelX of [-1.06, 1.06]) {
      for (const wheelZ of [-1.62, 1.62]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 14), tireMaterial);
        wheel.position.set(wheelX, 0.5, wheelZ);
        wheel.rotation.z = Math.PI / 2;
        group.add(wheel);
        wheels.push(wheel);
      }
    }
    const flag = makeTextSprite("🏁 RIVAL", "#ffffff", "#ff2e4d");
    flag.position.set(0, 3.1, 0);
    flag.scale.set(5.5, 1.7, 1);
    group.add(flag);
    group.traverse((object) => { if (object.isMesh) object.castShadow = true; });
    group.visible = false;
    scene.add(group);
    rivalCar = { group, wheels };
    return rivalCar;
  }

  function startRivalRace(mission) {
    const car2 = ensureRivalCar();
    const points = [];
    const stopMarks = [];
    let cursor = { x: citySpawn.x, z: citySpawn.z };
    let accumulated = 0;
    for (const stopId of mission.stops) {
      const target = DESTINATIONS[stopId];
      const leg = buildRoadRoute(cursor.x, cursor.z, target);
      const legPoints = points.length ? leg.slice(1) : leg;
      points.push(...legPoints);
      accumulated += routeLength(leg);
      stopMarks.push(accumulated);
      cursor = target;
    }
    rivalRace = {
      points,
      total: accumulated,
      stopMarks,
      nextStop: 0,
      distance: 0,
      speed: mission.rival.kmh / WORLD_SPEED_TO_KMH,
      pauseTimer: 0,
      finished: false
    };
    car2.group.visible = true;
    car2.group.position.set(citySpawn.x + 3, drivingSurfaceHeightAt(citySpawn.x + 3, citySpawn.z) + 0.05, citySpawn.z);
  }

  function stopRivalRace() {
    rivalRace = null;
    if (rivalCar) rivalCar.group.visible = false;
  }

  function updateRivalRace(dt) {
    if (!rivalRace || state.status !== "playing") return;
    if (rivalRace.pauseTimer > 0) {
      rivalRace.pauseTimer -= dt;
      return;
    }
    if (!rivalRace.finished) {
      rivalRace.distance += rivalRace.speed * dt;
      if (rivalRace.nextStop < rivalRace.stopMarks.length && rivalRace.distance >= rivalRace.stopMarks[rivalRace.nextStop]) {
        rivalRace.distance = rivalRace.stopMarks[rivalRace.nextStop];
        rivalRace.nextStop += 1;
        if (rivalRace.nextStop >= rivalRace.stopMarks.length) {
          rivalRace.finished = true;
          onMessage?.("라이벌이 먼저 도착했습니다! 그래도 완주하세요");
        } else {
          rivalRace.pauseTimer = 2.6;
        }
      }
    }
    const spot = pointAlongRoute(rivalRace.points, Math.min(rivalRace.distance, rivalRace.total - 0.2));
    if (!spot) return;
    const laneX = spot.x - spot.dirZ * 1.6;
    const laneZ = spot.z + spot.dirX * 1.6;
    rivalCar.group.position.set(laneX, drivingSurfaceHeightAt(laneX, laneZ) + 0.05, laneZ);
    rivalCar.group.rotation.y = Math.atan2(spot.dirX, spot.dirZ);
    for (const wheel of rivalCar.wheels) wheel.rotation.x += rivalRace.speed * dt / 0.5;
  }

  function clearLearningGates() {
    for (const gate of activeGates) {
      scene.remove(gate.group);
      gate.group.traverse((object) => {
        object.geometry?.dispose?.();
        if (object.material) {
          object.material.map?.dispose?.();
          object.material.dispose?.();
        }
      });
    }
    activeGates = [];
  }

  // 학습 게이트: 배송 경로 위에 문제 아치를 세우고, 정답 차선을 "달리면서" 고르게 한다.
  function spawnGatesForLeg(fromX, fromZ, target) {
    clearLearningGates();
    if (!activeMission?.packId || !target) return;
    const route = buildRoadRoute(fromX, fromZ, target);
    const total = routeLength(route);
    if (total < 110) return;
    const fractions = total > 280 ? [0.4, 0.72] : [0.55];
    for (const fraction of fractions) {
      const spot = pointAlongRoute(route, total * fraction);
      if (!spot) continue;
      const roadHit = closestRoadPoint(spot.x, spot.z);
      if (!roadHit || roadHit.road.bridge) continue;
      const roadWidth = roadHit.road.width;
      const question = makeQuestion(activeMission.packId, {
        choiceCount: roadWidth >= 18 ? 3 : 2,
        wanted: gateWanted,
        level: activeMission.mathLevel || 1
      });
      const laneCount = question.choices.length;
      const usableWidth = roadWidth - 3;
      const heading = Math.atan2(spot.dirX, spot.dirZ);
      const baseY = drivingSurfaceHeightAt(spot.x, spot.z);
      const group = new THREE.Group();
      group.position.set(spot.x, baseY, spot.z);
      group.rotation.y = heading;
      const postMaterial = makeMaterial(0x2e3d4a, { roughness: 0.5, metalness: 0.4 });
      for (const side of [-1, 1]) {
        const post = box(0.34, 7.2, 0.34, postMaterial.clone(), side * (roadWidth / 2 + 0.8), 3.6, 0);
        group.add(post);
      }
      const crossbar = box(roadWidth + 2.2, 0.34, 0.34, postMaterial.clone(), 0, 7.1, 0);
      group.add(crossbar);
      const promptSprite = makeTextSprite(`${question.headline} — ${question.prompt}`, "#ffffff", "#1c2733");
      promptSprite.position.set(0, 8.6, 0);
      promptSprite.scale.set(Math.max(15, roadWidth * 0.85), 4.4, 1);
      group.add(promptSprite);
      const laneSpan = usableWidth / laneCount;
      const laneColors = ["#ff595e", "#1982c4", "#8ac926"];
      question.choices.forEach((choice, laneIndex) => {
        const laneX = (laneIndex - (laneCount - 1) / 2) * laneSpan;
        const banner = makeTextSprite(choice, "#ffffff", laneColors[laneIndex % laneColors.length]);
        banner.position.set(laneX, 4.6, 0);
        banner.scale.set(Math.min(laneSpan * 0.94, 8.6), 2.6, 1);
        group.add(banner);
      });
      scene.add(group);
      activeGates.push({
        group,
        x: spot.x,
        z: spot.z,
        dirX: spot.dirX,
        dirZ: spot.dirZ,
        laneCount,
        laneSpan,
        halfWidth: roadWidth / 2,
        correctIndex: question.correctIndex,
        key: question.key,
        packId: question.packId,
        explain: question.explain,
        wanted: gateWanted.some((item) => item.packId === question.packId && item.key === question.key),
        prevAlong: -999,
        resolved: false
      });
    }
  }

  function updateLearningGates(dt) {
    for (const gate of activeGates) {
      if (gate.resolved) continue;
      const relX = state.x - gate.x;
      const relZ = state.z - gate.z;
      const along = relX * gate.dirX + relZ * gate.dirZ;
      const lateral = relX * gate.dirZ - relZ * gate.dirX;
      if (gate.prevAlong < 0 && along >= 0 && Math.abs(lateral) <= gate.halfWidth + 2) {
        gate.resolved = true;
        gate.group.visible = false;
        const laneIndex = clamp(Math.round(lateral / gate.laneSpan + (gate.laneCount - 1) / 2), 0, gate.laneCount - 1);
        const correct = laneIndex === gate.correctIndex;
        onQuizOutcome?.(gate.packId, gate.key, correct);
        if (correct) {
          const gold = gate.wanted ? 45 : 30;
          state.goldEarned += gold;
          state.score += gate.wanted ? 380 : 250;
          state.timeLeft += 6;
          state.boost = Math.min(100, state.boost + 25);
          audio.answer(true);
          onMessage?.(gate.wanted ? `수배 해제! +6초 · 🪙${gold}` : `게이트 정답! +6초 · 터보 +25 · 🪙${gold}`);
        } else {
          state.gatePenalty = 3;
          state.score = Math.max(0, state.score - 50);
          audio.answer(false);
          onMessage?.(`앗, 오답! ${gate.explain}`);
        }
      } else if (along > 30) {
        gate.resolved = true;
        gate.group.visible = false;
      }
      gate.prevAlong = along;
    }
    if (state.gatePenalty > 0) {
      state.gatePenalty -= dt;
      state.speed = Math.min(state.speed, 13);
    }
  }
  let cameraOrbitYaw = 0;
  let cameraOrbitHeight = 4.45;
  let dayPhase = 0.32;
  const citySpawn = CITY_NODES.hub;
  let carGroundHeight = drivingSurfaceHeightAt(citySpawn.x, citySpawn.z);
  let carRoadPitch = 0;
  let cameraDragPointerId = null;
  let cameraDragX = 0;
  let cameraDragY = 0;
  const audio = createGameAudio();
  const input = { left: false, right: false, accel: false, brake: false, boost: false };
  const state = {
    status: "garage",
    x: citySpawn.x,
    z: citySpawn.z,
    heading: 0,
    speed: 0,
    boost: 100,
    timeLeft: 0,
    score: 0,
    stars: 0,
    deliveryIndex: 0,
    distance: 0,
    steerAmount: 0,
    throttleAmount: 0,
    brakeAmount: 0,
    yawRate: 0
  };

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  mount.replaceChildren(renderer.domElement);

  function beginCameraDrag(event) {
    if (event.button !== 0) return;
    cameraDragPointerId = event.pointerId;
    cameraDragX = event.clientX;
    cameraDragY = event.clientY;
    renderer.domElement.setPointerCapture?.(event.pointerId);
    renderer.domElement.classList.add("camera-dragging");
  }

  function moveCameraDrag(event) {
    if (event.pointerId !== cameraDragPointerId) return;
    const deltaX = event.clientX - cameraDragX;
    const deltaY = event.clientY - cameraDragY;
    cameraDragX = event.clientX;
    cameraDragY = event.clientY;
    cameraOrbitYaw = normalizeAngle(cameraOrbitYaw - deltaX * 0.0085);
    cameraOrbitHeight = clamp(cameraOrbitHeight - deltaY * 0.045, 3.35, 9.5);
    event.preventDefault();
  }

  function endCameraDrag(event) {
    if (event.pointerId !== cameraDragPointerId) return;
    cameraDragPointerId = null;
    if (renderer.domElement.hasPointerCapture?.(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
    renderer.domElement.classList.remove("camera-dragging");
  }

  renderer.domElement.addEventListener("pointerdown", beginCameraDrag);
  renderer.domElement.addEventListener("pointermove", moveCameraDrag, { passive: false });
  renderer.domElement.addEventListener("pointerup", endCameraDrag);
  renderer.domElement.addEventListener("pointercancel", endCameraDrag);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd89175);
  scene.fog = new THREE.Fog(0xb57f72, 170, 520);
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 900);
  camera.position.set(citySpawn.x, drivingSurfaceHeightAt(citySpawn.x, citySpawn.z) + 8.5, citySpawn.z - 14);
  const cameraLookAt = new THREE.Vector3(citySpawn.x, drivingSurfaceHeightAt(citySpawn.x, citySpawn.z) + 2.1, citySpawn.z + 4.5);
  const cameraDesired = new THREE.Vector3();
  const cameraAim = new THREE.Vector3();
  const cameraRayDirection = new THREE.Vector3();
  const cameraRaycaster = new THREE.Raycaster();

  const hemisphere = new THREE.HemisphereLight(0xc7e7ff, 0x25332d, 1.2);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xfff1c9, 3.35);
  sun.position.set(-45, 72, -28);
  sun.castShadow = true;
  sun.shadow.mapSize.set(768, 768);
  Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 1, far: 180 });
  const sunTarget = new THREE.Object3D();
  scene.add(sunTarget);
  sun.target = sunTarget;
  scene.add(sun);

  createCity(scene);
  const destinationMarkers = createDestinationMarkers(scene);
  const car = createDeliveryCar(scene, style);
  rebuildTopper(car, style);
  rebuildVehicleKit(car, style);
  const vehicleNavigator = createVehicleNavigator(car);
  const driftSmoke = createDriftSmokePool(scene);
  car.group.position.y = carGroundHeight + carGroundOffset(car);
  const vehicleFillLight = new THREE.PointLight(0xd7efff, 10, 18, 2);
  vehicleFillLight.position.set(0, 4.2, -5.4);
  car.group.add(vehicleFillLight);
  const coins = createCoins(scene);
  const clock = new THREE.Timer();
  clock.connect(document);
  function currentTarget() {
    return DESTINATIONS[stopIds[state.deliveryIndex]] ?? null;
  }

  const skyStops = [
    [0, 0x050912], [0.19, 0x101b35], [0.25, 0xd77f68], [0.32, 0x75bce3],
    [0.64, 0x58a6d7], [0.74, 0xe56f53], [0.82, 0x17233e], [1, 0x050912]
  ];
  const fogStops = [
    [0, 0x101728], [0.2, 0x28354a], [0.26, 0xb78378], [0.34, 0x9fc9d8],
    [0.65, 0x87b7c8], [0.75, 0xb86f60], [0.83, 0x273346], [1, 0x101728]
  ];
  const sampleTimelineColor = (stops, phase, target) => {
    let finishIndex = stops.findIndex(([stop]) => stop >= phase);
    if (finishIndex <= 0) finishIndex = 1;
    const [startStop, startColor] = stops[finishIndex - 1];
    const [finishStop, finishColor] = stops[finishIndex];
    const mix = clamp((phase - startStop) / Math.max(0.001, finishStop - startStop), 0, 1);
    return target.copy(new THREE.Color(startColor)).lerp(new THREE.Color(finishColor), mix);
  };
  const skyColor = new THREE.Color();
  const fogColor = new THREE.Color();
  const warmSun = new THREE.Color(0xffad76);
  const noonSun = new THREE.Color(0xfff2d6);
  const moonLight = new THREE.Color(0x8da7d6);

  function formatWorldTime() {
    const totalMinutes = Math.floor(dayPhase * 24 * 60) % (24 * 60);
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
  }

  function applyTimeOfDay(dt = 0) {
    dayPhase = (dayPhase + dt / 720) % 1;
    const daylight = clamp(Math.sin((dayPhase - 0.25) * Math.PI * 2) * 1.7, 0, 1);
    const twilight = clamp(1 - Math.abs(dayPhase - 0.25) * 16, 0, 1) + clamp(1 - Math.abs(dayPhase - 0.75) * 16, 0, 1);
    sampleTimelineColor(skyStops, dayPhase, skyColor);
    sampleTimelineColor(fogStops, dayPhase, fogColor);
    scene.background.copy(skyColor);
    scene.fog.color.copy(fogColor);
    scene.fog.near = lerp(130, 190, daylight);
    scene.fog.far = lerp(390, 560, daylight);
    hemisphere.intensity = 0.38 + daylight * 1.72 + twilight * 0.2;
    hemisphere.color.copy(skyColor).lerp(new THREE.Color(0xe9f6ff), daylight * 0.6);
    hemisphere.groundColor.setHex(daylight > 0.25 ? 0x405341 : 0x111722);
    sun.intensity = 0.28 + daylight * 2.75 + twilight * 0.35;
    sun.color.copy(daylight > 0.65 ? noonSun : warmSun).lerp(moonLight, (1 - daylight) * (1 - twilight * 0.7));
    const sunAngle = (dayPhase - 0.25) * Math.PI * 2;
    sun.position.set(state.x + Math.cos(sunAngle) * 80, 38 + Math.max(0, Math.sin(sunAngle)) * 62, state.z - 42);
    sunTarget.position.set(state.x, terrainHeightAt(state.x, state.z), state.z);
    renderer.toneMappingExposure = 0.86 + daylight * 0.28 + twilight * 0.1;
    if (scene.userData.cityWindowMaterial) scene.userData.cityWindowMaterial.emissiveIntensity = 0.16 + (1 - daylight) * 1.4;
    if (scene.userData.billboardMaterial) scene.userData.billboardMaterial.emissiveIntensity = 0.45 + (1 - daylight) * 1.8;
    if (scene.userData.streetLampMaterial) scene.userData.streetLampMaterial.emissiveIntensity = 0.2 + (1 - daylight) * 2.6;
    if (scene.userData.skylineGlowMaterial) scene.userData.skylineGlowMaterial.emissiveIntensity = 0.24 + (1 - daylight) * 1.25;
    for (const material of scene.userData.roadGlowMaterials || []) material.emissiveIntensity = 0.12 + (1 - daylight) * 0.72;
    car.headlightMaterial.emissiveIntensity = 0.55 + (1 - daylight) * 3.4;
    car.taillightMaterial.emissiveIntensity = 1.25 + (1 - daylight) * 1.1;
  }

  function applyMissionMood(missionId = "morning") {
    dayPhase = { morning: 0.32, festival: 0.56, space: 0.71 }[missionId] ?? 0.32;
    applyTimeOfDay(0);
  }

  function applyStyle(nextStyle) {
    style = nextStyle;
    car.bodyMaterial.color.set(nextStyle.paint.body);
    car.bodyMaterial.emissive.set(nextStyle.paint.body);
    car.accentMaterial.color.set(nextStyle.paint.accent);
    car.rimMaterial.color.set(nextStyle.wheel.color);
    rebuildTopper(car, nextStyle);
    rebuildVehicleKit(car, nextStyle);
    car.group.position.y = carGroundHeight + carGroundOffset(car);
    if (car.decal) {
      car.decal.material.map?.dispose();
      car.decal.material.dispose();
      car.group.remove(car.decal);
    }
    car.decal = makeDecalSprite(nextStyle.decal.icon);
    const profile = car.profile || getVehicleProfile(nextStyle.vehicle?.id || "snowbug");
    car.decal.position.set(profile.width / 2 + 0.06, 1.22, -0.1);
    car.decal.scale.set(0.62, 0.62, 1);
    car.decal.material.rotation = -Math.PI / 2;
    car.group.add(car.decal);
  }

  function refreshMarkers() {
    const target = currentTarget();
    for (const [id, marker] of destinationMarkers) marker.visible = state.status === "playing" && id === target?.id;
  }

  function updateVehicleNavigator(navigation, elapsed = 0) {
    const isActive = state.status === "playing" && Boolean(currentTarget()) && navigation.kind !== "arrive";
    vehicleNavigator.visible = isActive;
    if (!isActive) return;
    const profile = car.profile || getVehicleProfile(style.vehicle?.id || "snowbug");
    vehicleNavigator.position.y = Math.max(2.75, profile.roof + 1.15);
    vehicleNavigator.rotation.y = navigation.relativeAngle;
    const pulse = 0.94 + Math.sin(elapsed * 5.4) * 0.055;
    vehicleNavigator.scale.setScalar(pulse);
  }

  function emitHud(force = false) {
    if (!force && hudAccumulator < 0.08) return;
    hudAccumulator = 0;
    const target = currentTarget();
    const dx = target ? target.x - state.x : 0;
    const dz = target ? target.z - state.z : 0;
    latestRoute = state.status === "playing" && target ? buildRoadRoute(state.x, state.z, target, state.heading) : [];
    const navigation = navigationForRoute(latestRoute, state.heading);
    updateVehicleNavigator(navigation, clock.getElapsed());
    const directDistance = target ? Math.hypot(dx, dz) : 0;
    const hudMaxSpeed = (style.vehicle?.topSpeed || 200) / WORLD_SPEED_TO_KMH;
    onHud?.({
      ...state,
      speed: Math.round(Math.abs(state.speed) * WORLD_SPEED_TO_KMH),
      speedLimit: style.vehicle?.topSpeed || 200,
      boosting: input.boost && state.boost > 1 && state.speed > 2,
      overdrive: state.speed > hudMaxSpeed + 0.5,
      speedRatio: clamp(Math.abs(state.speed) / hudMaxSpeed, 0, 1.2),
      gear: (state.gear ?? 0) + 1,
      drifting: Boolean(state.drifting),
      goldEarned: Math.round(state.goldEarned || 0),
      rivalStatus: rivalRace ? { progress: Math.min(1, rivalRace.distance / Math.max(1, rivalRace.total)), finished: rivalRace.finished } : null,
      bonusStatus: activeMission?.bonus ? {
        ...activeMission.bonus,
        current: activeMission.bonus.type === "noCrash" ? (state.crashCount || 0)
          : activeMission.bonus.type === "nearMiss" ? (state.nearMissCount || 0)
          : activeMission.bonus.type === "drift" ? Math.round((state.driftTotal || 0) * 10) / 10
          : (state.coinCount || 0)
      } : null,
      timeLeft: Math.max(0, state.timeLeft),
      deliveries: state.deliveryIndex,
      totalDeliveries: stopIds.length,
      target,
      targetDistance: target ? Math.round(routeLength(latestRoute)) : 0,
      directDistance: Math.round(directDistance),
      nearTarget: directDistance < 42,
      relativeAngle: navigation.relativeAngle,
      navigation,
      routePoints: latestRoute,
      district: districtFor(state.x, state.z),
      mission: activeMission,
      worldTime: formatWorldTime()
    });
  }

  function resetCoins() {
    coins.forEach((coin) => {
      coin.collected = false;
      coin.mesh.visible = true;
    });
  }

  function startMission(mission, options = {}) {
    audio.unlock();
    audio.start();
    activeMission = mission;
    gateWanted = Array.isArray(options.wanted) ? options.wanted : [];
    applyMissionMood(["morning", "festival", "space", "festival"][mission.slot ?? 0] || mission.id);
    stopIds = [...mission.stops];
    const firstTarget = DESTINATIONS[stopIds[0]];
    const openingRoute = buildRoadRoute(citySpawn.x, citySpawn.z, firstTarget);
    const openingWaypoint = openingRoute.find((point) => Math.hypot(point.x - citySpawn.x, point.z - citySpawn.z) > 3) || firstTarget;
    const openingHeading = Math.atan2(openingWaypoint.x - citySpawn.x, openingWaypoint.z - citySpawn.z);
    Object.assign(state, {
      status: "playing",
      x: citySpawn.x,
      z: citySpawn.z,
      heading: openingHeading,
      speed: 0,
      boost: 100,
      timeLeft: mission.time,
      score: 0,
      stars: 0,
      deliveryIndex: 0,
      distance: 0,
      steerAmount: 0,
      throttleAmount: 0,
      brakeAmount: 0,
      yawRate: 0,
      goldEarned: 0,
      crashCount: 0,
      nearMissCount: 0,
      driftTotal: 0,
      coinCount: 0,
      gatePenalty: 0,
      drifting: false,
      slipAngle: 0,
      airborne: false,
      vy: 0,
      rampCooldown: 0
    });
    cameraOrbitYaw = 0;
    cameraOrbitHeight = 4.45;
    carGroundHeight = drivingSurfaceHeightAt(citySpawn.x, citySpawn.z);
    carRoadPitch = 0;
    car.group.position.set(citySpawn.x, carGroundHeight + carGroundOffset(car), citySpawn.z);
    car.group.rotation.set(0, openingHeading, 0);
    pendingQuiz = null;
    latestRoute = [];
    resetCoins();
    spawnGatesForLeg(citySpawn.x, citySpawn.z, firstTarget);
    if (mission.rival) startRivalRace(mission);
    else stopRivalRace();
    refreshMarkers();
    onMessage?.("출발! 게이트는 정답 차선으로 통과하세요");
    emitHud(true);
  }

  function finishMission(reason = "complete") {
    state.status = "finished";
    state.speed = 0;
    clearLearningGates();
    refreshMarkers();
    const timeBonus = Math.round(Math.max(0, state.timeLeft) * 8);
    if (reason === "complete") state.score += timeBonus;
    const bonus = activeMission?.bonus || null;
    let bonusAchieved = false;
    if (bonus && reason === "complete") {
      bonusAchieved = bonus.type === "noCrash" ? (state.crashCount || 0) === 0
        : bonus.type === "nearMiss" ? (state.nearMissCount || 0) >= bonus.target
        : bonus.type === "drift" ? (state.driftTotal || 0) >= bonus.target
        : (state.coinCount || 0) >= bonus.target;
    }
    let missionReward = reason === "complete" ? activeMission?.reward || 0 : 0;
    let rivalResult = null;
    if (activeMission?.rival && rivalRace) {
      const playerWon = reason === "complete" && !rivalRace.finished;
      if (!playerWon) missionReward = Math.round(missionReward * 0.25);
      rivalResult = { playerWon };
    }
    stopRivalRace();
    emitHud(true);
    onFinish?.({
      reason,
      score: state.score,
      stars: state.stars,
      deliveries: state.deliveryIndex,
      total: stopIds.length,
      timeBonus,
      reward: missionReward,
      goldEarned: Math.round(state.goldEarned || 0),
      bonus: bonus ? { ...bonus, achieved: bonusAchieved } : null,
      rivalRace: rivalResult
    });
  }

  function arriveAtTarget() {
    if (state.status !== "playing") return;
    const target = currentTarget();
    if (!target) return;
    const finalStop = state.deliveryIndex >= stopIds.length - 1;
    audio.delivery();
    if (!finalStop) {
      // 중간 배송지는 흐름을 끊지 않는다 — 즉시 전달하고 다음 구간 게이트를 세운다.
      state.deliveryIndex += 1;
      state.score += 400;
      state.goldEarned = (state.goldEarned || 0) + 40;
      refreshMarkers();
      const next = currentTarget();
      onMessage?.(`${target.short} 배송 완료! 🪙40 · 다음: ${next?.short || ""}`);
      if (next) spawnGatesForLeg(state.x, state.z, next);
      emitHud(true);
      return;
    }
    state.status = "quiz";
    state.speed = 0;
    pendingQuiz = makeBossQuiz(`마지막 배송 · ${target.short}`, activeMission?.packId || "idiom", gateWanted, activeMission?.mathLevel || 1);
    refreshMarkers();
    onDelivery?.({ ...pendingQuiz, destination: target, package: target.package });
    emitHud(true);
  }

  function answerQuiz(index) {
    if (state.status !== "quiz" || !pendingQuiz) return null;
    const correct = index === pendingQuiz.correctIndex;
    audio.answer(correct);
    onQuizOutcome?.(pendingQuiz.packId, pendingQuiz.quizKey, correct);
    if (correct) {
      state.score += 600;
      state.goldEarned = (state.goldEarned || 0) + 80;
      state.stars += 1;
    } else {
      state.score = Math.max(0, state.score - 100);
    }
    const result = { correct, correctIndex: pendingQuiz.correctIndex, meaning: pendingQuiz.meaning };
    state.deliveryIndex += 1;
    pendingQuiz = null;
    window.setTimeout(() => {
      if (!disposed) finishMission("complete");
    }, 900);
    return result;
  }

  function updateDriving(dt) {
    if (state.status !== "playing") return;
    const vehicle = style.vehicle || { speed: 0, topSpeed: 200, accel: 0, handling: 0 };
    const upgrades = style.upgrades || { speed: 0, handling: 0 };
    const maxForward = (vehicle.topSpeed || 200) / WORLD_SPEED_TO_KMH;
    const accelerationBonus = style.wheel.speed * 0.34 + vehicle.speed * 0.34 + upgrades.speed * 0.9;
    const accelBonus = style.wheel.accel * 1.1 + vehicle.accel * 0.72;
    const handlingBonus = style.wheel.handling * 0.13 + vehicle.handling * 0.08 + upgrades.handling * 0.07;
    const maxReverse = -9;
    const boosting = input.boost && state.boost > 1 && state.speed > 2;

    state.throttleAmount = damp(state.throttleAmount, input.accel ? 1 : 0, input.accel ? 6.2 : 3.8, dt);
    state.brakeAmount = damp(state.brakeAmount, input.brake ? 1 : 0, input.brake ? 8.5 : 5.2, dt);

    if (state.throttleAmount > 0.01 && state.speed < maxForward) {
      // 감쇠 바닥 0.34: 최고속 근처에서도 가속이 죽지 않아 0→최고속이 10~12초에 끝난다.
      const accelerationFade = clamp(1.12 - Math.max(0, state.speed) / Math.max(1, maxForward) * 0.78, 0.34, 1.12);
      const gearDip = (state.gearShiftTimer || 0) > 0 ? DRIVE_TUNING.gearShiftDip : 1;
      state.speed = Math.min(maxForward, state.speed + (8.8 + accelerationBonus + accelBonus) * state.throttleAmount * accelerationFade * gearDip * dt);
    } else if (state.throttleAmount <= 0.01) {
      const rollingDrag = 0.8 + Math.abs(state.speed) * 0.11;
      state.speed = damp(state.speed, 0, rollingDrag, dt);
    }

    if (state.brakeAmount > 0.01 && !state.drifting) {
      if (state.speed > 0.35) state.speed -= (17 + Math.abs(state.speed) * 0.24) * state.brakeAmount * dt;
      else state.speed -= 6.7 * state.brakeAmount * dt;
    }

    // 터보 오버드라이브: 최고속도의 벽을 15% 뚫는다. 해제하면 자연 감속으로 복귀.
    const overdriveMax = maxForward * DRIVE_TUNING.overdriveRatio;
    if (boosting) {
      state.speed += DRIVE_TUNING.boostAccel * dt;
      state.boost = Math.max(0, state.boost - DRIVE_TUNING.boostDrain * dt);
      // 잔량 25% 미만까지 쥐어짜면 과열 — 회복이 잠시 멈춘다.
      if (state.boost < DRIVE_TUNING.overheatThreshold) state.boostCooldown = DRIVE_TUNING.overheatDelay;
      if (!state.wasBoosting) state.fovPunch = DRIVE_TUNING.fovPunch;
    } else {
      state.boostCooldown = Math.max(0, (state.boostCooldown || 0) - dt);
      if (state.boostCooldown <= 0) state.boost = Math.min(100, state.boost + DRIVE_TUNING.boostRegen * dt);
      if (state.speed > maxForward) state.speed = Math.max(maxForward, state.speed - DRIVE_TUNING.overdriveDecay * dt);
    }
    state.wasBoosting = boosting;
    state.fovPunch = Math.max(0, (state.fovPunch || 0) - DRIVE_TUNING.fovPunchDecay * dt);
    state.speed = clamp(state.speed, maxReverse, boosting ? overdriveMax : Math.max(maxForward, state.speed));
    if (Math.abs(state.speed) < 0.08) state.speed = 0;

    // 가상 4단 기어: 속도 구간을 4분할해 RPM이 계단식으로 차오른다.
    const gearProgress = clamp(Math.max(0, state.speed) / maxForward, 0, 1) * DRIVE_TUNING.gearCount;
    const gearIndex = Math.min(DRIVE_TUNING.gearCount - 1, Math.floor(gearProgress));
    if (gearIndex > (state.gear ?? 0)) {
      state.gearShiftTimer = DRIVE_TUNING.gearShiftTime;
      audio.gearShift(gearIndex);
    }
    state.gear = gearIndex;
    state.gearShiftTimer = Math.max(0, (state.gearShiftTimer || 0) - dt);
    const engineRpm = clamp(gearProgress - gearIndex, 0, 1);
    audio.setEngine(engineRpm, gearIndex, boosting, clamp(Math.abs(state.speed) / maxForward, 0, 1.2));

    const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    state.steerAmount = damp(state.steerAmount, steerTarget, steerTarget === 0 ? 5.6 : 8.4, dt);
    const direction = state.speed >= 0 ? 1 : -1;

    // 드리프트: 고속에서 조향 중 브레이크를 잡으면 뒤가 흐른다.
    // 브레이크는 감속 대신 드리프트 트리거가 되고, 성공 유지 시 점수·터보를 돌려준다.
    const currentRatio = clamp(Math.abs(state.speed) / maxForward, 0, 1.2);
    if (!state.drifting && input.brake && Math.abs(state.steerAmount) > 0.55 && currentRatio > DRIVE_TUNING.driftMinRatio && state.speed > 0) {
      state.drifting = true;
      state.driftTime = 0;
      state.driftScore = 0;
      audio.drift();
    }
    if (state.drifting) {
      state.driftTime += dt;
      state.speed = Math.max(0, state.speed - 3.2 * dt);
      const tick = Math.floor(state.driftTime / 0.5);
      if (tick > (state.driftTick || 0)) {
        state.driftTick = tick;
        state.driftScore += DRIVE_TUNING.driftScorePerTick;
        state.score += DRIVE_TUNING.driftScorePerTick;
      }
      if (Math.abs(state.steerAmount) < 0.25 || currentRatio < 0.34) {
        state.drifting = false;
        state.driftTick = 0;
        state.driftTotal = (state.driftTotal || 0) + state.driftTime;
        if (state.driftTime > 0.6) {
          state.boost = Math.min(100, state.boost + DRIVE_TUNING.driftBoostReward);
          onMessage?.(`DRIFT +${state.driftScore} · 터보 +${DRIVE_TUNING.driftBoostReward}`);
        }
      }
    }
    const targetSlip = state.drifting ? Math.sign(state.steerAmount) * DRIVE_TUNING.driftSlipAngle : 0;
    state.slipAngle = damp(state.slipAngle || 0, targetSlip, state.drifting ? 6.5 : 9.5, dt);

    const speedGrip = clamp(1.14 - Math.abs(state.speed) / Math.max(1, maxForward) * 0.58, 0.46, 1.08);
    const steeringAuthority = clamp(Math.abs(state.speed) / 6, 0.14, 1);
    const driftBonus = state.drifting ? DRIVE_TUNING.driftYawBonus : 1;
    const targetYawRate = state.steerAmount * direction * (1.38 + handlingBonus) * speedGrip * steeringAuthority * driftBonus;
    state.yawRate = damp(state.yawRate, targetYawRate, 8.8, dt);
    state.heading = normalizeAngle(state.heading + state.yawRate * dt);

    const nextX = state.x + Math.sin(state.heading) * state.speed * dt;
    const nextZ = state.z + Math.cos(state.heading) * state.speed * dt;
    if (Math.abs(nextX) < WORLD_HALF && Math.abs(nextZ) < WORLD_HALF) {
      state.distance += Math.abs(state.speed) * dt;
      state.x = nextX;
      state.z = nextZ;
      const roadHit = closestRoadPoint(state.x, state.z);
      const safeRoadRadius = roadHit ? roadHit.road.width / 2 + 0.9 : 0;
      const offroadDistance = roadHit ? Math.max(0, roadHit.distance - safeRoadRadius) : 0;
      if (roadHit && offroadDistance > 0 && !state.airborne) {
        const recovery = roadRecoveryPose(state.x, state.z, state.heading);
        if (recovery) {
          const pullStrength = clamp(1.25 + offroadDistance * 0.34, 1.25, 6.5);
          const positionRecovery = 1 - Math.exp(-pullStrength * dt);
          const headingRecovery = 1 - Math.exp(-(Math.abs(state.steerAmount) > 0.2 ? 0.35 : 0.82) * dt);
          state.x = lerp(state.x, recovery.x, positionRecovery);
          state.z = lerp(state.z, recovery.z, positionRecovery);
          state.heading = normalizeAngle(state.heading + normalizeAngle(recovery.heading - state.heading) * headingRecovery);
        }
        const offroadSpeed = state.speed >= 0 ? Math.min(state.speed, 10) : Math.max(state.speed, -5);
        state.speed = damp(state.speed, offroadSpeed, 3.8 + offroadDistance * 0.24, dt);
        if (messageCooldown <= 0) {
          onMessage?.("도로 밖입니다! 조향하면 차선으로 부드럽게 복귀합니다");
          messageCooldown = 1.8;
        }
      }
    } else {
      const recovery = roadRecoveryPose(state.x, state.z, state.heading);
      if (recovery) {
        const positionRecovery = 1 - Math.exp(-6.5 * dt);
        const headingRecovery = 1 - Math.exp(-2.8 * dt);
        state.x = lerp(state.x, recovery.x, positionRecovery);
        state.z = lerp(state.z, recovery.z, positionRecovery);
        state.heading = normalizeAngle(state.heading + normalizeAngle(recovery.heading - state.heading) * headingRecovery);
      }
      state.speed = damp(state.speed, 0, 9, dt);
      state.yawRate *= 0.35;
      if (messageCooldown <= 0) {
        audio.bump();
        onMessage?.("월드 경계입니다. 가까운 도로로 복귀합니다");
        messageCooldown = 1.2;
      }
    }

    // 점프 램프: 발사대에 충분한 속도로 진입하면 에어본 상태로 전환.
    state.rampCooldown = Math.max(0, (state.rampCooldown || 0) - dt);
    if (!state.airborne && state.rampCooldown <= 0) {
      for (const ramp of JUMP_RAMPS) {
        if (Math.hypot(state.x - ramp.x, state.z - ramp.z) > 4.5) continue;
        const facing = Math.sin(state.heading) * Math.sin(ramp.heading) + Math.cos(state.heading) * Math.cos(ramp.heading);
        if (facing < 0.55) continue;
        state.rampCooldown = 2.5;
        if (state.speed < ramp.minKmh / WORLD_SPEED_TO_KMH) {
          onMessage?.(`너무 느려요! ${ramp.minKmh}km/h 이상으로 진입하세요`);
          break;
        }
        state.airborne = true;
        state.vy = state.speed * 0.27;
        state.airHeight = carGroundHeight + 1.9;
        audio.gearShift(4);
        onMessage?.("점프!! 🚀");
        break;
      }
    }

    const speedRatio = clamp(Math.abs(state.speed) / maxForward, 0, 1);
    const targetGroundHeight = drivingSurfaceHeightAt(state.x, state.z);
    if (state.airborne) {
      state.vy -= 24 * dt;
      state.airHeight += state.vy * dt;
      if (state.vy < 0 && state.airHeight <= targetGroundHeight) {
        state.airborne = false;
        carGroundHeight = targetGroundHeight;
        state.crashShake = 0.16;
        const landedRoad = closestRoadPoint(state.x, state.z);
        if (landedRoad?.road?.skyway && landedRoad.distance < landedRoad.road.width / 2 + 1) {
          state.score += 500;
          state.goldEarned = (state.goldEarned || 0) + 60;
          audio.nearMiss();
          onMessage?.("스카이웨이 점프 성공! +500 · 🪙60");
        } else {
          onMessage?.("착지!");
        }
      } else {
        carGroundHeight = state.airHeight;
      }
    } else {
      carGroundHeight = damp(carGroundHeight, targetGroundHeight, 17, dt);
    }
    car.group.position.set(state.x, carGroundHeight + carGroundOffset(car), state.z);
    // 슬립각: 드리프트 중 차체가 진행 방향보다 더 돌아가 옆으로 흐르는 그림을 만든다.
    car.group.rotation.y += normalizeAngle(state.heading + (state.slipAngle || 0) - car.group.rotation.y) * (1 - Math.exp(-10.5 * dt));
    const forwardX = Math.sin(state.heading);
    const forwardZ = Math.cos(state.heading);
    const slopeSampleDistance = 3.4;
    const frontHeight = drivingSurfaceHeightAt(state.x + forwardX * slopeSampleDistance, state.z + forwardZ * slopeSampleDistance);
    const rearHeight = drivingSurfaceHeightAt(state.x - forwardX * slopeSampleDistance, state.z - forwardZ * slopeSampleDistance);
    // 공중에서는 수직 속도에 따라 기수를 들었다 내렸다 한다.
    const targetRoadPitch = state.airborne
      ? clamp(-state.vy * 0.045, -0.34, 0.38)
      : clamp(-Math.atan2(frontHeight - rearHeight, slopeSampleDistance * 2), -0.2, 0.2);
    carRoadPitch = damp(carRoadPitch, targetRoadPitch, 5.5, dt);
    const driveLean = state.brakeAmount > 0.2 ? 0.038 : state.throttleAmount > 0.15 ? -0.02 : 0;
    car.group.rotation.z = damp(car.group.rotation.z, -state.steerAmount * speedRatio * 0.055, 7.2, dt);
    car.group.rotation.x = damp(car.group.rotation.x, carRoadPitch + driveLean, 6.5, dt);
    for (const wheel of car.wheels) {
      const radius = Math.max(0.1, wheel.userData.radius || 0.62);
      wheel.rotation.x += state.speed * dt / radius;
    }
    if (state.drifting) {
      const rearX = state.x - Math.sin(car.group.rotation.y) * 2.0;
      const rearZ = state.z - Math.cos(car.group.rotation.y) * 2.0;
      driftSmoke.emit(rearX, carGroundHeight + 0.55, rearZ, dt);
    }
    state.flameTime = (state.flameTime || 0) + dt;
    for (const flame of car.flames || []) {
      flame.visible = boosting;
      if (boosting) {
        const flicker = 1 + Math.sin(state.flameTime * 42 + flame.position.x * 9) * 0.28;
        flame.scale.set(flicker, 0.8 + flicker * 0.45, flicker);
      }
    }

    // 교통 상호작용: 스치면 NEAR MISS 보너스, 박으면 감속 페널티.
    state.collisionCooldown = Math.max(0, (state.collisionCooldown || 0) - dt);
    state.comboTimer = Math.max(0, (state.comboTimer || 0) - dt);
    if (state.comboTimer <= 0) state.nearCombo = 0;
    for (const other of scene.userData.cityTraffic || []) {
      const gap = Math.hypot(other.group.position.x - state.x, other.group.position.z - state.z);
      other.nearMissTimer = Math.max(0, (other.nearMissTimer || 0) - dt);
      if (gap < DRIVE_TUNING.collisionRadius) {
        if (state.collisionCooldown <= 0) {
          state.collisionCooldown = 1.4;
          state.speed *= 0.45;
          state.crashShake = 0.3;
          state.crashCount = (state.crashCount || 0) + 1;
          audio.crash();
          onMessage?.("쿵! 교통 차량과 충돌");
        }
      } else if (
        gap < DRIVE_TUNING.nearMissRadius && other.nearMissTimer <= 0 &&
        state.collisionCooldown <= 0 && Math.abs(state.speed) / maxForward > 0.5
      ) {
        other.nearMissTimer = 1.5;
        state.nearMissCount = (state.nearMissCount || 0) + 1;
        state.nearCombo = Math.min((state.nearCombo || 0) + 1, 3);
        state.comboTimer = DRIVE_TUNING.comboWindow;
        const multiplier = [1, 1, 1.5, 2][state.nearCombo];
        const reward = Math.round(DRIVE_TUNING.nearMissScore * multiplier);
        state.score += reward;
        state.boost = Math.min(100, state.boost + DRIVE_TUNING.nearMissBoost);
        audio.nearMiss();
        onMessage?.(`NEAR MISS +${reward}${multiplier > 1 ? ` ×${multiplier}` : ""}`);
      }
    }
    state.crashShake = Math.max(0, (state.crashShake || 0) - dt * 0.9);

    for (const coin of coins) {
      if (coin.collected) continue;
      if (Math.hypot(state.x - coin.x, state.z - coin.z) < 2.3) {
        coin.collected = true;
        coin.mesh.visible = false;
        state.score += 80;
        state.stars += 1;
        state.coinCount = (state.coinCount || 0) + 1;
        audio.coin();
        onMessage?.("별 토큰 +80");
      }
    }

    updateLearningGates(dt);

    const target = currentTarget();
    if (target) {
      const distance = Math.hypot(state.x - target.x, state.z - target.z);
      if (distance < DELIVERY_RADIUS) arriveAtTarget();
    }

    state.timeLeft -= dt;
    state.score += Math.max(0, state.speed) * dt * 0.4;
    if (state.timeLeft <= 0) finishMission("timeout");
  }

  function updateWorld(dt, elapsed) {
    if (state.status !== "playing") audio.stopEngine();
    driftSmoke.update(dt);
    if (scene.userData.cloudLayer) scene.userData.cloudLayer.position.x = Math.sin(elapsed * 0.011) * 40;
    updateRivalRace(dt);
    messageCooldown = Math.max(0, messageCooldown - dt);
    hudAccumulator += dt;
    applyTimeOfDay(dt);
    updateCityTraffic(scene, dt);
    for (const coin of coins) {
      if (coin.collected) continue;
      coin.mesh.rotation.y += dt * 2.4;
      coin.mesh.position.y = drivingSurfaceHeightAt(coin.x, coin.z) + 1.55 + Math.sin(elapsed * 2.6 + coin.phase) * 0.25;
    }
    for (const marker of destinationMarkers.values()) {
      marker.userData.ring.rotation.z += dt * 0.45;
      marker.userData.parcel.rotation.y += dt * 1.3;
      marker.userData.parcel.position.y = 3 + Math.sin(elapsed * 2.4) * 0.35;
      marker.userData.beam.material.opacity = 0.08 + Math.sin(elapsed * 2) * 0.025;
    }
  }

  function resolveCameraObstruction() {
    cameraRayDirection.subVectors(cameraDesired, cameraAim);
    const desiredDistance = cameraRayDirection.length();
    cameraRayDirection.normalize();
    cameraRaycaster.set(cameraAim, cameraRayDirection);
    cameraRaycaster.near = 1.8;
    cameraRaycaster.far = desiredDistance;
    const obstruction = cameraRaycaster.intersectObjects(scene.userData.cameraObstacles || [], true)[0];
    if (obstruction) {
      const safeDistance = Math.max(4.8, obstruction.distance - 1.8);
      cameraDesired.copy(cameraAim).addScaledVector(cameraRayDirection, safeDistance);
    }
    return obstruction;
  }

  function updateCamera(dt, elapsed) {

    if (state.status === "garage") {
      const groundY = carGroundHeight;
      const horizontalDistance = 14.5;
      const previewAngle = Math.PI * 0.82 + cameraOrbitYaw;
      cameraAim.set(state.x, groundY + 1.35, state.z + 0.45);
      cameraDesired.set(
        state.x + Math.sin(previewAngle) * horizontalDistance,
        groundY + cameraOrbitHeight,
        state.z + Math.cos(previewAngle) * horizontalDistance
      );
      const obstruction = resolveCameraObstruction();
      camera.position.lerp(cameraDesired, 1 - Math.exp(-(obstruction ? 18 : 9) * dt));
      cameraLookAt.lerp(cameraAim, 1 - Math.exp(-9 * dt));
      camera.lookAt(cameraLookAt);
      camera.fov = damp(camera.fov, 47, 4.8, dt);
      camera.updateProjectionMatrix();
      return;
    }
    const speedRatio = clamp(Math.abs(state.speed) / 60, 0, 1);
    const boosting = input.boost && state.boost > 1 && state.speed > 2;
    const groundY = carGroundHeight;
    const chaseDistance = 10.1 - speedRatio * 0.6 + (boosting ? 1.2 : 0);
    const chaseAngle = state.heading + Math.PI + cameraOrbitYaw;
    const lookAhead = 6.2 + speedRatio * 12.5;
    const aimX = state.x + Math.sin(state.heading) * lookAhead;
    const aimZ = state.z + Math.cos(state.heading) * lookAhead;
    // 고속·터보에서 미세 셰이크 — 속도의 긴장을 손끝이 아니라 화면이 전달한다.
    const shakeStrength = (speedRatio > 0.75 ? (speedRatio - 0.75) * 0.12 : 0) + (boosting ? 0.05 : 0) + (state.crashShake || 0);
    const shakeX = Math.sin(elapsed * 37.3) * shakeStrength;
    const shakeY = Math.cos(elapsed * 43.7) * shakeStrength * 0.7;
    cameraDesired.set(
      state.x + Math.sin(chaseAngle) * chaseDistance + shakeX,
      groundY + cameraOrbitHeight + speedRatio * 0.18 + shakeY,
      state.z + Math.cos(chaseAngle) * chaseDistance
    );
    cameraAim.set(aimX, drivingSurfaceHeightAt(aimX, aimZ) + 1.42, aimZ);
    const obstruction = resolveCameraObstruction();
    camera.position.lerp(cameraDesired, 1 - Math.exp(-(obstruction ? 18 : 6.8 - speedRatio * 2.1) * dt));
    cameraLookAt.lerp(cameraAim, 1 - Math.exp(-(8.2 + speedRatio * 2.4) * dt));
    camera.lookAt(cameraLookAt);
    // 오버스피드(터보로 최고속 초과) 구간은 FOV 상한을 74까지 열어 준다.
    const vehicleMax = (style.vehicle?.topSpeed || 200) / WORLD_SPEED_TO_KMH;
    const overRatio = clamp((Math.abs(state.speed) / vehicleMax - 1) / (DRIVE_TUNING.overdriveRatio - 1), 0, 1);
    camera.fov = damp(camera.fov, 50 + speedRatio * 20 + overRatio * 4 + (state.fovPunch || 0), 5.8, dt);
    camera.updateProjectionMatrix();
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
    clock.update();
    const dt = Math.min(0.033, clock.getDelta());
    const elapsed = clock.getElapsed();
    updateDriving(dt);
    updateWorld(dt, elapsed);
    updateCamera(dt, elapsed);
    emitHud();
    renderer.render(scene, camera);
    animationId = requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize);
  resize();
  emitHud(true);
  animationId = requestAnimationFrame(loop);

  return {
    startMission,
    answerQuiz,
    setStyle: applyStyle,
    setMuted(value) {
      audio.setMuted(value);
    },
    setInput(patch) {
      Object.assign(input, patch);
    },
    resetCamera() {
      cameraOrbitYaw = 0;
      cameraOrbitHeight = 4.45;
      cameraDragPointerId = null;
      renderer.domElement.classList.remove("camera-dragging");
    },
    returnToGarage() {
      state.status = "garage";
      clearLearningGates();
      stopRivalRace();
      pendingQuiz = null;
      state.speed = 0;
      state.x = citySpawn.x;
      state.z = citySpawn.z;
      state.heading = 0;
      state.steerAmount = 0;
      state.throttleAmount = 0;
      state.brakeAmount = 0;
      state.yawRate = 0;
      cameraOrbitYaw = 0;
      cameraOrbitHeight = 4.45;
      carGroundHeight = drivingSurfaceHeightAt(citySpawn.x, citySpawn.z);
      carRoadPitch = 0;
      applyMissionMood("morning");
      car.group.position.set(citySpawn.x, carGroundHeight + carGroundOffset(car), citySpawn.z);
      car.group.rotation.set(0, 0, 0);
      refreshMarkers();
      emitHud(true);
    },
    destroy() {
      disposed = true;
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointerdown", beginCameraDrag);
      renderer.domElement.removeEventListener("pointermove", moveCameraDrag);
      renderer.domElement.removeEventListener("pointerup", endCameraDrag);
      renderer.domElement.removeEventListener("pointercancel", endCameraDrag);
      clock.dispose();
      audio.dispose();
      scene.traverse((object) => {
        object.geometry?.dispose?.();
        const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
        for (const material of materials) {
          material.map?.dispose?.();
          material.dispose?.();
        }
        object.userData?.texture?.dispose?.();
      });
      scene.background?.dispose?.();
      renderer.dispose();
      mount.replaceChildren();
    }
  };
}
