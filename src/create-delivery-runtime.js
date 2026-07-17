import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { CITY_HALF, CITY_NODES, CITY_RIVER_PATH, CITY_ROADS, CITY_SCENERY_HALF, CITY_SKYLINE_MAX_RADIUS, CITY_SKYLINE_MIN_RADIUS, CITY_TRAFFIC_LOOPS, DESTINATION_NODES, closestRoadPoint, distanceToRiver, isPointOnCityRoad, pathLength, roadBaseHeightAt, terrainHeightAt } from "./city-map.js";
import { buildCityBuildingPlans, buildCityLandmarkClearings } from "./city-layout.js";
import { DESTINATIONS } from "./game-data.js";
import { idiomQuizData } from "./idiom-quiz-data.js";

const WORLD_HALF = CITY_HALF;
const DELIVERY_RADIUS = 12;
export const WORLD_SPEED_TO_KMH = 5;

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
    emissiveIntensity: options.emissiveIntensity ?? 0
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
  context.font = "900 55px Arial, sans-serif";
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
  context.strokeStyle = "rgba(24,32,38,.16)";
  context.lineWidth = 1;
  for (let index = 0; index < 7; index += 1) {
    context.beginPath();
    context.moveTo(seeded(index + 9000, 1) * 256, seeded(index + 9000, 2) * 256);
    context.quadraticCurveTo(seeded(index + 9000, 3) * 256, seeded(index + 9000, 4) * 256, seeded(index + 9000, 5) * 256, seeded(index + 9000, 6) * 256);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.4, 1.4);
  texture.anisotropy = 4;
  return texture;
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
  const skylineColors = [0x3e6171, 0x4c7282, 0x5b7d8b, 0x647985, 0x476a7c];
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

function createRoadDeckMesh(road, width, material, { lift = 0.2, thickness = 0.5, startInset = 0, endInset = 0 } = {}) {
  const positions = [];
  const indices = [];
  const uvs = [];
  const roadSamples = roadSamplesBetween(road, startInset, endInset);
  let textureDistance = 0;
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
  mesh.castShadow = road.bridge;
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
  const shoulderMaterial = makeMaterial(0x50575d, { roughness: 0.98 });
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
    const shoulderWidth = road.width + (road.bridge ? 3.2 : 2.5);
    const circleJoinInset = (junction, radius, halfRoadWidth) => {
      if (!junction) return 0;
      return Math.max(0, Math.sqrt(Math.max(0, radius * radius - halfRoadWidth * halfRoadWidth)) - 0.55);
    };
    const shoulderStartInset = circleJoinInset(startJunction, startJunction?.shoulderRadius || 0, shoulderWidth / 2);
    const shoulderEndInset = circleJoinInset(endJunction, endJunction?.shoulderRadius || 0, shoulderWidth / 2);
    const surfaceStartInset = circleJoinInset(startJunction, startJunction?.surfaceRadius || 0, road.width / 2);
    const surfaceEndInset = circleJoinInset(endJunction, endJunction?.surfaceRadius || 0, road.width / 2);
    scene.add(createRoadDeckMesh(road, shoulderWidth, shoulderMaterial, {
      lift: 0.2, thickness: road.bridge ? 1.05 : 0.5, startInset: shoulderStartInset, endInset: shoulderEndInset
    }));
    scene.add(createRoadDeckMesh(road, road.width, road.bridge ? bridgeAsphaltMaterial : asphaltMaterial, {
      lift: 0.34, thickness: road.bridge ? 0.88 : 0.42, startInset: surfaceStartInset, endInset: surfaceEndInset
    }));
    const edgeOffset = Math.max(2.1, road.width / 2 - 0.62);
    scene.add(createRoadMarkingMesh(road, [-edgeOffset, edgeOffset], 0.18, edgeLineMaterial, {
      startInset: startJunction ? startJunction.surfaceRadius + 1.2 : 0,
      endInset: endJunction ? endJunction.surfaceRadius + 1.2 : 0
    }));
    if (road.type !== "local") {
      scene.add(createRoadMarkingMesh(road, [-0.2, 0.2], 0.12, centerLineMaterial, {
        startInset: startJunction ? startJunction.surfaceRadius + 1.2 : 0,
        endInset: endJunction ? endJunction.surfaceRadius + 1.2 : 0
      }));
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
      if (road.bridge) {
        for (const side of [-1, 1]) {
          const railX = (start.x + end.x) / 2 + nx * side * (road.width / 2 + 1.25);
          const railZ = (start.z + end.z) / 2 + nz * side * (road.width / 2 + 1.25);
          bridgeRailSpecs.push({ x: railX, y: roadSurfaceHeight(road, segmentIndex + 0.5, 1.08), z: railZ, width: 0.38, height: 1.45, depth: length + 0.4, rotation: angle });
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

  const junctionGeometry = new THREE.CylinderGeometry(1, 1, 1, 36);
  createBoxInstances(scene, junctionShoulderSpecs, shoulderMaterial, { geometry: junctionGeometry, castShadow: false });
  createBoxInstances(scene, junctionSurfaceSpecs, asphaltMaterial, { geometry: junctionGeometry, castShadow: false });
  createBoxInstances(scene, markerSpecs, makeMaterial(0xf6f7f8, { emissive: 0xffffff, emissiveIntensity: 0.16 }));
  createBoxInstances(scene, localMarkerSpecs, makeMaterial(0xf7fbff, { emissive: 0xffffff, emissiveIntensity: 0.08 }));
  createBoxInstances(scene, bridgeRailSpecs, makeMaterial(0x8b969e, { roughness: 0.42, metalness: 0.58 }), { castShadow: true });
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
    const body = roundedBox(2.05, 0.68, 4.5, makeMaterial(bodyColor, { roughness: 0.32, metalness: 0.42 }), 0.22, 0, 0.72, 0);
    const cabin = roundedBox(1.62, 0.72, 2.08, glassMaterial, 0.2, 0, 1.25, -0.22);
    const bumper = roundedBox(2.12, 0.16, 0.26, chromeMaterial, 0.05, 0, 0.48, -2.15);
    group.add(body, cabin, bumper);
    if (index % 5 === 0) {
      const cargo = roundedBox(1.74, 1.2, 1.6, makeMaterial(index % 10 === 0 ? 0xf4f6f7 : bodyColor, { roughness: 0.48 }), 0.16, 0, 1.43, -0.48);
      group.add(cargo);
    }
    const wheels = [];
    for (const wheelX of [-1.08, 1.08]) {
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
  createRoadNetwork(scene);
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
      const floorCount = residential ? 1 : Math.min(11, Math.max(2, Math.floor(height / 5.2)));
      for (let floor = 0; floor < floorCount; floor += 1) {
        const windowY = residential ? 3.2 : 3.4 + floor * ((height - 4.5) / Math.max(1, floorCount - 1));
        for (const side of [-1, 1]) {
          const local = rotatePoint(side * width * 0.24, depth / 2 + 0.08, rotation);
          windowSpecs.push({ x: x + local.x, y: baseY + windowY, z: z + local.z, width: width * 0.22, height: residential ? 1.65 : 1.8, depth: 0.12, color: windowColor, rotation });
          if (!residential) {
            const back = rotatePoint(side * width * 0.24, -depth / 2 - 0.08, rotation);
            windowSpecs.push({ x: x + back.x, y: baseY + windowY, z: z + back.z, width: width * 0.22, height: 1.8, depth: 0.12, color: seed % 4 ? windowColor : 0x334b5a, rotation });
          }
        }
        if (!residential) {
          for (const side of [-1, 1]) {
            for (const offset of [-0.24, 0.24]) {
              const sideWindow = rotatePoint(side * (width / 2 + 0.08), offset * depth, rotation);
              windowSpecs.push({ x: x + sideWindow.x, y: baseY + windowY, z: z + sideWindow.z, width: 0.12, height: 1.8, depth: depth * 0.22, color: seed % 5 ? windowColor : 0x334b5a, rotation });
            }
          }
        }
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
    trunkSpecs.push({ x, y: baseY + 1.2 * treeScale, z, width: 0.65 * treeScale, height: 2.4 * treeScale, depth: 0.65 * treeScale });
    crownSpecs.push({ x, y: baseY + 3.45 * treeScale, z, width: 2.4 * treeScale, height: 4.5 * treeScale, depth: 2.4 * treeScale, color: index % 2 ? 0x315f43 : 0x416f4e });
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
  createCentralHub(scene);
  createLandmarks(scene);
  createSkyline(scene);
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
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.64, radius * 0.64, width * 1.03, 18), rimMaterial);
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

function resetWheelRigsToProfile(car) {
  for (const wheel of car.wheels) {
    const home = wheel.userData.home;
    if (!home) continue;
    wheel.position.set(home.x, home.y, home.z);
    wheel.scale.setScalar(1);
    wheel.userData.radius = home.radius;
  }
}

function fitWheelRigsToExternalModel(car, modelSize) {
  const profile = car.profile || getVehicleProfile("snowbug");
  const radius = Math.min(profile.wheel * 0.88, modelSize.x * 0.17);
  const axleX = modelSize.x * 0.36;
  const axleZ = modelSize.z * 0.31;
  for (const wheel of car.wheels) {
    const home = wheel.userData.home;
    if (!home) continue;
    wheel.position.set(Math.sign(home.x) * axleX, radius, Math.sign(home.z) * axleZ);
    wheel.scale.setScalar(radius / profile.wheel);
    wheel.userData.radius = radius * profile.scale;
  }
}

function applyExternalVehiclePaint(root, paint) {
  const targetColor = new THREE.Color(paint.body);
  root?.traverse?.((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material?.color) continue;
      if (!material.userData.meshyBaseColor) material.userData.meshyBaseColor = material.color.clone();
      material.color.copy(material.userData.meshyBaseColor).lerp(targetColor, 0.28);
      material.needsUpdate = true;
    }
  });
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
  const bodyMaterial = makeMaterial(initialStyle.paint.body, {
    roughness: 0.2,
    metalness: 0.38,
    emissive: initialStyle.paint.body,
    emissiveIntensity: 0.055
  });
  const accentMaterial = makeMaterial(initialStyle.paint.accent, { roughness: 0.32, metalness: 0.34 });
  const glassMaterial = makeMaterial(0x07131e, { roughness: 0.08, metalness: 0.62, emissive: 0x18374a, emissiveIntensity: 0.16 });
  const wheelMaterial = makeMaterial(0x111418, { roughness: 0.74 });
  const rimMaterial = makeMaterial(initialStyle.wheel.color, { roughness: 0.2, metalness: 0.82 });
  const darkMaterial = makeMaterial(0x111820, { roughness: 0.68, metalness: 0.22 });
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
  car.vehicleKit.add(roofPanel, frontSplitter, rearDiffuser, rearBumper, tailgateBand, trunkLip, leftSkirt, rightSkirt);

  for (const side of [-1, 1]) {
    const headlight = roundedBox(width * 0.25, 0.2, 0.12, car.headlightMaterial, 0.05, side * width * 0.28, bodyBottom + 0.62, length / 2 + 0.05);
    const taillight = roundedBox(width * 0.28, 0.19, 0.12, car.taillightMaterial, 0.05, side * width * 0.27, bodyBottom + 0.68, -length / 2 - 0.03);
    const mirror = roundedBox(0.33, 0.16, 0.42, car.bodyMaterial, 0.08, side * (halfWidth + 0.17), bodyBottom + 1.15, cabinFront - 0.35);
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.44, 14), car.chromeMaterial);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(side * width * 0.27, bodyBottom + 0.13, -length / 2 - 0.22);
    car.vehicleKit.add(headlight, taillight, mirror, exhaust);
  }

  const plate = roundedBox(width * 0.32, 0.3, 0.08, makeMaterial(0xe7edf1, { roughness: 0.55 }), 0.04, 0, bodyBottom + 0.45, -length / 2 - 0.12);
  const rearBadge = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 8, 20), car.chromeMaterial);
  rearBadge.position.set(0, bodyBottom + 0.88, -length / 2 - 0.13);
  rearBadge.rotation.x = Math.PI / 2;
  car.vehicleKit.add(plate, rearBadge);

  const axleX = halfWidth + wheel * 0.28;
  const wheelY = wheel + clearance * 0.5;
  const axleZ = length * 0.31;
  car.wheels = [];
  for (const x of [-axleX, axleX]) {
    for (const z of [-axleZ, axleZ]) {
      const wheelAssembly = createWheelAssembly(wheel, 0.48, car.wheelMaterial, car.rimMaterial, car.accentMaterial);
      wheelAssembly.userData.radius = wheel * profile.scale;
      wheelAssembly.position.set(x, wheelY, z);
      wheelAssembly.userData.home = { x, y: wheelY, z, radius: wheel * profile.scale };
      car.vehicleKit.add(wheelAssembly);
      car.wheels.push(wheelAssembly);
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
  return positions.map(([x, z], index) => {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.19, 9, 22), material.clone());
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
  const classFactor = road.type === "arterial" ? 0.8 : road.type === "collector" ? 0.9 : 1;
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

function makeQuiz(label) {
  const correct = idiomQuizData[Math.floor(Math.random() * idiomQuizData.length)];
  const wrongs = shuffle(idiomQuizData.filter((item) => item.korean !== correct.korean)).slice(0, 3);
  const choices = shuffle([
    { text: correct.meaning, correct: true },
    ...wrongs.map((item) => ({ text: item.meaning, correct: false }))
  ]);
  return {
    label,
    hanja: correct.hanja,
    korean: correct.korean,
    question: "택배 암호! 이 사자성어의 뜻은 무엇일까요?",
    options: choices.map((choice) => choice.text),
    correctIndex: choices.findIndex((choice) => choice.correct),
    meaning: correct.meaning
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
  return {
    unlock,
    setMuted(value) { muted = value; },
    start() { tone(440, 0.1, "square", 0.04); tone(660, 0.14, "square", 0.05, 0.11); },
    coin() { tone(880, 0.08, "sine", 0.05); tone(1320, 0.1, "sine", 0.04, 0.06); },
    bump() { tone(110, 0.12, "sawtooth", 0.04); },
    delivery() { tone(523, 0.12, "sine", 0.05); tone(659, 0.12, "sine", 0.05, 0.1); tone(784, 0.18, "sine", 0.05, 0.2); },
    answer(correct) { tone(correct ? 988 : 180, correct ? 0.2 : 0.25, correct ? "sine" : "square", 0.05); },
    dispose() { context?.close?.(); context = null; }
  };
}

export function createDeliveryRuntime({ mount, initialStyle, onHud, onDelivery, onFinish, onMessage }) {
  let disposed = false;
  let animationId = 0;
  let hudAccumulator = 0;
  let messageCooldown = 0;
  let activeMission = null;
  let stopIds = [];
  let latestRoute = [];
  let style = initialStyle;
  let pendingQuiz = null;
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
  car.group.position.y = carGroundHeight + carGroundOffset(car);
  const vehicleFillLight = new THREE.PointLight(0xd7efff, 10, 18, 2);
  vehicleFillLight.position.set(0, 4.2, -5.4);
  car.group.add(vehicleFillLight);
  const coins = createCoins(scene);
  const clock = new THREE.Timer();
  clock.connect(document);
  const vehicleModelLoader = new GLTFLoader();
  let vehicleAssetRevision = 0;
  let externalVehicleId = null;

  function setProceduralVehicleVisible(visible) {
    for (const child of car.vehicleKit.children) child.visible = visible || car.wheels.includes(child);
    car.topper.visible = visible;
    if (car.decal) car.decal.visible = visible;
  }

  function clearExternalVehicle({ showProcedural = true } = {}) {
    if (car.externalModel) {
      car.group.remove(car.externalModel);
      disposeObjectTree(car.externalModel);
      car.externalModel = null;
    }
    externalVehicleId = null;
    car.externalModelSize = null;
    resetWheelRigsToProfile(car);
    setProceduralVehicleVisible(showProcedural);
  }

  async function loadVehicleAsset(vehicleId) {
    const revision = ++vehicleAssetRevision;
    // 메쉬 모델을 매번 지우면 차고에서 다른 차를 미리볼 때 폴백 차체가 보입니다.
    // 새 GLB가 완전히 준비된 뒤에만 교체해, 항상 Meshy 모델을 유지합니다.
    if (car.externalModel && externalVehicleId === vehicleId) {
      setProceduralVehicleVisible(false);
      applyExternalVehiclePaint(car.externalModel, style.paint);
      return;
    }

    try {
      const response = await fetch("/models/vehicles/manifest.json", { cache: "no-store" });
      if (!response.ok) {
        if (!car.externalModel) setProceduralVehicleVisible(true);
        return;
      }
      const manifest = await response.json();
      const asset = manifest.vehicles?.[vehicleId];
      if (!asset?.url || revision !== vehicleAssetRevision) {
        if (!car.externalModel && revision === vehicleAssetRevision) setProceduralVehicleVisible(true);
        return;
      }
      const gltf = await vehicleModelLoader.loadAsync(asset.url);
      if (revision !== vehicleAssetRevision || disposed) {
        disposeObjectTree(gltf.scene);
        return;
      }

      const container = new THREE.Group();
      const model = gltf.scene;
      model.updateMatrixWorld(true);
      let bounds = new THREE.Box3().setFromObject(model);
      let size = bounds.getSize(new THREE.Vector3());
      if (size.x > size.z) {
        model.rotation.y = Math.PI / 2;
        model.updateMatrixWorld(true);
        bounds = new THREE.Box3().setFromObject(model);
        size = bounds.getSize(new THREE.Vector3());
      }
      const profile = car.profile || getVehicleProfile(vehicleId);
      model.scale.setScalar(profile.length / Math.max(0.1, size.z));
      model.updateMatrixWorld(true);
      bounds = new THREE.Box3().setFromObject(model);
      const fittedSize = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y += 0.04 - bounds.min.y;
      model.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (!material) continue;
          material.envMapIntensity = 1.15;
          material.needsUpdate = true;
        }
      });
      container.name = `meshy-${vehicleId}`;
      container.add(model);

      // 준비 완료된 새 모델로 한 프레임 안에 교체합니다. 기존 메쉬를 먼저 지우지 않습니다.
      if (car.externalModel) clearExternalVehicle({ showProcedural: false });
      car.externalModel = container;
      externalVehicleId = vehicleId;
      car.externalModelSize = fittedSize;
      car.group.add(container);
      setProceduralVehicleVisible(false);
      fitWheelRigsToExternalModel(car, fittedSize);
      applyExternalVehiclePaint(container, style.paint);
      car.group.position.y = carGroundHeight + carGroundOffset(car);
      onMessage?.(`${asset.name || "실차"} 3D 에셋 적용`);
    } catch (error) {
      if (revision === vehicleAssetRevision) {
        if (!car.externalModel) setProceduralVehicleVisible(true);
        console.warn("Vehicle asset fallback:", error.message);
      }
    }
  }

  void loadVehicleAsset(style.vehicle?.id || "snowbug");

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
    if (car.externalModel) {
      setProceduralVehicleVisible(false);
      applyExternalVehiclePaint(car.externalModel, nextStyle.paint);
    }
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
    void loadVehicleAsset(nextStyle.vehicle?.id || "snowbug");
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
    onHud?.({
      ...state,
      speed: Math.round(Math.abs(state.speed) * WORLD_SPEED_TO_KMH),
      speedLimit: style.vehicle?.topSpeed || 200,
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

  function startMission(mission) {
    audio.unlock();
    audio.start();
    activeMission = mission;
    applyMissionMood(mission.id);
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
      yawRate: 0
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
    refreshMarkers();
    onMessage?.("출발! 첫 번째 배송지를 찾아가세요");
    emitHud(true);
  }

  function finishMission(reason = "complete") {
    state.status = "finished";
    state.speed = 0;
    refreshMarkers();
    const timeBonus = Math.round(Math.max(0, state.timeLeft) * 8);
    if (reason === "complete") state.score += timeBonus;
    emitHud(true);
    onFinish?.({
      reason,
      score: state.score,
      stars: state.stars,
      deliveries: state.deliveryIndex,
      total: stopIds.length,
      timeBonus,
      reward: reason === "complete" ? activeMission?.reward || 0 : 0
    });
  }

  function arriveAtTarget() {
    if (state.status !== "playing") return;
    const target = currentTarget();
    if (!target) return;
    state.status = "quiz";
    state.speed = 0;
    audio.delivery();
    pendingQuiz = makeQuiz(`${state.deliveryIndex + 1}번째 배송 · ${target.short}`);
    refreshMarkers();
    onDelivery?.({ ...pendingQuiz, destination: target, package: target.package });
    emitHud(true);
  }

  function answerQuiz(index) {
    if (state.status !== "quiz" || !pendingQuiz) return null;
    const correct = index === pendingQuiz.correctIndex;
    audio.answer(correct);
    if (correct) {
      state.score += 600;
      state.timeLeft += 10;
      state.stars += 1;
    } else {
      state.score = Math.max(0, state.score - 100);
    }
    const result = { correct, correctIndex: pendingQuiz.correctIndex, meaning: pendingQuiz.meaning };
    state.deliveryIndex += 1;
    pendingQuiz = null;
    if (state.deliveryIndex >= stopIds.length) {
      window.setTimeout(() => {
        if (!disposed) finishMission("complete");
      }, 900);
    } else {
      state.status = "playing";
      refreshMarkers();
      onMessage?.(correct ? "정답! +10초 · 다음 배송지로 출발!" : "배송 완료! 다음 목적지를 찾아가세요");
      emitHud(true);
    }
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

    if (state.throttleAmount > 0.01) {
      const accelerationFade = clamp(1.12 - Math.max(0, state.speed) / Math.max(1, maxForward) * 0.86, 0.22, 1.12);
      state.speed += (8.8 + accelerationBonus + accelBonus) * state.throttleAmount * accelerationFade * dt;
    } else {
      const rollingDrag = 0.8 + Math.abs(state.speed) * 0.11;
      state.speed = damp(state.speed, 0, rollingDrag, dt);
    }

    if (state.brakeAmount > 0.01) {
      if (state.speed > 0.35) state.speed -= (17 + Math.abs(state.speed) * 0.24) * state.brakeAmount * dt;
      else state.speed -= 6.7 * state.brakeAmount * dt;
    }

    if (boosting) {
      state.speed += 14.5 * dt;
      state.boost = Math.max(0, state.boost - 30 * dt);
    } else {
      state.boost = Math.min(100, state.boost + 10 * dt);
    }
    // 터보는 차량 고유의 제한 속도를 넘기지 않고, 그 속도까지 더 빠르게 도달하게 합니다.
    state.speed = clamp(state.speed, maxReverse, maxForward);
    if (Math.abs(state.speed) < 0.08) state.speed = 0;

    const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    state.steerAmount = damp(state.steerAmount, steerTarget, steerTarget === 0 ? 5.6 : 8.4, dt);
    const direction = state.speed >= 0 ? 1 : -1;
    const speedGrip = clamp(1.14 - Math.abs(state.speed) / Math.max(1, maxForward) * 0.58, 0.46, 1.08);
    const steeringAuthority = clamp(Math.abs(state.speed) / 6, 0.14, 1);
    const targetYawRate = state.steerAmount * direction * (1.38 + handlingBonus) * speedGrip * steeringAuthority;
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
      if (roadHit && offroadDistance > 0) {
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

    const speedRatio = clamp(Math.abs(state.speed) / maxForward, 0, 1);
    const targetGroundHeight = drivingSurfaceHeightAt(state.x, state.z);
    carGroundHeight = damp(carGroundHeight, targetGroundHeight, 17, dt);
    car.group.position.set(state.x, carGroundHeight + carGroundOffset(car), state.z);
    car.group.rotation.y += normalizeAngle(state.heading - car.group.rotation.y) * (1 - Math.exp(-10.5 * dt));
    const forwardX = Math.sin(state.heading);
    const forwardZ = Math.cos(state.heading);
    const slopeSampleDistance = 3.4;
    const frontHeight = drivingSurfaceHeightAt(state.x + forwardX * slopeSampleDistance, state.z + forwardZ * slopeSampleDistance);
    const rearHeight = drivingSurfaceHeightAt(state.x - forwardX * slopeSampleDistance, state.z - forwardZ * slopeSampleDistance);
    const targetRoadPitch = clamp(-Math.atan2(frontHeight - rearHeight, slopeSampleDistance * 2), -0.2, 0.2);
    carRoadPitch = damp(carRoadPitch, targetRoadPitch, 5.5, dt);
    const driveLean = state.brakeAmount > 0.2 ? 0.038 : state.throttleAmount > 0.15 ? -0.02 : 0;
    car.group.rotation.z = damp(car.group.rotation.z, -state.steerAmount * speedRatio * 0.055, 7.2, dt);
    car.group.rotation.x = damp(car.group.rotation.x, carRoadPitch + driveLean, 6.5, dt);
    for (const wheel of car.wheels) {
      const radius = Math.max(0.1, wheel.userData.radius || 0.62);
      wheel.rotation.x += state.speed * dt / radius;
    }

    for (const coin of coins) {
      if (coin.collected) continue;
      if (Math.hypot(state.x - coin.x, state.z - coin.z) < 2.3) {
        coin.collected = true;
        coin.mesh.visible = false;
        state.score += 80;
        state.stars += 1;
        audio.coin();
        onMessage?.("별 토큰 +80");
      }
    }

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
    const groundY = carGroundHeight;
    const chaseDistance = 10.1 - speedRatio * 0.6;
    const chaseAngle = state.heading + Math.PI + cameraOrbitYaw;
    const lookAhead = 6.2 + speedRatio * 12.5;
    const aimX = state.x + Math.sin(state.heading) * lookAhead;
    const aimZ = state.z + Math.cos(state.heading) * lookAhead;
    cameraDesired.set(
      state.x + Math.sin(chaseAngle) * chaseDistance,
      groundY + cameraOrbitHeight + speedRatio * 0.18,
      state.z + Math.cos(chaseAngle) * chaseDistance
    );
    cameraAim.set(aimX, drivingSurfaceHeightAt(aimX, aimZ) + 1.42, aimZ);
    const obstruction = resolveCameraObstruction();
    camera.position.lerp(cameraDesired, 1 - Math.exp(-(obstruction ? 18 : 6.8 - speedRatio * 2.1) * dt));
    cameraLookAt.lerp(cameraAim, 1 - Math.exp(-(8.2 + speedRatio * 2.4) * dt));
    camera.lookAt(cameraLookAt);
    camera.fov = damp(camera.fov, 50 + speedRatio * 20, 5.8, dt);
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
      vehicleAssetRevision += 1;
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
