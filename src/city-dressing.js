import * as THREE from "three";

// 도시 드레싱: 노면 텍스처, 연석·가로등·가드레일·전신주·현수막·간판, 그리고 주행 중 레이싱 라인/체크포인트.
// 런타임 내부 헬퍼(도로 샘플링, 높이 함수 등)는 ctx 로 주입받아 순환 import 를 피한다.

function hashNoise(x, y, seed) {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

// 다층 아스팔트 텍스처: 굵은 골재·미세 입자·균열·보수 패치. 컬러맵과 범프맵을 같은 씨앗으로 굽는다.
export function makeAsphaltTextures(size = 512) {
  const colorCanvas = document.createElement("canvas");
  const bumpCanvas = document.createElement("canvas");
  colorCanvas.width = colorCanvas.height = size;
  bumpCanvas.width = bumpCanvas.height = size;
  const color = colorCanvas.getContext("2d");
  const bump = bumpCanvas.getContext("2d");
  color.fillStyle = "#3a4046";
  color.fillRect(0, 0, size, size);
  bump.fillStyle = "#9a9a9a";
  bump.fillRect(0, 0, size, size);

  // 보수 패치: 살짝 톤이 다른 사각형 몇 개 — 실제 도로의 얼룩덜룩함
  for (let index = 0; index < 5; index += 1) {
    const x = hashNoise(index, 1, 3) * size;
    const y = hashNoise(index, 2, 3) * size;
    const w = 60 + hashNoise(index, 3, 3) * 160;
    const h = 40 + hashNoise(index, 4, 3) * 120;
    color.fillStyle = index % 2 ? "rgba(52,58,64,0.55)" : "rgba(64,70,76,0.5)";
    color.fillRect(x, y, w, h);
  }
  // 골재 입자
  for (let index = 0; index < 26000; index += 1) {
    const x = Math.floor(hashNoise(index, 5, 7) * size);
    const y = Math.floor(hashNoise(index, 6, 7) * size);
    const tone = 40 + Math.floor(hashNoise(index, 7, 7) * 58);
    const alpha = 0.08 + hashNoise(index, 8, 7) * 0.22;
    const big = hashNoise(index, 9, 7) > 0.93;
    color.fillStyle = `rgba(${tone},${tone + 4},${tone + 8},${alpha})`;
    color.fillRect(x, y, big ? 2 : 1, big ? 2 : 1);
    const height = 120 + Math.floor(hashNoise(index, 10, 7) * 110);
    bump.fillStyle = `rgba(${height},${height},${height},${big ? 0.9 : 0.6})`;
    bump.fillRect(x, y, big ? 2 : 1, big ? 2 : 1);
  }
  // 균열: 지그재그 어두운 선
  color.strokeStyle = "rgba(18,22,26,0.55)";
  bump.strokeStyle = "rgba(40,40,40,0.9)";
  color.lineWidth = 1.2;
  bump.lineWidth = 1.6;
  for (let crack = 0; crack < 7; crack += 1) {
    let x = hashNoise(crack, 11, 9) * size;
    let y = hashNoise(crack, 12, 9) * size;
    color.beginPath();
    bump.beginPath();
    color.moveTo(x, y);
    bump.moveTo(x, y);
    const steps = 8 + Math.floor(hashNoise(crack, 13, 9) * 10);
    const angle = hashNoise(crack, 14, 9) * Math.PI * 2;
    for (let step = 0; step < steps; step += 1) {
      x += Math.cos(angle + (hashNoise(crack, step, 21) - 0.5) * 1.6) * 9;
      y += Math.sin(angle + (hashNoise(crack, step, 22) - 0.5) * 1.6) * 9;
      color.lineTo(x, y);
      bump.lineTo(x, y);
    }
    color.stroke();
    bump.stroke();
  }
  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  for (const texture of [colorMap, bumpMap]) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.anisotropy = 8;
  }
  return { colorMap, bumpMap };
}

// 보도 블록 텍스처: 밝은 회색 판 + 줄눈 격자
export function makePaverTexture(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  context.fillStyle = "#b9bfc3";
  context.fillRect(0, 0, size, size);
  const cell = size / 8;
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const tone = 176 + Math.floor(hashNoise(row, column, 31) * 22);
      context.fillStyle = `rgb(${tone},${tone + 3},${tone + 6})`;
      context.fillRect(column * cell + 1, row * cell + 1, cell - 2, cell - 2);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 3);
  texture.anisotropy = 4;
  return texture;
}

const SHOP_NAMES = ["무무 분식", "컬러 세탁소", "씽씽 마트", "하버 카페", "엔진 정비", "스카이 PC방", "달빛 약국", "마켓 치킨"];

function makeSignTexture(text, accent) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.fillStyle = "#f6f7f8";
  context.fillRect(0, 0, 512, 128);
  context.fillStyle = accent;
  context.fillRect(0, 0, 512, 14);
  context.fillRect(0, 114, 512, 14);
  context.fillStyle = "#1c2b3a";
  context.font = "900 66px 'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 256, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// 상가 간판: 색상 박스 대신 상호가 적힌 텍스처 간판을 8종으로 나눠 인스턴싱한다.
export function createSignboardInstances(scene, signSpecs, ctx) {
  const buckets = SHOP_NAMES.map(() => []);
  signSpecs.forEach((spec, index) => buckets[index % SHOP_NAMES.length].push(spec));
  const accents = ["#ff5d5d", "#2f8fbf", "#38a169", "#ff9f1c", "#8a4fff", "#e04e8a", "#0fb5b5", "#d9a400"];
  buckets.forEach((bucket, index) => {
    if (!bucket.length) return;
    const material = ctx.makeMaterial(0xffffff, { roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0.18 });
    material.map = makeSignTexture(SHOP_NAMES[index], accents[index]);
    material.emissiveMap = material.map;
    ctx.createBoxInstances(scene, bucket.map((spec) => ({ ...spec, height: spec.height * 1.25, color: undefined })), material, { receiveShadow: false });
  });
}

const BANNER_TEXTS = [
  "무무 씽씽택배 · 컬러시티 그랑프리", "웨스트 마켓 봄맞이 축제", "학습 게이트는 정답 차선으로!",
  "하버 프론트 해산물 축제", "이스트 스카이 야경 투어", "센트럴 허브 24시 익스프레스"
];

function makeBannerTexture(text, background) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.fillStyle = background;
  context.fillRect(0, 0, 1024, 128);
  context.strokeStyle = "rgba(255,255,255,.85)";
  context.lineWidth = 6;
  context.strokeRect(10, 10, 1004, 108);
  context.fillStyle = "#ffffff";
  context.font = "900 58px 'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 512, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// 도로 가구: 연석·가로등·가드레일·전신주+전선·현수막. 도로 종류별로 밀도를 달리한다.
export function createRoadFurniture(scene, roads, junctionInfo, ctx) {
  const { smoothRoadSamplesBetween, roadSurfaceHeight, getSmoothRoadData, smoothRoadSampleAt, makeMaterial, createBoxInstances, seeded, terrainHeightAt } = ctx;
  const curbRed = [];
  const curbWhite = [];
  const lampPosts = [];
  const lampArms = [];
  const lampHeads = [];
  const railPosts = [];
  const railBeams = [];
  const utilityPoles = [];
  const crossarms = [];
  const wirePositions = [];
  let bannerIndex = 0;

  const segmentSpec = (start, finish, road, offset, lift, width, height) => {
    const midX = (start.point.x + finish.point.x) / 2;
    const midZ = (start.point.z + finish.point.z) / 2;
    const dx = finish.point.x - start.point.x;
    const dz = finish.point.z - start.point.z;
    const length = Math.hypot(dx, dz) || 1;
    const nx = -dz / length;
    const nz = dx / length;
    return {
      x: midX + nx * offset, z: midZ + nz * offset,
      y: roadSurfaceHeight(road, (start.pathPosition + finish.pathPosition) / 2, lift),
      width, height, depth: length + 0.06, rotation: Math.atan2(dx, dz)
    };
  };

  for (const road of roads) {
    const elevated = road.bridge || road.skyway;
    const startInset = (junctionInfo.get(road.a)?.shoulderDepth || 0) + 1.2;
    const endInset = (junctionInfo.get(road.b)?.shoulderDepth || 0) + 1.2;
    const data = getSmoothRoadData(road);
    if (data.length < startInset + endInset + 6) continue;

    // 적백 연석 — 간선·집산 도로의 아스팔트 가장자리
    if (!elevated && (road.type === "arterial" || road.type === "collector")) {
      const samples = smoothRoadSamplesBetween(road, startInset, endInset, 2.4);
      for (let index = 0; index < samples.length - 1; index += 1) {
        for (const side of [-1, 1]) {
          const spec = segmentSpec(samples[index], samples[index + 1], road, side * (road.width / 2 + 0.2), 0.47, 0.32, 0.2);
          (index % 2 === 0 ? curbRed : curbWhite).push(spec);
        }
      }
    }

    // 가드레일 — 해안 도로와 스카이웨이 진입부: 기둥 + W빔
    if (road.type === "scenic") {
      const samples = smoothRoadSamplesBetween(road, startInset, endInset, 2.6);
      for (let index = 0; index < samples.length - 1; index += 1) {
        for (const side of [-1, 1]) {
          const beam = segmentSpec(samples[index], samples[index + 1], road, side * (road.width / 2 + 1.0), 0.95, 0.07, 0.32);
          railBeams.push(beam);
          const post = samples[index];
          const nx = -post.tangent.z;
          const nz = post.tangent.x;
          railPosts.push({
            x: post.point.x + nx * side * (road.width / 2 + 1.0), z: post.point.z + nz * side * (road.width / 2 + 1.0),
            y: roadSurfaceHeight(road, post.pathPosition, 0.62), width: 0.12, height: 0.72, depth: 0.12, rotation: Math.atan2(post.tangent.x, post.tangent.z)
          });
        }
      }
    }

    // 가로등 — 간선 26m, 집산 34m 간격으로 좌우 교대
    if (!elevated && road.type !== "alley" && road.type !== "local") {
      const spacing = road.type === "arterial" ? 26 : 34;
      let sideToggle = 1;
      for (let distance = startInset + 6; distance < data.length - endInset - 4; distance += spacing) {
        const sample = smoothRoadSampleAt(road, distance);
        const nx = -sample.tangent.z;
        const nz = sample.tangent.x;
        const side = sideToggle;
        sideToggle *= -1;
        const baseOffset = road.width / 2 + 2.55;
        const baseY = roadSurfaceHeight(road, sample.pathPosition, 0.5);
        const rotation = Math.atan2(sample.tangent.x, sample.tangent.z);
        const px = sample.point.x + nx * side * baseOffset;
        const pz = sample.point.z + nz * side * baseOffset;
        lampPosts.push({ x: px, y: baseY + 3.7, z: pz, width: 0.2, height: 7.4, depth: 0.2, rotation });
        lampArms.push({ x: px - nx * side * 1.05, y: baseY + 7.25, z: pz - nz * side * 1.05, width: 2.2, height: 0.12, depth: 0.14, rotation: rotation + Math.PI / 2 });
        lampHeads.push({ x: px - nx * side * 2.0, y: baseY + 7.12, z: pz - nz * side * 2.0, width: 0.5, height: 0.16, depth: 0.95, rotation: rotation + Math.PI / 2 });
      }
    }

    // 전신주 + 전선 — 집산·주택가 도로 한쪽에 30m 간격
    if (!elevated && (road.type === "collector" || road.type === "local")) {
      const side = seeded(road.path[0].x + road.path[0].z, 5) > 0.5 ? 1 : -1;
      let previousTop = null;
      for (let distance = startInset + 4; distance < data.length - endInset - 2; distance += 30) {
        const sample = smoothRoadSampleAt(road, distance);
        const nx = -sample.tangent.z;
        const nz = sample.tangent.x;
        const offset = road.width / 2 + 3.4;
        const px = sample.point.x + nx * side * offset;
        const pz = sample.point.z + nz * side * offset;
        const baseY = terrainHeightAt(px, pz);
        const rotation = Math.atan2(sample.tangent.x, sample.tangent.z);
        utilityPoles.push({ x: px, y: baseY + 4.75, z: pz, width: 0.32, height: 9.5, depth: 0.32, rotation });
        crossarms.push({ x: px, y: baseY + 8.8, z: pz, width: 2.0, height: 0.12, depth: 0.12, rotation });
        const top = { x: px, y: baseY + 8.86, z: pz, nx, nz };
        if (previousTop) {
          for (const lane of [-0.85, 0, 0.85]) {
            const ax = previousTop.x + previousTop.nx * lane;
            const az = previousTop.z + previousTop.nz * lane;
            const bx = top.x + top.nx * lane;
            const bz = top.z + top.nz * lane;
            let lastX = ax;
            let lastY = previousTop.y;
            let lastZ = az;
            for (let step = 1; step <= 4; step += 1) {
              const t = step / 4;
              const sag = Math.sin(t * Math.PI) * 0.45;
              const x = ax + (bx - ax) * t;
              const y = previousTop.y + (top.y - previousTop.y) * t - sag;
              const z = az + (bz - az) * t;
              wirePositions.push(lastX, lastY, lastZ, x, y, z);
              lastX = x;
              lastY = y;
              lastZ = z;
            }
          }
        }
        previousTop = top;
      }
    }

    // 현수막 — 집산 도로 6곳의 중간 지점을 가로지른다
    if (!elevated && road.type === "collector" && bannerIndex < BANNER_TEXTS.length && data.length > 70 && seeded(road.path[0].x, 9) > 0.35) {
      const sample = smoothRoadSampleAt(road, data.length / 2);
      const nx = -sample.tangent.z;
      const nz = sample.tangent.x;
      const rotation = Math.atan2(sample.tangent.x, sample.tangent.z);
      const baseY = roadSurfaceHeight(road, sample.pathPosition, 0.5);
      const span = road.width + 3.2;
      const poleMaterial = makeMaterial(0x5b6870, { roughness: 0.55, metalness: 0.4 });
      for (const side of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 6.4, 10), poleMaterial);
        pole.position.set(sample.point.x + nx * side * span / 2, baseY + 3.2, sample.point.z + nz * side * span / 2);
        pole.castShadow = true;
        scene.add(pole);
      }
      const bannerMaterial = makeMaterial(0xffffff, { roughness: 0.85 });
      bannerMaterial.map = makeBannerTexture(BANNER_TEXTS[bannerIndex], ["#d64545", "#2a6fb0", "#2e8b57", "#c8641f", "#6b3fa0", "#1f7a8c"][bannerIndex]);
      bannerMaterial.side = THREE.DoubleSide;
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(span - 0.4, 0.9), bannerMaterial);
      banner.position.set(sample.point.x, baseY + 5.6, sample.point.z);
      banner.rotation.y = rotation + Math.PI / 2;
      banner.castShadow = true;
      scene.add(banner);
      bannerIndex += 1;
    }
  }

  createBoxInstances(scene, curbRed, makeMaterial(0xd23c3c, { roughness: 0.68, emissive: 0xd23c3c, emissiveIntensity: 0.06 }));
  createBoxInstances(scene, curbWhite, makeMaterial(0xf1f3f4, { roughness: 0.68, emissive: 0xffffff, emissiveIntensity: 0.06 }));
  const galvanized = makeMaterial(0x9aa4aa, { roughness: 0.45, metalness: 0.62 });
  createBoxInstances(scene, railPosts, galvanized, { castShadow: true });
  createBoxInstances(scene, railBeams, galvanized, { castShadow: true });
  const lampMaterial = makeMaterial(0x4f5b63, { roughness: 0.5, metalness: 0.5 });
  createBoxInstances(scene, lampPosts, lampMaterial, { castShadow: true, geometry: new THREE.CylinderGeometry(0.5, 0.6, 1, 10) });
  createBoxInstances(scene, lampArms, lampMaterial, { castShadow: true });
  const lampHeadMaterial = makeMaterial(0xfff4d6, { roughness: 0.3, emissive: 0xffd88a, emissiveIntensity: 0.35 });
  createBoxInstances(scene, lampHeads, lampHeadMaterial, { receiveShadow: false });
  scene.userData.streetLampMaterial = lampHeadMaterial;
  createBoxInstances(scene, utilityPoles, makeMaterial(0x9c9fa2, { roughness: 0.92 }), { castShadow: true, geometry: new THREE.CylinderGeometry(0.42, 0.55, 1, 9) });
  createBoxInstances(scene, crossarms, makeMaterial(0x4a4f54, { roughness: 0.7 }), { castShadow: true });
  if (wirePositions.length) {
    const wireGeometry = new THREE.BufferGeometry();
    wireGeometry.setAttribute("position", new THREE.Float32BufferAttribute(wirePositions, 3));
    scene.add(new THREE.LineSegments(wireGeometry, new THREE.LineBasicMaterial({ color: 0x1e252b })));
  }
  return { curbs: curbRed.length + curbWhite.length, lamps: lampPosts.length, poles: utilityPoles.length };
}

function makeChevronTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, 128, 256);
  context.fillStyle = "rgba(255,255,255,0.22)";
  context.fillRect(0, 0, 128, 256);
  context.strokeStyle = "#ffffff";
  context.lineWidth = 22;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(20, 150);
  context.lineTo(64, 70);
  context.lineTo(108, 150);
  context.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// 레이싱 라인: 다음 목적지까지 경로를 따라 흐르는 파란 셰브론 리본. 앞 180m 만 그린다.
export function createRouteRibbon(scene, { maxPoints = 96, width = 2.4, ahead = 180 } = {}) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(maxPoints * 2 * 3);
  const uvs = new Float32Array(maxPoints * 2 * 2);
  const indices = [];
  for (let index = 0; index < maxPoints - 1; index += 1) {
    const base = index * 2;
    indices.push(base, base + 2, base + 1, base + 2, base + 3, base + 1);
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.setDrawRange(0, 0);
  const texture = makeChevronTexture();
  const material = new THREE.MeshBasicMaterial({
    map: texture, color: 0x46d4ff, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  mesh.visible = false;
  scene.add(mesh);

  function update(route, surfaceHeightAt) {
    if (!route || route.length < 2) {
      mesh.visible = false;
      return;
    }
    // 경로를 3.5m 간격으로 다시 샘플링해 곡선에서도 리본이 부드럽게 휜다.
    const points = [];
    let walked = 0;
    let carry = 0;
    for (let index = 0; index < route.length - 1 && walked < ahead && points.length < maxPoints; index += 1) {
      const from = route[index];
      const to = route[index + 1];
      const segment = Math.hypot(to.x - from.x, to.z - from.z);
      if (segment < 0.01) continue;
      let cursor = carry;
      while (cursor <= segment && walked < ahead && points.length < maxPoints) {
        const t = cursor / segment;
        points.push({ x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t, d: walked });
        cursor += 3.5;
        walked += 3.5;
      }
      carry = cursor - segment;
    }
    if (points.length < 2) {
      mesh.visible = false;
      return;
    }
    for (let index = 0; index < points.length; index += 1) {
      const previous = points[Math.max(0, index - 1)];
      const next = points[Math.min(points.length - 1, index + 1)];
      const dx = next.x - previous.x;
      const dz = next.z - previous.z;
      const length = Math.hypot(dx, dz) || 1;
      const nx = -dz / length;
      const nz = dx / length;
      const point = points[index];
      const y = surfaceHeightAt(point.x, point.z) + 0.4;
      // 시작 5m 는 차 밑에서 얇게 시작해 앞으로 갈수록 넓어진다.
      const taper = Math.min(1, 0.35 + index / 4);
      const half = (width / 2) * taper;
      positions[index * 6] = point.x + nx * half;
      positions[index * 6 + 1] = y;
      positions[index * 6 + 2] = point.z + nz * half;
      positions[index * 6 + 3] = point.x - nx * half;
      positions[index * 6 + 4] = y;
      positions[index * 6 + 5] = point.z - nz * half;
      uvs[index * 4] = 0;
      uvs[index * 4 + 1] = point.d / 7;
      uvs[index * 4 + 2] = 1;
      uvs[index * 4 + 3] = point.d / 7;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.uv.needsUpdate = true;
    geometry.setDrawRange(0, (points.length - 1) * 6);
    mesh.visible = true;
  }

  function animate(dt, speed) {
    texture.offset.y -= dt * (0.6 + Math.abs(speed) * 0.05);
  }

  return { mesh, update, animate };
}

function makeLabelTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  return { canvas, context: canvas.getContext("2d") };
}

// 체크포인트 링: 다음 코너/웨이포인트에 세워 두는 청록 링과 거리 라벨.
export function createCheckpointRing(scene) {
  const group = new THREE.Group();
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x5ee7ff, transparent: true, opacity: 0.85, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.14, 8, 40), ringMaterial);
  ring.position.y = 3.6;
  const inner = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.25, 40), new THREE.MeshBasicMaterial({ color: 0x5ee7ff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
  inner.position.y = 3.6;
  const { canvas, context } = makeLabelTexture();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  label.scale.set(4.2, 1.6, 1);
  label.position.y = 7.9;
  group.add(ring, inner, label);
  group.visible = false;
  scene.add(group);
  let lastText = "";

  function setLabel(text) {
    if (text === lastText) return;
    lastText = text;
    context.clearRect(0, 0, 256, 96);
    context.fillStyle = "rgba(8,20,30,0.72)";
    context.beginPath();
    context.roundRect(18, 12, 220, 72, 26);
    context.fill();
    context.strokeStyle = "#5ee7ff";
    context.lineWidth = 4;
    context.stroke();
    context.fillStyle = "#ffffff";
    context.font = "700 46px 'Segoe UI',Arial,sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, 128, 50);
    texture.needsUpdate = true;
  }

  function update({ visible, x, z, y, heading, distance, elapsed }) {
    group.visible = Boolean(visible);
    if (!visible) return;
    group.position.set(x, y, z);
    group.rotation.y = heading;
    const pulse = 1 + Math.sin(elapsed * 4.2) * 0.035;
    ring.scale.setScalar(pulse);
    setLabel(`${Math.max(1, Math.round(distance))}m`);
  }

  return { group, update };
}
