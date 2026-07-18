import { DESTINATIONS } from "./game-data.js";
import { WORLD_SPEED_TO_KMH, buildRoadRoute, routeLength } from "./create-delivery-runtime.js";
import { LEARNING_PACKS } from "./learning-packs.js";

// 평판 등급: 점수가 XP로 쌓여 계약 티어와 차량 해금을 연다.
export const RANKS = [
  { id: "rookie", name: "루키", xp: 0, color: "#9be15d", icon: "🌱" },
  { id: "bronze", name: "브론즈", xp: 4000, color: "#d2854f", icon: "🥉" },
  { id: "silver", name: "실버", xp: 12000, color: "#aab7c4", icon: "🥈" },
  { id: "gold", name: "골드", xp: 30000, color: "#ffd166", icon: "🥇" },
  { id: "legend", name: "레전드", xp: 60000, color: "#b678f2", icon: "👑" }
];

export function rankForXp(xp) {
  let index = 0;
  for (let cursor = 0; cursor < RANKS.length; cursor += 1) if (xp >= RANKS[cursor].xp) index = cursor;
  return { ...RANKS[index], index, next: RANKS[index + 1] || null };
}

const BONUS_TYPES = [
  { type: "noCrash", target: 0, label: "무충돌 배송", icon: "🛡️" },
  { type: "nearMiss", target: 4, label: "니어미스 4회", icon: "💨" },
  { type: "drift", target: 2.5, label: "드리프트 누적 2.5초", icon: "🌀" },
  { type: "coins", target: 6, label: "별 토큰 6개", icon: "⭐" }
];

function mulberry32(seed) {
  let value = seed >>> 0;
  return function next() {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

// 계약 1장: 배송지 조합·제한시간·보상·보너스 조건을 절차 생성한다.
// 제한시간은 실제 도로 경로 거리에서 산출하므로 항상 달성 가능한 값이 나온다.
function generateContract(seed, slot, rankIndex) {
  const rng = mulberry32(seed * 7919 + slot * 104729 + rankIndex * 31);
  const stopCount = rankIndex >= 2 ? 3 : 2;
  const allStops = Object.keys(DESTINATIONS);
  const stops = [];
  while (stops.length < stopCount) {
    const candidate = allStops[Math.floor(rng() * allStops.length)];
    if (!stops.includes(candidate)) stops.push(candidate);
  }
  let cursor = { x: 0, z: 72 };
  let distance = 0;
  for (const stopId of stops) {
    const target = DESTINATIONS[stopId];
    distance += routeLength(buildRoadRoute(cursor.x, cursor.z, target));
    cursor = target;
  }
  const targetKmh = 32 + rankIndex * 4 + slot * 3;
  const time = Math.max(80, Math.min(420, Math.round(distance / (targetKmh / WORLD_SPEED_TO_KMH))));
  const reward = Math.round((distance * (0.55 + rankIndex * 0.12 + slot * 0.14)) / 10) * 10;
  const pack = LEARNING_PACKS[(seed + slot) % LEARNING_PACKS.length];
  const bonus = BONUS_TYPES[Math.floor(rng() * BONUS_TYPES.length)];
  const lastStop = DESTINATIONS[stops[stops.length - 1]];
  return {
    id: `contract-${seed}-${slot}`,
    slot,
    title: `${pack.name} 특급 · ${lastStop.short}행`,
    subtitle: `${pack.tagline} — 게이트를 정답 차선으로 통과하며 배달하세요!`,
    pack,
    packId: pack.id,
    stops,
    time,
    reward,
    distance: Math.round(distance),
    targetKmh,
    bonus: { ...bonus, reward: 150 + slot * 120 + rankIndex * 60 },
    color: pack.color,
    mathLevel: Math.min(3, 1 + rankIndex)
  };
}

// 라이벌 매치: 같은 배송을 라이벌 AI와 동시에 뛰어 먼저 끝내는 쪽이 이긴다.
function generateRivalContract(seed, rankIndex) {
  const rng = mulberry32(seed * 31337 + rankIndex * 77 + 5);
  const allStops = Object.keys(DESTINATIONS);
  const stops = [];
  while (stops.length < 2) {
    const candidate = allStops[Math.floor(rng() * allStops.length)];
    if (!stops.includes(candidate)) stops.push(candidate);
  }
  let cursor = { x: 0, z: 72 };
  let distance = 0;
  for (const stopId of stops) {
    const target = DESTINATIONS[stopId];
    distance += routeLength(buildRoadRoute(cursor.x, cursor.z, target));
    cursor = target;
  }
  const rivalKmh = 34 + rankIndex * 5;
  const time = Math.max(90, Math.min(420, Math.round((distance / (rivalKmh / WORLD_SPEED_TO_KMH)) * 1.35)));
  const pack = LEARNING_PACKS[(seed + 1) % LEARNING_PACKS.length];
  const lastStop = DESTINATIONS[stops[stops.length - 1]];
  return {
    id: `rival-${seed}-${rankIndex}`,
    slot: 3,
    rival: { kmh: rivalKmh },
    title: `라이벌 매치 · ${lastStop.short}행`,
    subtitle: "라이벌 드라이버보다 먼저 모든 배송을 끝내세요! 지면 보상은 4분의 1.",
    pack,
    packId: pack.id,
    stops,
    time,
    reward: 500 + rankIndex * 300,
    distance: Math.round(distance),
    targetKmh: rivalKmh + 6,
    bonus: null,
    color: "#ff2e4d",
    mathLevel: Math.min(3, 1 + rankIndex)
  };
}

export function generateContracts(seed, rankIndex = 0) {
  return [
    ...[0, 1, 2].map((slot) => generateContract(seed, slot, rankIndex)),
    generateRivalContract(seed, rankIndex)
  ];
}
