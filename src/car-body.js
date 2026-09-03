import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// 차체 로프트: 길이 방향 단면(오른쪽 반, 아래→위)을 이어 붙여 매끈한 한 덩어리 차체를 만든다.
// 단면 점 수는 모두 같아야 하며, 좌우 대칭으로 링을 만들고 앞뒤를 캡으로 닫는다.
export function loftShell(sections, material, { caps = true, smooth = true } = {}) {
  const pointCount = sections[0].points.length;
  const ringSize = pointCount * 2;
  const positions = [];
  const indices = [];
  for (const section of sections) {
    for (const [x, y] of section.points) positions.push(x, y, section.z);
    for (let index = pointCount - 1; index >= 0; index -= 1) positions.push(-section.points[index][0], section.points[index][1], section.z);
  }
  for (let ring = 0; ring < sections.length - 1; ring += 1) {
    const a = ring * ringSize;
    const b = a + ringSize;
    for (let index = 0; index < ringSize; index += 1) {
      const next = (index + 1) % ringSize;
      indices.push(a + index, a + next, b + index, a + next, b + next, b + index);
    }
  }
  if (caps) {
    const first = sections[0];
    const last = sections[sections.length - 1];
    const firstCenter = positions.length / 3;
    positions.push(0, (first.points[0][1] + first.points[pointCount - 1][1]) / 2, first.z);
    const lastCenter = positions.length / 3;
    positions.push(0, (last.points[0][1] + last.points[pointCount - 1][1]) / 2, last.z);
    const lastBase = (sections.length - 1) * ringSize;
    for (let index = 0; index < ringSize; index += 1) {
      const next = (index + 1) % ringSize;
      indices.push(firstCenter, next, index);
      indices.push(lastCenter, lastBase + index, lastBase + next);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(smooth ? geometry : geometry.toNonIndexed(), material);
  if (!smooth) mesh.geometry.computeVertexNormals();
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// 차종별 실루엣 파라미터. 값은 차체 폭/길이에 대한 비율이라 어떤 profile에도 맞는다.
const SILHOUETTES = {
  sedan: { beltRise: 0.98, hoodDrop: 0.1, noseDrop: 0.34, tailDrop: 0.12, cabinWidth: 0.8, roofWidth: 0.62, rearSlope: 0.7, frontSlope: 0.85 },
  coupe: { beltRise: 0.92, hoodDrop: 0.14, noseDrop: 0.38, tailDrop: 0.16, cabinWidth: 0.78, roofWidth: 0.56, rearSlope: 1.1, frontSlope: 1.0 },
  roadster: { beltRise: 0.9, hoodDrop: 0.12, noseDrop: 0.36, tailDrop: 0.1, cabinWidth: 0.76, roofWidth: 0.52, rearSlope: 0.9, frontSlope: 0.95 },
  super: { beltRise: 0.86, hoodDrop: 0.2, noseDrop: 0.42, tailDrop: 0.04, cabinWidth: 0.74, roofWidth: 0.5, rearSlope: 1.4, frontSlope: 1.15 },
  van: { beltRise: 1.05, hoodDrop: 0.04, noseDrop: 0.2, tailDrop: 0.02, cabinWidth: 0.9, roofWidth: 0.8, rearSlope: 0.15, frontSlope: 0.55 }
};

export function carShellDimensions(profile) {
  const silhouette = SILHOUETTES[profile.kind] || SILHOUETTES.sedan;
  const halfWidth = profile.width / 2;
  const bottom = 0.48 + profile.clearance;
  const belt = bottom + silhouette.beltRise;
  return { silhouette, halfWidth, bottom, belt };
}

// 몸통(벨트라인까지)과 그린하우스(유리 캐빈)의 단면 목록을 생성한다.
export function buildCarShellSections(profile) {
  const { silhouette, halfWidth: hw, bottom, belt } = carShellDimensions(profile);
  const { length, roof, cabinStart, cabinEnd } = profile;
  const half = length / 2;
  const hoodAtCowl = belt - silhouette.hoodDrop;
  const nose = belt - silhouette.noseDrop;
  const tail = belt - silhouette.tailDrop;

  // 6점 단면: 실 안쪽 → 실 → 도어 중간 → 숄더 → 상판 가장자리 → 상판 중앙 근처
  const section = (z, sillY, sillW, doorW, shoulderY, shoulderW, topEdgeY, topEdgeW, topY, topW) => ({
    z,
    points: [[hw * sillW * 0.72, sillY], [hw * sillW, sillY + 0.12], [hw * doorW, shoulderY - 0.34], [hw * shoulderW, shoulderY], [hw * topEdgeW, topEdgeY], [hw * topW, topY]]
  });

  const body = [
    section(-half, bottom + 0.14, 0.82, 0.88, tail - 0.28, 0.86, tail - 0.06, 0.72, tail, 0.42),
    section(-half + 0.32, bottom + 0.04, 0.95, 0.99, belt - 0.16, 0.97, belt - 0.02, 0.82, belt + 0.02, 0.5),
    section(cabinStart - 0.55, bottom, 0.99, 1, belt - 0.06, 0.985, belt + 0.06, 0.86, belt + 0.1, 0.55),
    section(cabinStart + 0.1, bottom, 1, 1, belt - 0.04, 0.99, belt + 0.1, 0.9, belt + 0.14, 0.6),
    section((cabinStart + cabinEnd) / 2, bottom, 1, 1, belt - 0.04, 0.99, belt + 0.1, 0.9, belt + 0.14, 0.6),
    section(cabinEnd - 0.05, bottom, 1, 1, belt - 0.04, 0.99, belt + 0.1, 0.9, belt + 0.14, 0.6),
    section(cabinEnd + 0.3, bottom, 0.99, 1, belt - 0.1, 0.98, hoodAtCowl + 0.04, 0.84, hoodAtCowl + 0.08, 0.5),
    section(cabinEnd + (half - cabinEnd) * 0.55, bottom, 0.98, 0.99, belt - 0.24, 0.96, hoodAtCowl - 0.08, 0.8, hoodAtCowl - 0.04, 0.46),
    section(half - 0.36, bottom + 0.03, 0.94, 0.96, nose - 0.1, 0.92, nose + 0.06, 0.74, nose + 0.1, 0.42),
    section(half, bottom + 0.14, 0.78, 0.84, nose - 0.22, 0.82, nose - 0.04, 0.62, nose, 0.36)
  ];

  const cabinW = silhouette.cabinWidth;
  const roofW = silhouette.roofWidth;
  const rearRise = Math.min(0.9, (roof - belt - 0.12) * silhouette.rearSlope);
  const frontRise = Math.min(0.9, (roof - belt - 0.12) * silhouette.frontSlope);
  const glassSection = (z, baseW, midY, midW, topY, topW) => ({
    z,
    points: [[hw * baseW, belt + 0.08], [hw * midW, midY], [hw * topW, topY]]
  });
  const flatRoofStart = cabinStart + rearRise;
  const flatRoofEnd = cabinEnd - frontRise;
  const greenhouse = [
    glassSection(cabinStart - 0.3, 0.9, belt + 0.18, 0.86, belt + 0.22, 0.6),
    glassSection(cabinStart + 0.1, 0.92, belt + 0.42, cabinW * 1.02, belt + 0.52, roofW * 1.04),
    glassSection(flatRoofStart, 0.94, roof - 0.14, cabinW, roof, roofW),
    glassSection((flatRoofStart + flatRoofEnd) / 2, 0.94, roof - 0.13, cabinW, roof + 0.015, roofW * 1.02),
    glassSection(flatRoofEnd, 0.94, roof - 0.14, cabinW, roof, roofW),
    glassSection(cabinEnd - 0.1, 0.92, belt + 0.46, cabinW * 1.02, belt + 0.56, roofW * 1.04),
    glassSection(cabinEnd + 0.22, 0.9, belt + 0.16, 0.86, belt + 0.2, 0.58)
  ];
  return { body, greenhouse, belt, bottom, nose, tail, hoodAtCowl, flatRoofStart, flatRoofEnd, cabinW, roofW };
}

function roundedPart(width, height, depth, material, radius, x, y, z) {
  const geometry = new RoundedBoxGeometry(width, height, depth, 2, Math.min(radius, width * 0.45, height * 0.45, depth * 0.45));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// 차체 + 그린하우스 + 필러/루프 + 라이트·그릴·범퍼 디테일을 한 그룹으로 조립한다.
// materials: { body, glass, dark, chrome, accent, headlight, taillight }
export function buildCarShell(profile, materials, { lightBar = true, spoiler = null } = {}) {
  const group = new THREE.Group();
  const { silhouette, halfWidth: hw } = carShellDimensions(profile);
  const { body, greenhouse, belt, bottom, nose, tail, flatRoofStart, flatRoofEnd, cabinW, roofW } = buildCarShellSections(profile);
  const { length, roof, width, cabinStart, cabinEnd } = profile;
  const half = length / 2;

  group.add(loftShell(body, materials.body));
  group.add(loftShell(greenhouse, materials.glass));

  // 루프 패널(차체색)과 A/B/C 필러 — 유리 덩어리를 차체와 이어 준다.
  const roofDepth = Math.max(0.5, flatRoofEnd - flatRoofStart + 0.1);
  group.add(roundedPart(roofW * 2 * hw * 0.98, 0.07, roofDepth, materials.body, 0.03, 0, roof + 0.03, (flatRoofStart + flatRoofEnd) / 2));
  const pillar = (fromZ, fromY, toZ, toY, x) => {
    const dz = toZ - fromZ;
    const dy = toY - fromY;
    const mesh = roundedPart(0.09, Math.hypot(dz, dy) + 0.08, 0.16, materials.body, 0.03, x, (fromY + toY) / 2, (fromZ + toZ) / 2);
    mesh.rotation.x = Math.atan2(dz, dy);
    return mesh;
  };
  const pillarX = hw * cabinW * 0.94;
  for (const side of [-1, 1]) {
    group.add(pillar(cabinEnd + 0.16, belt + 0.1, flatRoofEnd + 0.02, roof - 0.02, side * pillarX));
    group.add(pillar(cabinStart - 0.22, belt + 0.1, flatRoofStart - 0.02, roof - 0.02, side * pillarX));
    if (silhouette !== SILHOUETTES.coupe && silhouette !== SILHOUETTES.super) {
      group.add(roundedPart(0.07, roof - belt - 0.1, 0.11, materials.dark, 0.02, side * (hw * cabinW * 0.985), (roof + belt) / 2, (cabinStart + cabinEnd) / 2 + 0.05));
    }
    // 사이드미러
    group.add(roundedPart(0.3, 0.14, 0.36, materials.body, 0.06, side * (hw + 0.16), belt + 0.16, cabinEnd + 0.12));
    // 도어 손잡이
    group.add(roundedPart(0.03, 0.05, 0.28, materials.chrome, 0.01, side * (hw * 1.005), belt - 0.16, (cabinStart + cabinEnd) / 2 - 0.15));
    // 휠 아치 라이너(어두운 링)
  }

  // 벨트라인 크롬 몰딩과 사이드 스커트
  for (const side of [-1, 1]) {
    group.add(roundedPart(0.03, 0.035, cabinEnd - cabinStart + 0.5, materials.chrome, 0.01, side * (hw * 1.0), belt + 0.06, (cabinStart + cabinEnd) / 2));
    group.add(roundedPart(0.12, 0.14, length * 0.62, materials.dark, 0.04, side * (hw + 0.02), bottom + 0.06, 0.05));
  }

  // 전면: LED 헤드라이트 바 + 그릴 + 하부 흡기구 + 스플리터
  const headLightY = nose - 0.02;
  for (const side of [-1, 1]) {
    group.add(roundedPart(width * 0.24, 0.085, 0.14, materials.headlight, 0.03, side * width * 0.3, headLightY, half - 0.02));
    group.add(roundedPart(width * 0.08, 0.06, 0.1, materials.headlight, 0.02, side * width * 0.36, bottom + 0.28, half - 0.02));
  }
  group.add(roundedPart(width * 0.5, 0.18, 0.12, materials.dark, 0.04, 0, headLightY - 0.02, half - 0.01));
  group.add(roundedPart(width * 0.62, 0.17, 0.12, materials.dark, 0.04, 0, bottom + 0.3, half - 0.01));
  group.add(roundedPart(width * 0.88, 0.12, 0.42, materials.dark, 0.05, 0, bottom + 0.03, half + 0.04));
  group.add(roundedPart(width * 0.58, 0.05, 0.1, materials.accent, 0.02, 0, bottom + 0.12, half + 0.24));

  // 후면: 풀와이드 테일램프 바(또는 좌우 램프) + 디퓨저 + 범퍼 + 번호판 + 머플러
  if (lightBar) group.add(roundedPart(width * 0.82, 0.075, 0.12, materials.taillight, 0.03, 0, tail - 0.1, -half + 0.01));
  for (const side of [-1, 1]) {
    group.add(roundedPart(width * 0.24, 0.16, 0.12, materials.taillight, 0.04, side * width * 0.3, tail - 0.12, -half + 0.01));
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.4, 12), materials.chrome);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(side * width * 0.26, bottom + 0.12, -half - 0.16);
    group.add(exhaust);
  }
  group.add(roundedPart(width * 0.9, 0.17, 0.36, materials.dark, 0.05, 0, bottom + 0.05, -half - 0.04));
  group.add(roundedPart(width * 0.86, 0.14, 0.14, materials.accent, 0.05, 0, bottom + 0.34, -half - 0.05));
  group.add(roundedPart(width * 0.3, 0.16, 0.06, materials.plate || materials.chrome, 0.02, 0, bottom + 0.52, -half - 0.09));

  if (spoiler === "lip") {
    const lip = roundedPart(width * 0.7, 0.06, 0.26, materials.dark, 0.03, 0, belt + 0.1, -half + 0.32);
    lip.rotation.x = -0.1;
    group.add(lip);
  } else if (spoiler === "wing" || spoiler === "active") {
    const wingWidth = spoiler === "active" ? width * 0.72 : width * 0.84;
    group.add(roundedPart(wingWidth, 0.08, 0.32, materials.dark, 0.03, 0, belt + 0.42, -half + 0.34));
    for (const side of [-1, 1]) group.add(roundedPart(0.09, 0.34, 0.14, materials.dark, 0.02, side * width * 0.27, belt + 0.22, -half + 0.34));
  }
  group.userData.shell = { belt, bottom, nose, tail };
  return group;
}

export function buildWheel(radius, wheelWidth, tireMaterial, rimMaterial, spokeMaterial, hubMaterial) {
  const assembly = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, wheelWidth, 30), tireMaterial);
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.7, radius * 0.7, wheelWidth * 0.96, 24), rimMaterial);
  rim.rotation.z = Math.PI / 2;
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, wheelWidth * 0.7, 24), tireMaterial);
  dish.rotation.z = Math.PI / 2;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, wheelWidth * 1.04, 16), hubMaterial);
  hub.rotation.z = Math.PI / 2;
  const spokes = new THREE.Group();
  for (let index = 0; index < 5; index += 1) {
    const angle = (index / 5) * Math.PI * 2;
    const spoke = roundedPart(wheelWidth * 1.02, radius * 0.56, radius * 0.11, spokeMaterial, 0.02, 0, Math.sin(angle) * radius * 0.3, Math.cos(angle) * radius * 0.3);
    spoke.rotation.x = -angle;
    spokes.add(spoke);
  }
  assembly.add(tire, rim, dish, spokes, hub);
  assembly.userData.radius = radius;
  return assembly;
}
