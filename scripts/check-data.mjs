import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CITY_HALF, CITY_NODES, CITY_ROADS, CITY_SCENERY_HALF, CITY_SKYLINE_MAX_RADIUS, CITY_TRAFFIC_LOOPS, DESTINATION_NODES, closestRoadPoint, findRoadSurfaceConflicts, findUnmodeledRoadCrossings, isPointOnCityRoad, terrainHeightAt } from "../src/city-map.js";
import { buildCityBuildingPlans, buildCityLandmarkClearings } from "../src/city-layout.js";
import { DECALS, DESTINATIONS, MAX_WORKSHOP_LEVEL, MISSIONS, PAINTS, TOPPERS, VEHICLES, WHEELS, workshopPrice } from "../src/game-data.js";
import { idiomQuizData } from "../src/idiom-quiz-data.js";
import { WORLD_SPEED_TO_KMH, buildRoadRoute, navigationForRoute, routeLength } from "../src/create-delivery-runtime.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

function assertUnique(items, label) {
  const ids = items.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, `${label} ID가 중복되었습니다.`);
}

assertUnique(PAINTS, "페인트");
assertUnique(WHEELS, "바퀴");
assertUnique(TOPPERS, "지붕 장식");
assertUnique(DECALS, "스티커");
assertUnique(MISSIONS, "미션");
assertUnique(VEHICLES, "차량");
assert.equal(VEHICLES.length, 5, "구매 가능한 차량은 정확히 5종이어야 합니다.");
assert.equal(VEHICLES[0].price, 0, "첫 차량은 무료여야 합니다.");
assert.deepEqual(VEHICLES.map((vehicle) => vehicle.topSpeed), [200, 225, 250, 275, 300], "차량 최고 속도는 200km/h부터 포르쉐 300km/h까지 단계적으로 구성되어야 합니다.");
for (let index = 1; index < VEHICLES.length; index += 1) {
  assert.ok(VEHICLES[index].price > VEHICLES[index - 1].price, "상위 차량의 가격은 더 높아야 합니다.");
  assert.ok(VEHICLES[index].speed >= VEHICLES[index - 1].speed, "상위 차량의 최고 속도는 낮아지면 안 됩니다.");
}
for (const type of ["speed", "handling"]) {
  for (let level = 1; level < MAX_WORKSHOP_LEVEL; level += 1) {
    assert.ok(workshopPrice(level, type) > workshopPrice(level - 1, type), `${type} 업그레이드 비용은 단계마다 증가해야 합니다.`);
  }
}
assert.ok(terrainHeightAt(0, -220) > terrainHeightAt(0, 220), "북쪽 진입로가 하버 프론트보다 높아야 합니다.");
assert.ok(CITY_SKYLINE_MAX_RADIUS < CITY_SCENERY_HALF - 8, "외곽 스카이라인은 렌더 지형 경계 안에 있어야 합니다.");

for (const mission of MISSIONS) {
  assert.equal(mission.stops.length, 3, `${mission.title}은 배송지 3곳이 필요합니다.`);
  assert.ok(mission.reward > 0, `${mission.title}에 골드 보상이 없습니다.`);
  for (const stop of mission.stops) assert.ok(DESTINATIONS[stop], `${mission.title}의 배송지 ${stop}이 없습니다.`);
}

for (const destination of Object.values(DESTINATIONS)) {
  const node = CITY_NODES[DESTINATION_NODES[destination.id]];
  assert.ok(node && Math.hypot(node.x - destination.x, node.z - destination.z) < 0.01, `${destination.name} 배송 지점이 도로 노드와 연결되지 않았습니다.`);
  assert.ok(isPointOnCityRoad(destination.x, destination.z, 0.2), `${destination.name} 배송 지점이 도로 위에 있지 않습니다.`);
  assert.ok(Math.abs(destination.landmarkX) <= CITY_HALF - 16 && Math.abs(destination.landmarkZ) <= CITY_HALF - 16, `${destination.name} 랜드마크가 도시 밖에 있습니다.`);
  const landmarkRoad = closestRoadPoint(destination.landmarkX, destination.landmarkZ);
  assert.ok(landmarkRoad && landmarkRoad.distance >= landmarkRoad.road.width / 2 + 20, `${destination.name} 랜드마크가 도로 또는 가드레일 구역을 침범합니다.`);
}

const hubSites = [
  { name: "배송 허브", x: CITY_NODES.hub.x - 34, z: CITY_NODES.hub.z - 30, radius: 12.1 },
  { name: "시티 튜닝숍", x: CITY_NODES.hub.x + 34, z: CITY_NODES.hub.z - 30, radius: 10.5 }
];
for (const site of hubSites) {
  const road = closestRoadPoint(site.x, site.z);
  assert.ok(road && road.distance >= road.road.width / 2 + site.radius + 4.5, `${site.name}가 도로를 침범합니다.`);
}

const buildingPlans = buildCityBuildingPlans(buildCityLandmarkClearings(DESTINATIONS));
assert.ok(buildingPlans.length >= 150, "도시의 일반 건물 수가 충분하지 않습니다.");
for (const building of buildingPlans) {
  const road = closestRoadPoint(building.x, building.z);
  assert.ok(road, "일반 건물 근처에 도로 정보를 찾지 못했습니다.");
  assert.ok(building.roadClearance >= 4.5, "일반 건물이 도로 안전 여유 구역을 침범합니다.");
  assert.ok(road.distance >= road.road.width / 2 + building.footprintRadius + 4.5, "일반 건물이 도로 면을 침범합니다.");
}
for (let index = 0; index < buildingPlans.length; index += 1) {
  for (let other = index + 1; other < buildingPlans.length; other += 1) {
    const a = buildingPlans[index];
    const b = buildingPlans[other];
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= a.footprintRadius + b.footprintRadius + 3, "일반 건물끼리 겹칩니다.");
  }
}

for (const mission of MISSIONS) {
  let current = CITY_NODES.hub;
  let missionDistance = 0;
  for (const stopId of mission.stops) {
    const target = DESTINATIONS[stopId];
    const route = buildRoadRoute(current.x, current.z, target);
    assert.ok(route.length >= 2, `${mission.title}의 ${target.name} 구간에 도로 경로가 없습니다.`);
    missionDistance += routeLength(route);
    current = target;
  }
  const requiredAverageKmh = missionDistance / mission.time * WORLD_SPEED_TO_KMH;
  assert.ok(requiredAverageKmh >= 30, `${mission.title}의 제한시간이 시티 레이서 주행에 비해 너무 느슨합니다.`);
  assert.ok(requiredAverageKmh <= VEHICLES[0].topSpeed * 0.55, `${mission.title}은 기본 차량으로 무리하게 높은 평균 속도를 요구합니다.`);
}

const routeStarts = [CITY_NODES.hub, CITY_NODES.centerE, CITY_NODES.ringW];
let bridgeCrossings = 0;
let curvedSegments = 0;
const bridgeRoads = CITY_ROADS.filter((road) => road.bridge);
assert.equal(findUnmodeledRoadCrossings().length, 0, "도로는 명시된 교차 노드 외에서 서로 가로지를 수 없습니다.");
assert.equal(findRoadSurfaceConflicts().length, 0, "서로 다른 도로의 포장면과 차선 여유가 겹칩니다.");
for (const [loopName, roadIds] of Object.entries(CITY_TRAFFIC_LOOPS)) {
  const loopRoads = roadIds.map((id) => CITY_ROADS.find((road) => road.id === id));
  assert.ok(loopRoads.every(Boolean), `${loopName} AI 교통 경로에 없는 도로가 있습니다.`);
  let cursor = loopRoads[0].a;
  for (const road of loopRoads) {
    if (road.a === cursor) cursor = road.b;
    else if (road.b === cursor) cursor = road.a;
    else assert.fail(`${loopName} AI 교통 경로가 연속적으로 연결되지 않습니다.`);
  }
  assert.equal(cursor, loopRoads[0].a, `${loopName} AI 교통 경로가 순환하지 않습니다.`);
}
for (const start of routeStarts) {
  for (const destination of Object.values(DESTINATIONS)) {
    const route = buildRoadRoute(start.x, start.z, destination);
    assert.ok(route.length >= 2, `${destination.name} 경로가 생성되지 않았습니다.`);
    const finish = route.at(-1);
    assert.ok(Math.abs(finish.x - destination.x) < 0.01 && Math.abs(finish.z - destination.z) < 0.01, `${destination.name} 경로가 목적지에서 끝나지 않습니다.`);
    for (let index = 0; index < route.length; index += 1) {
      assert.ok(isPointOnCityRoad(route[index].x, route[index].z, 1.2), `${destination.name} 경로가 도로를 벗어납니다.`);
      if (index > 0) {
        const dx = Math.abs(route[index].x - route[index - 1].x);
        const dz = Math.abs(route[index].z - route[index - 1].z);
        if (dx > 0.01 && dz > 0.01) curvedSegments += 1;
      }
    }
    const usesBridge = route.some((point) => bridgeRoads.some((bridge) => bridge.path.some((bridgePoint) => Math.hypot(point.x - bridgePoint.x, point.z - bridgePoint.z) < 1.5)));
    if (usesBridge) bridgeCrossings += 1;
    const direct = Math.hypot(destination.x - start.x, destination.z - start.z);
    assert.ok(routeLength(route) + 0.01 >= direct, `${destination.name} 도로 거리가 직선거리보다 짧습니다.`);
    assert.ok(navigationForRoute(route, 0).label, `${destination.name} 회전 안내가 없습니다.`);
  }
}
assert.ok(bridgeCrossings > 0, "강을 건너는 배송 경로가 검사되지 않았습니다.");
assert.ok(curvedSegments > 20, "도시 경로가 다시 직사각형 격자로 단순화되었습니다.");

assert.ok(idiomQuizData.length >= 50, "사자성어 문항이 50개보다 적습니다.");
assert.equal(new Set(idiomQuizData.map((item) => item.korean)).size, idiomQuizData.length, "사자성어가 중복되었습니다.");
assert.ok(idiomQuizData.every((item) => item.hanja && item.korean && item.meaning), "빈 사자성어 문항이 있습니다.");

const assetManifestPath = join(ROOT, "public", "models", "vehicles", "manifest.json");
const assetManifest = JSON.parse(await readFile(assetManifestPath, "utf8"));
assert.equal(Object.keys(assetManifest.vehicles || {}).length, VEHICLES.length, "실차 GLB manifest에 5대 차량이 모두 등록되어야 합니다.");
for (const vehicle of VEHICLES) {
  const asset = assetManifest.vehicles?.[vehicle.id];
  assert.ok(asset?.url, `${vehicle.name} GLB 경로가 manifest에 없습니다.`);
  const glbPath = join(ROOT, "public", asset.url.replace(/^\//, ""));
  const header = await readFile(glbPath);
  assert.ok(header.length > 1024 * 1024, `${vehicle.name} GLB 파일 크기가 비정상적으로 작습니다.`);
  assert.equal(header.subarray(0, 4).toString("ascii"), "glTF", `${vehicle.name}은 GLB 파일이 아닙니다.`);
  assert.equal(header.readUInt32LE(4), 2, `${vehicle.name} GLB 버전이 2가 아닙니다.`);
}

console.log(`데이터 점검 완료: 미션 ${MISSIONS.length}개, 배송지 ${Object.keys(DESTINATIONS).length}곳, 자유형 경로 ${routeStarts.length * Object.keys(DESTINATIONS).length}개, 다리 경로 ${bridgeCrossings}개, 곡선 구간 ${curvedSegments}개, 사자성어 ${idiomQuizData.length}개, 실차 GLB ${VEHICLES.length}대`);
