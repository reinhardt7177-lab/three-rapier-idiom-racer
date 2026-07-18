import assert from "node:assert/strict";
import { CITY_HALF, CITY_NODES, CITY_ROADS, CITY_SCENERY_HALF, CITY_SKYLINE_MAX_RADIUS, CITY_TRAFFIC_LOOPS, DESTINATION_NODES, closestRoadPoint, findRoadSurfaceConflicts, findUnmodeledRoadCrossings, isPointOnCityRoad, terrainHeightAt } from "../src/city-map.js";
import { buildCityBuildingPlans, buildCityLandmarkClearings } from "../src/city-layout.js";
import { DECALS, DESTINATIONS, MAX_WORKSHOP_LEVEL, PAINTS, TOPPERS, VEHICLES, WHEELS, workshopPrice } from "../src/game-data.js";
import { idiomQuizData } from "../src/idiom-quiz-data.js";
import { WORLD_SPEED_TO_KMH, buildRoadRoute, navigationForRoute, routeLength } from "../src/create-delivery-runtime.js";
import { RANKS, generateContracts, rankForXp } from "../src/contracts.js";
import { LEARNING_PACKS, makeQuestion } from "../src/learning-packs.js";


function assertUnique(items, label) {
  const ids = items.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, `${label} ID가 중복되었습니다.`);
}

assertUnique(PAINTS, "페인트");
assertUnique(WHEELS, "바퀴");
assertUnique(TOPPERS, "지붕 장식");
assertUnique(DECALS, "스티커");
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

// 절차 생성 계약 전수 검사: 등급 5단계 × 시드 8개 × 3장 = 120장을 검증한다.
let contractCount = 0;
for (let rankIndex = 0; rankIndex < RANKS.length; rankIndex += 1) {
  for (const seed of [3, 7, 42, 99, 1234, 5678, 24680, 99999]) {
    for (const contract of generateContracts(seed, rankIndex)) {
      contractCount += 1;
      assert.ok(contract.stops.length >= 2 && contract.stops.length <= 3, `${contract.id} 배송지 수가 잘못되었습니다.`);
      assert.equal(new Set(contract.stops).size, contract.stops.length, `${contract.id} 배송지가 중복되었습니다.`);
      for (const stop of contract.stops) assert.ok(DESTINATIONS[stop], `${contract.id}의 배송지 ${stop}이 없습니다.`);
      assert.ok(contract.time >= 60 && contract.time <= 480, `${contract.id} 제한시간(${contract.time}s)이 범위를 벗어났습니다.`);
      assert.ok(contract.reward > 0, `${contract.id}에 골드 보상이 없습니다.`);
      if (contract.rival) assert.ok(contract.rival.kmh >= 30 && contract.rival.kmh <= 60, `${contract.id} 라이벌 속도가 비정상입니다.`);
      else assert.ok(contract.bonus?.reward > 0, `${contract.id}에 보너스 보상이 없습니다.`);
      assert.ok(LEARNING_PACKS.some((pack) => pack.id === contract.packId), `${contract.id} 학습팩이 없습니다.`);
      let cursor = { x: 0, z: 72 };
      for (const stopId of contract.stops) {
        const target = DESTINATIONS[stopId];
        const route = buildRoadRoute(cursor.x, cursor.z, target);
        assert.ok(route.length >= 2, `${contract.id}의 ${target.name} 구간에 경로가 없습니다.`);
        cursor = target;
      }
      const requiredKmh = (contract.distance / contract.time) * WORLD_SPEED_TO_KMH;
      assert.ok(requiredKmh >= 25 && requiredKmh <= 110, `${contract.id} 요구 평균속도(${Math.round(requiredKmh)}km/h)가 비정상입니다.`);
    }
  }
}

// 학습팩 3종 출제 검증: 팩별 40문항이 형식과 정답 인덱스를 지키는지 확인한다.
for (const pack of LEARNING_PACKS) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const question = makeQuestion(pack.id, { choiceCount: 3, level: 1 + (attempt % 3) });
    assert.equal(question.packId, pack.id, `${pack.name} 팩 ID가 잘못되었습니다.`);
    assert.ok(question.headline && question.choices.length >= 2, `${pack.name} 문항 형식이 잘못되었습니다.`);
    assert.equal(new Set(question.choices).size, question.choices.length, `${pack.name} 보기가 중복되었습니다.`);
    assert.ok(question.correctIndex >= 0 && question.correctIndex < question.choices.length, `${pack.name} 정답 인덱스가 범위를 벗어났습니다.`);
  }
}
assert.equal(rankForXp(0).index, 0, "XP 0은 루키여야 합니다.");
assert.equal(rankForXp(999999).index, RANKS.length - 1, "최고 XP는 레전드여야 합니다.");

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

// 차량은 GLB 없이 런타임에서 폴리곤으로 직접 조형하므로, 5대 모두 프로필 데이터만 검증합니다.
assert.equal(VEHICLES.length, 5, "차량 라인업은 5대여야 합니다.");
assert.ok(VEHICLES.every((vehicle) => vehicle.id && vehicle.name), "차량 데이터에 빈 항목이 있습니다.");

console.log(`데이터 점검 완료: 생성 계약 ${contractCount}장, 배송지 ${Object.keys(DESTINATIONS).length}곳, 자유형 경로 ${routeStarts.length * Object.keys(DESTINATIONS).length}개, 다리 경로 ${bridgeCrossings}개, 곡선 구간 ${curvedSegments}개, 사자성어 ${idiomQuizData.length}개, 차량 ${VEHICLES.length}대`);
