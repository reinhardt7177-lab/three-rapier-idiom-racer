export const CITY_HALF = 330;
export const CITY_SCENERY_HALF = 450;
export const CITY_SKYLINE_MIN_RADIUS = 370;
export const CITY_SKYLINE_MAX_RADIUS = 430;

// The playable city is intentionally close to level. A road game needs long,
// readable sight lines; only the outer embankment and harbour have a soft grade.
export function naturalTerrainHeightAt(x, z) {
  const cityGrade = 5.6 - z * 0.008;
  const northRise = 4.8 * Math.exp(-(((x + 12) / 255) ** 2 + ((z + 292) / 118) ** 2));
  const westEmbankment = 2.2 * Math.exp(-(((x + 314) / 50) ** 2 + ((z - 18) / 245) ** 2));
  const eastEmbankment = 2.0 * Math.exp(-(((x - 314) / 52) ** 2 + ((z - 18) / 245) ** 2));
  const harbourDrop = z > 246 ? (z - 246) * 0.022 : 0;
  const terrainNoise = Math.sin(x * 0.026) * Math.cos(z * 0.023) * 0.18 + Math.sin((x - z) * 0.012) * 0.12;
  return Math.max(1.1, cityGrade + northRise + westEmbankment + eastEmbankment + terrainNoise - harbourDrop);
}

export function terrainHeightAt(x, z) {
  const naturalHeight = naturalTerrainHeightAt(x, z);
  // Distant skyline terrain has no roads; avoiding a full road search here
  // keeps the expanded horizon cheap while preserving every drivable surface.
  if (Math.abs(x) > CITY_HALF + 20 || Math.abs(z) > CITY_HALF + 20) return naturalHeight;
  const roadHit = closestRoadPoint(x, z);
  if (!roadHit) return naturalHeight;
  // 고가 본선 아래는 지형을 끌어올리지 않는다 — 흙벽 대신 교각이 받친다.
  if (roadHit.road.skyway) return naturalHeight;
  const roadHalfWidth = roadHit.road.width / 2;
  const earthworkStart = roadHalfWidth + 1.2;
  const earthworkEnd = roadHalfWidth + (roadHit.road.bridge ? 5.5 : 10.5);
  if (roadHit.distance >= earthworkEnd) return naturalHeight;
  const roadCenterHeight = roadBaseHeightAt(roadHit.road, roadHit.segmentIndex + roadHit.t);
  const blend = Math.max(0, Math.min(1, (roadHit.distance - earthworkStart) / Math.max(0.01, earthworkEnd - earthworkStart)));
  const easedBlend = blend * blend * (3 - 2 * blend);
  return roadCenterHeight + (naturalHeight - roadCenterHeight) * easedBlend;
}

export const CITY_NODES = {
  // Downtown spine and civic square.
  hub: { x: 0, z: 72 }, centerN: { x: 0, z: -50 }, centerS: { x: 0, z: 194 }, centerW: { x: -108, z: 14 }, centerE: { x: 112, z: 14 },
  // Inner belt: deliberately broad and rounded instead of rectangular.
  ringNW: { x: -172, z: -126 }, ringN: { x: 0, z: -194 }, ringNE: { x: 178, z: -130 }, ringE: { x: 226, z: 20 },
  ringW: { x: -228, z: 18 }, ringSW: { x: -186, z: 194 }, ringS: { x: 0, z: 266 }, ringSE: { x: 192, z: 204 },
  // Three river crossings, joined into proper bridge approaches.
  westBridgeN: { x: -164, z: 96 }, westBridgeS: { x: -164, z: 146 },
  centerBridgeN: { x: 0, z: 112 }, centerBridgeS: { x: 0, z: 160 },
  eastBridgeN: { x: 166, z: 98 }, eastBridgeS: { x: 166, z: 150 },
  // Outer city belt gives the player long high-speed stretches.
  outerNW: { x: -286, z: -206 }, outerN: { x: 0, z: -282 }, outerNE: { x: 286, z: -204 }, outerE: { x: 300, z: 24 },
  outerSE: { x: 270, z: 234 }, outerS: { x: 0, z: 302 }, outerSW: { x: -276, z: 236 }, outerW: { x: -302, z: 18 },
  // Delivery branches terminate in real city blocks, not mountain dead ends.
  resSquare: { x: -162, z: -180 }, resWest: { x: -244, z: -122 }, resSouth: { x: -222, z: -218 }, school: { x: -150, z: -236 },
  techGate: { x: 178, z: -102 }, techNorth: { x: 94, z: -188 }, techEast: { x: 254, z: -68 }, library: { x: 270, z: -150 },
  artsGate: { x: -220, z: 78 }, artsNorth: { x: -276, z: 8 }, artsSquare: { x: -134, z: 112 }, museum: { x: -278, z: 64 },
  riverMarket: { x: -56, z: 238 }, riverGate: { x: 58, z: 232 }, park: { x: 78, z: 252 },
  obsGate: { x: 212, z: 212 }, observatory: { x: 282, z: 236 }, coast: { x: 104, z: 272 }
};

const ROAD_WIDTHS = { arterial: 23, collector: 16, local: 10.5, scenic: 13.5 };

function smoothPath(points, iterations = 4) {
  let path = points.map(([x, z]) => ({ x, z }));
  for (let pass = 0; pass < iterations; pass += 1) {
    const next = [path[0]];
    for (let index = 0; index < path.length - 1; index += 1) {
      const a = path[index];
      const b = path[index + 1];
      next.push(
        { x: a.x * 0.72 + b.x * 0.28, z: a.z * 0.72 + b.z * 0.28 },
        { x: a.x * 0.28 + b.x * 0.72, z: a.z * 0.28 + b.z * 0.72 }
      );
    }
    next.push(path.at(-1));
    path = next;
  }
  return path;
}

function edge(id, a, b, type, controls = [], options = {}) {
  const start = CITY_NODES[a];
  const finish = CITY_NODES[b];
  const points = [[start.x, start.z], ...controls, [finish.x, finish.z]];
  const path = smoothPath(points, options.straight ? 0 : options.smoothing ?? 4);
  return { id, a, b, type, width: ROAD_WIDTHS[type], bridge: Boolean(options.bridge), skyway: Boolean(options.skyway), path };
}

// 스카이웨이: 북·서 외곽 벨트를 지상 +9m 고가 고속도로로 승격한다.
// 고가 노드 사이 구간은 skyway 플래그(직선 종단면·교각·난간)로, 지상 노드와
// 만나는 구간은 일반 도로의 경사 제한(16%)이 자연스러운 램프를 만든다.
export const SKYWAY_ELEVATION = 9;
const NODE_ELEVATION = { outerSW: SKYWAY_ELEVATION, outerW: SKYWAY_ELEVATION, outerNW: SKYWAY_ELEVATION, outerN: SKYWAY_ELEVATION, outerNE: SKYWAY_ELEVATION };

if (false) {
const LEGACY_MOUNTAIN_ROADS = [
  edge("hub-n", "hub", "centerN", "arterial", [[-3, -28]]), edge("hub-s", "hub", "centerS", "arterial", [[8, 34]]),
  edge("hub-w", "hub", "centerW", "arterial", [[-34, 3]]), edge("hub-e", "hub", "centerE", "arterial", [[36, -5]]),
  edge("n-nw", "centerN", "ringNW", "arterial", [[-54, -74]]), edge("n-ring", "centerN", "ringN", "arterial", [[-10, -98]]),
  edge("n-ne", "centerN", "ringNE", "arterial", [[52, -112]]), edge("e-ne", "centerE", "ringNE", "arterial", [[100, -43]]),
  edge("e-ring", "centerE", "ringE", "arterial", [[125, -18]]), edge("w-nw", "centerW", "ringNW", "arterial", [[-92, -44]]),
  edge("w-ring", "centerW", "ringW", "arterial", [[-126, 0]]), edge("s-w", "centerS", "ringW", "collector", [[-56, 82], [-120, 58]]),
  edge("s-e", "centerS", "ringE", "collector", [[66, 74], [124, 46]]),
  edge("ring-nw-n", "ringNW", "ringN", "collector", [[-58, -126]]), edge("ring-n-ne", "ringN", "ringNE", "collector", [[62, -124]]),
  edge("ring-ne-e", "ringNE", "ringE", "collector", [[158, -42]]), edge("ring-w-nw", "ringW", "ringNW", "collector", [[-160, -34]]),
  edge("west-approach-a", "ringW", "artsGate", "arterial", [[-174, 50]]),
  edge("west-approach-b", "artsGate", "westBridgeN", "arterial", [[-160, 91]]),
  edge("west-bridge", "westBridgeN", "westBridgeS", "arterial", [[-143, 123]], { bridge: true, smoothing: 3 }),
  edge("west-exit", "westBridgeS", "ringSW", "arterial", [[-128, 151]]),
  edge("center-approach", "centerS", "centerBridgeN", "arterial", [[7, 92]]),
  edge("center-bridge", "centerBridgeN", "centerBridgeS", "arterial", [], { bridge: true, straight: true }),
  edge("center-exit", "centerBridgeS", "ringS", "arterial", [[13, 168]]),
  edge("east-approach", "ringE", "eastBridgeN", "arterial", [[170, 76]]),
  edge("east-bridge", "eastBridgeN", "eastBridgeS", "arterial", [[151, 148]], { bridge: true, smoothing: 3 }),
  edge("east-exit", "eastBridgeS", "ringSE", "arterial", [[145, 176]]),
  edge("south-west", "ringSW", "ringS", "collector", [[-58, 182]]), edge("south-east", "riverGate", "ringSE", "collector", [[104, 202]]),

  edge("res-entry", "ringNW", "resSquare", "collector", [[-118, -118]]), edge("res-loop-a", "ringN", "resSquare", "local", [[-58, -160]]),
  edge("res-loop-b", "resSquare", "resWest", "local", [[-170, -142]]), edge("res-loop-c", "resWest", "ringW", "local", [[-214, -42]]),
  edge("res-south", "resSquare", "resSouth", "local", [[-132, -186]]), edge("res-gate", "resSouth", "schoolGate", "local", [[-174, -180]]),
  edge("school-road", "schoolGate", "school", "local", [[-202, -168]]), edge("res-shortcut", "resWest", "schoolGate", "local", [[-208, -132]]),

  edge("tech-entry", "ringNE", "techGate", "collector", [[146, -96]]), edge("tech-loop-a", "ringN", "techNorth", "local", [[55, -168]]),
  edge("tech-loop-b", "techNorth", "techGate", "local", [[136, -132]]), edge("tech-loop-c", "techGate", "techEast", "local", [[202, -92]]),
  edge("tech-loop-d", "techEast", "ringE", "local", [[222, -8]]), edge("library-road", "techGate", "library", "local", [[190, -112]]),
  edge("library-link", "techEast", "library", "local", [[224, -92]]),

  edge("arts-loop-a", "ringW", "artsNorth", "local", [[-210, 22]]),
  edge("arts-loop-b", "artsNorth", "museum", "local", [[-238, 36]]), edge("museum-road", "artsGate", "museum", "local", [[-198, 78]]),
  edge("arts-square-a", "artsGate", "artsSquare", "local", [[-150, 72]]), edge("arts-square-b", "artsSquare", "centerS", "local", [[-72, 110]]),

  edge("market-road", "ringSW", "riverMarket", "scenic", [[-90, 202]]), edge("market-link", "riverMarket", "ringS", "local", [[-10, 222]]),
  edge("park-entry", "ringS", "riverGate", "collector", [[38, 174]]), edge("park-road", "riverGate", "park", "scenic", [[48, 210]]),
  edge("obs-entry", "ringSE", "obsGate", "collector", [[158, 178]]), edge("obs-road", "obsGate", "observatory", "scenic", [[194, 188]]),
  edge("coast-west", "park", "coast", "scenic", [[96, 238]]), edge("coast-east", "coast", "observatory", "scenic", [[172, 236]])
];
}

// City Racer layout: a civic spine, a curved inner belt, three canal bridges,
// and a full-size outer high-speed loop.  Every delivery branch connects back
// into this network, so missions always resolve onto an actual road.
export const CITY_ROADS = [
  edge("grand-north", "ringN", "centerN", "arterial", [[-8, -132]]),
  edge("grand-civic", "centerN", "hub", "arterial", [[-4, -2], [3, 40]]),
  edge("grand-approach", "hub", "centerBridgeN", "arterial", [[2, 92]]),
  edge("grand-bridge", "centerBridgeN", "centerBridgeS", "arterial", [], { bridge: true, straight: true }),
  edge("grand-harbour", "centerBridgeS", "ringS", "arterial", [[-2, 208]]),
  edge("civic-west", "centerW", "centerN", "arterial", [[-56, 10]]),
  edge("civic-east", "centerN", "centerE", "arterial", [[52, -8]]),
  edge("west-corridor", "ringW", "centerW", "arterial", [[-164, 16]]),
  edge("east-corridor", "centerE", "ringE", "arterial", [[172, 14]]),

  edge("inner-nw", "ringNW", "ringN", "collector", [[-92, -188]]),
  edge("inner-ne", "ringN", "ringNE", "collector", [[92, -190]]),
  edge("inner-east", "ringNE", "ringE", "collector", [[216, -62]]),
  edge("inner-south-east", "ringE", "ringSE", "collector", [[224, 118]]),
  // The southern belt joins the river gate as a real three-way junction instead
  // of crossing the park approach halfway through a segment.
  edge("inner-river-east", "ringSE", "riverGate", "collector", [[118, 226]]),
  edge("inner-river-west", "riverGate", "ringS", "collector", [[22, 252]]),
  edge("inner-south-west", "ringS", "ringSW", "collector", [[-104, 274]]),
  edge("inner-west", "ringSW", "ringW", "collector", [[-232, 122]]),
  edge("inner-north-west", "ringW", "ringNW", "collector", [[-220, -64]]),
  edge("northwest-spoke", "centerN", "ringNW", "arterial", [[-92, -76]]),
  edge("northeast-spoke", "centerN", "ringNE", "arterial", [[86, -82]]),
  edge("southwest-spoke", "hub", "ringW", "collector", [[-74, 66], [-144, 42]]),
  edge("southeast-spoke", "hub", "ringE", "collector", [[74, 64], [154, 42]]),

  edge("west-bridge-approach", "ringW", "westBridgeN", "arterial", [[-208, 62], [-176, 86]]),
  edge("west-bridge", "westBridgeN", "westBridgeS", "arterial", [[-164, 121]], { bridge: true, smoothing: 3 }),
  edge("west-bridge-exit", "westBridgeS", "ringSW", "arterial", [[-174, 170]]),
  edge("east-bridge-approach", "ringE", "eastBridgeN", "arterial", [[196, 56], [174, 82]]),
  edge("east-bridge", "eastBridgeN", "eastBridgeS", "arterial", [[166, 124]], { bridge: true, smoothing: 3 }),
  edge("east-bridge-exit", "eastBridgeS", "ringSE", "arterial", [[178, 180]]),

  // 스카이웨이 본선(고가 4구간) — 북·서 아크가 오버드라이브 전용 무대가 된다.
  edge("outer-nw", "outerW", "outerNW", "arterial", [[-306, -86]], { skyway: true }),
  edge("outer-north-west", "outerNW", "outerN", "arterial", [[-154, -276]], { skyway: true }),
  edge("outer-north-east", "outerN", "outerNE", "arterial", [[154, -274]], { skyway: true }),
  edge("outer-west", "outerSW", "outerW", "arterial", [[-306, 128]], { skyway: true }),
  // 고가 진·출입 램프 구간(지상 노드와 연결, 경사 제한이 램프를 만든다)
  edge("outer-ne", "outerNE", "outerE", "arterial", [[306, -92]]),
  edge("outer-east", "outerE", "outerSE", "arterial", [[304, 132]]), edge("outer-se", "outerSE", "outerS", "arterial", [[146, 302]]),
  edge("outer-sw", "outerS", "outerSW", "arterial", [[-146, 304]]),
  edge("outer-n-link", "ringN", "outerN", "collector", [[0, -242]]),
  edge("outer-ne-link", "ringNE", "outerNE", "collector", [[232, -168]]), edge("outer-e-link", "ringE", "outerE", "collector", [[266, 20]]),
  edge("outer-se-link", "ringSE", "outerSE", "collector", [[238, 220]]), edge("outer-s-link", "ringS", "outerS", "collector", [[0, 286]]),
  edge("outer-sw-link", "ringSW", "outerSW", "collector", [[-238, 218]]),

  edge("res-entry", "ringNW", "resSquare", "collector", [[-170, -158]]), edge("res-loop-a", "ringN", "resSquare", "local", [[-82, -202]]),
  edge("res-loop-b", "resSquare", "resWest", "local", [[-214, -158]]), edge("res-loop-c", "resWest", "ringW", "local", [[-254, -54]]),
  edge("res-south", "resSquare", "resSouth", "local", [[-190, -214]]),
  edge("school-road", "resSouth", "school", "local", [[-184, -238]]),

  edge("tech-entry", "ringNE", "techGate", "collector", [[168, -118]]), edge("tech-loop-a", "ringN", "techNorth", "local", [[52, -204]]),
  edge("tech-loop-d", "techEast", "ringE", "local", [[260, -26]]),
  edge("library-link", "techEast", "library", "local", [[276, -108]]),

  edge("arts-loop-a", "ringW", "artsNorth", "local", [[-264, 24]]), edge("arts-loop-b", "artsNorth", "museum", "local", [], { straight: true }),
  edge("arts-square-b", "artsSquare", "hub", "local", [[-68, 104]]), edge("arts-gate-link", "ringW", "artsGate", "collector", [[-226, 58]]),

  edge("market-road", "ringSW", "riverMarket", "scenic", [[-118, 232]]), edge("market-link", "riverMarket", "ringS", "local", [[-22, 256]]),
  edge("park-entry", "ringS", "riverGate", "collector", [[48, 260]]), edge("park-road", "riverGate", "park", "scenic", [[66, 244]]),

  // 시그니처 구간 — 리버사이드 S커브: 강 남안을 따라 S자 3연속 (니어미스 무대)
  edge("riverside-s", "centerBridgeS", "westBridgeS", "scenic", [[-40, 180], [-90, 150], [-130, 178]]),
  // 시그니처 구간 — 하버 코스탈 루프: 물가를 끼고 도는 연속 코너 (드리프트 무대)
  edge("coast-west", "park", "coast", "scenic", [[92, 266]]),
  edge("coast-link", "coast", "ringS", "scenic", [[52, 284]]),
  edge("obs-road", "outerSE", "observatory", "scenic", [[280, 230]])
];

export const CITY_TRAFFIC_LOOPS = {
  outer: ["outer-nw", "outer-north-west", "outer-north-east", "outer-ne", "outer-east", "outer-se", "outer-sw", "outer-west"],
  inner: ["inner-nw", "inner-ne", "inner-east", "inner-south-east", "inner-river-east", "inner-river-west", "inner-south-west", "inner-west", "inner-north-west"]
};

const roadNodeKey = (point) => `${point.x.toFixed(4)},${point.z.toFixed(4)}`;
const roadJunctionHeights = new Map();
const nodeKeyToId = new Map(Object.entries(CITY_NODES).map(([nodeId, point]) => [roadNodeKey(point), nodeId]));

for (const road of CITY_ROADS) {
  for (const point of [road.path[0], road.path.at(-1)]) {
    const key = roadNodeKey(point);
    if (!roadJunctionHeights.has(key)) {
      const elevation = NODE_ELEVATION[nodeKeyToId.get(key)] || 0;
      roadJunctionHeights.set(key, naturalTerrainHeightAt(point.x, point.z) + elevation);
    }
  }
}

for (let pass = 0; pass < 80; pass += 1) {
  for (const road of CITY_ROADS) {
    const startKey = roadNodeKey(road.path[0]);
    const finishKey = roadNodeKey(road.path.at(-1));
    const startHeight = roadJunctionHeights.get(startKey);
    const finishHeight = roadJunctionHeights.get(finishKey);
    const maxDelta = pathLength(road.path) * 0.14;
    const heightDelta = finishHeight - startHeight;
    if (Math.abs(heightDelta) <= maxDelta) continue;
    const correction = ((Math.abs(heightDelta) - maxDelta) / 2) * Math.sign(heightDelta);
    roadJunctionHeights.set(startKey, startHeight + correction);
    roadJunctionHeights.set(finishKey, finishHeight - correction);
  }
}

const roadHeightProfileCache = new WeakMap();

function roadHeightProfile(road) {
  const cached = roadHeightProfileCache.get(road);
  if (cached) return cached;
  const original = road.path.map((point) => naturalTerrainHeightAt(point.x, point.z));
  original[0] = roadJunctionHeights.get(roadNodeKey(road.path[0]));
  original[original.length - 1] = roadJunctionHeights.get(roadNodeKey(road.path.at(-1)));
  let profile = [...original];
  if (profile.length > 1) {
    const distances = [0];
    for (let index = 1; index < road.path.length; index += 1) {
      distances.push(distances.at(-1) + Math.hypot(road.path[index].x - road.path[index - 1].x, road.path[index].z - road.path[index - 1].z));
    }
    const totalDistance = distances.at(-1);

    if (road.bridge || road.skyway) {
      // 교량·고가 본선은 지형을 따르지 않고 양 끝 교점 높이를 직선 보간한다.
      profile = distances.map((distance) => {
        const progress = totalDistance > 0 ? distance / totalDistance : 0;
        return original[0] + (original.at(-1) - original[0]) * progress;
      });
    } else if (profile.length > 2) {
    for (let pass = 0; pass < 7; pass += 1) {
      const next = [...profile];
      for (let index = 1; index < profile.length - 1; index += 1) {
        next[index] = (profile[index - 1] + profile[index] * 2 + profile[index + 1]) / 4;
      }
      next[0] = original[0];
      next[next.length - 1] = original.at(-1);
      profile = next;
    }
    const holdDistance = 8.5;
    const transitionDistance = 20;
    const junctionBlend = (distance) => {
      const t = Math.max(0, Math.min(1, (distance - holdDistance) / (transitionDistance - holdDistance)));
      return t * t * (3 - 2 * t);
    };
    if (totalDistance < transitionDistance * 2) {
      profile = distances.map((distance) => {
        const progress = totalDistance > 0 ? distance / totalDistance : 0;
        return original[0] + (original.at(-1) - original[0]) * progress;
      });
    } else {
      for (let index = 0; index < profile.length; index += 1) {
        const fromStart = distances[index];
        const fromFinish = totalDistance - distances[index];
        if (fromStart < transitionDistance) profile[index] = original[0] + (profile[index] - original[0]) * junctionBlend(fromStart);
        if (fromFinish < transitionDistance) profile[index] = original.at(-1) + (profile[index] - original.at(-1)) * junctionBlend(fromFinish);
      }
    }

    const requiredGrade = totalDistance > 0 ? Math.abs(original.at(-1) - original[0]) / totalDistance : 0;
    const gradeLimit = Math.max(0.16, requiredGrade + 0.015);
    const lastIndex = profile.length - 1;
    for (let pass = 0; pass < 4; pass += 1) {
      profile[0] = original[0];
      for (let index = 1; index <= lastIndex; index += 1) {
        const maxDelta = gradeLimit * (distances[index] - distances[index - 1]);
        profile[index] = Math.max(profile[index - 1] - maxDelta, Math.min(profile[index - 1] + maxDelta, profile[index]));
      }

      profile[lastIndex] = original.at(-1);
      for (let index = lastIndex - 1; index >= 0; index -= 1) {
        const maxDelta = gradeLimit * (distances[index + 1] - distances[index]);
        profile[index] = Math.max(profile[index + 1] - maxDelta, Math.min(profile[index + 1] + maxDelta, profile[index]));
      }
    }
    profile[0] = original[0];
    profile[lastIndex] = original.at(-1);
    }
  }
  roadHeightProfileCache.set(road, profile);
  return profile;
}

export function roadBaseHeightAt(road, pathPosition) {
  const maxIndex = Math.max(1, road.path.length - 1);
  const clampedPosition = Math.max(0, Math.min(maxIndex, pathPosition));
  const lowerIndex = Math.min(maxIndex - 1, Math.floor(clampedPosition));
  const segmentT = clampedPosition - lowerIndex;
  const profile = roadHeightProfile(road);
  return profile[lowerIndex] + (profile[lowerIndex + 1] - profile[lowerIndex]) * segmentT;
}

export const CITY_RIVER_PATH = smoothPath([
  [-340, 108], [-270, 111], [-190, 116], [-104, 122], [0, 129], [98, 136], [184, 147], [262, 160], [340, 171]
], 2);

export const DESTINATION_NODES = {
  school: "school", library: "library", park: "park", museum: "museum", observatory: "observatory"
};

export const CITY_DISTRICTS = [
  { id: "residential", name: "웨스트 엔진 지구", x: -194, z: -154, rx: 110, rz: 94, count: 78, colors: [0xf2e3cf, 0xe8d5be, 0xd9e2e8, 0xf0d9c4, 0xdce8dc], minHeight: 7, maxHeight: 17 },
  { id: "north", name: "노스 게이트", x: -8, z: -142, rx: 132, rz: 96, count: 62, colors: [0x9fc4d8, 0xb7d2e0, 0xcfdfe8, 0x8fb4c8], minHeight: 18, maxHeight: 48 },
  { id: "tech", name: "이스트 스카이라인", x: 184, z: -94, rx: 112, rz: 108, count: 80, colors: [0x86b8d4, 0xa3c9dd, 0xc0d8e5, 0x94c4b8], minHeight: 22, maxHeight: 64 },
  { id: "arts", name: "웨스트 마켓", x: -198, z: 62, rx: 98, rz: 84, count: 62, colors: [0xe8b48e, 0xd8c8d4, 0xf0c4a4, 0xa8c8dc, 0xe4d49c], minHeight: 8, maxHeight: 26 },
  { id: "center", name: "센트럴 레이싱 시티", x: 12, z: 26, rx: 156, rz: 116, count: 110, colors: [0x92bcd4, 0xaccce0, 0xc4d4dc, 0xe0b8a4, 0x9cc8b8], minHeight: 24, maxHeight: 70 },
  { id: "river", name: "하버 프론트", x: 52, z: 218, rx: 198, rz: 72, count: 52, colors: [0xa4ccc8, 0xe0c4a0, 0x9cc4d8, 0xe0b8c0], minHeight: 8, maxHeight: 28 }
];

export function closestPointOnSegment(x, z, start, end) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - start.x) * dx + (z - start.z) * dz) / lengthSquared));
  const point = { x: start.x + dx * t, z: start.z + dz * t };
  return { point, t, distance: Math.hypot(x - point.x, z - point.z) };
}

function segmentIntersection(a, b, c, d) {
  const abX = b.x - a.x;
  const abZ = b.z - a.z;
  const cdX = d.x - c.x;
  const cdZ = d.z - c.z;
  const determinant = abX * cdZ - abZ * cdX;
  if (Math.abs(determinant) < 0.00001) return null;
  const acX = c.x - a.x;
  const acZ = c.z - a.z;
  const t = (acX * cdZ - acZ * cdX) / determinant;
  const u = (acX * abZ - acZ * abX) / determinant;
  if (t <= 0.003 || t >= 0.997 || u <= 0.003 || u >= 0.997) return null;
  return { x: a.x + abX * t, z: a.z + abZ * t };
}

function segmentDistance(a, b, c, d) {
  return Math.min(
    closestPointOnSegment(a.x, a.z, c, d).distance,
    closestPointOnSegment(b.x, b.z, c, d).distance,
    closestPointOnSegment(c.x, c.z, a, b).distance,
    closestPointOnSegment(d.x, d.z, a, b).distance
  );
}

// Road crossings must be modelled as shared city nodes.  Rendering two road
// decks through each other produces broken lane paint and impossible junctions.
export function findUnmodeledRoadCrossings(roads = CITY_ROADS) {
  const crossings = [];
  for (let firstIndex = 0; firstIndex < roads.length; firstIndex += 1) {
    const first = roads[firstIndex];
    for (let secondIndex = firstIndex + 1; secondIndex < roads.length; secondIndex += 1) {
      const second = roads[secondIndex];
      const sharedNodeIds = [first.a, first.b].filter((nodeId) => second.a === nodeId || second.b === nodeId);
      for (let firstSegment = 0; firstSegment < first.path.length - 1; firstSegment += 1) {
        for (let secondSegment = 0; secondSegment < second.path.length - 1; secondSegment += 1) {
          const point = segmentIntersection(first.path[firstSegment], first.path[firstSegment + 1], second.path[secondSegment], second.path[secondSegment + 1]);
          if (!point) continue;
          const sharesActualNode = sharedNodeIds.some((nodeId) => Math.hypot(point.x - CITY_NODES[nodeId].x, point.z - CITY_NODES[nodeId].z) < 0.8);
          if (!sharesActualNode) crossings.push({ first: first.id, second: second.id, point });
        }
      }
    }
  }
  return crossings;
}

// Even without intersecting center lines, two wide road decks can overlap.  A
// small clearance keeps shoulders, lane paint, and traffic from looking merged.
export function findRoadSurfaceConflicts(roads = CITY_ROADS, minimumClearance = 2) {
  const conflicts = [];
  for (let firstIndex = 0; firstIndex < roads.length; firstIndex += 1) {
    const first = roads[firstIndex];
    for (let secondIndex = firstIndex + 1; secondIndex < roads.length; secondIndex += 1) {
      const second = roads[secondIndex];
      if ([first.a, first.b].some((nodeId) => second.a === nodeId || second.b === nodeId)) continue;
      let minimumDistance = Infinity;
      for (let firstSegment = 0; firstSegment < first.path.length - 1; firstSegment += 1) {
        for (let secondSegment = 0; secondSegment < second.path.length - 1; secondSegment += 1) {
          minimumDistance = Math.min(minimumDistance, segmentDistance(first.path[firstSegment], first.path[firstSegment + 1], second.path[secondSegment], second.path[secondSegment + 1]));
        }
      }
      const clearance = minimumDistance - (first.width + second.width) / 2;
      if (clearance < minimumClearance) conflicts.push({ first: first.id, second: second.id, minimumDistance, clearance });
    }
  }
  return conflicts;
}

export function closestRoadPoint(x, z) {
  let closest = null;
  for (const road of CITY_ROADS) {
    for (let segmentIndex = 0; segmentIndex < road.path.length - 1; segmentIndex += 1) {
      const hit = closestPointOnSegment(x, z, road.path[segmentIndex], road.path[segmentIndex + 1]);
      if (!closest || hit.distance < closest.distance) closest = { ...hit, road, segmentIndex };
    }
  }
  return closest;
}

export function distanceToRiver(x, z) {
  let distance = Infinity;
  for (let index = 0; index < CITY_RIVER_PATH.length - 1; index += 1) {
    distance = Math.min(distance, closestPointOnSegment(x, z, CITY_RIVER_PATH[index], CITY_RIVER_PATH[index + 1]).distance);
  }
  return distance;
}

export function isPointOnCityRoad(x, z, tolerance = 0) {
  const hit = closestRoadPoint(x, z);
  return Boolean(hit && hit.distance <= hit.road.width / 2 + tolerance);
}

export function pathLength(path) {
  let total = 0;
  for (let index = 1; index < path.length; index += 1) total += Math.hypot(path[index].x - path[index - 1].x, path[index].z - path[index - 1].z);
  return total;
}
