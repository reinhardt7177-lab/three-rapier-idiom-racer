import { CITY_DISTRICTS, CITY_HALF, CITY_NODES, closestRoadPoint, distanceToRiver, terrainHeightAt } from "./city-map.js";

export function citySeed(seed, salt = 0) {
  const value = Math.sin(seed * 91.127 + salt * 17.31) * 43758.5453;
  return value - Math.floor(value);
}

export function buildCityLandmarkClearings(destinations) {
  return [
    ...Object.values(destinations).map((item) => ({ x: item.landmarkX, z: item.landmarkZ, radius: 20 })),
    // Keep the starting camera, delivery depot and workshop readable even when
    // the authored hub moves. The old fixed (0, 72) clearing let towers grow
    // directly behind the City V2 spawn and cover the chase camera.
    { x: CITY_NODES.hub.x, z: CITY_NODES.hub.z, radius: 82 },
    { x: CITY_NODES.northWest.x, z: CITY_NODES.northWest.z, radius: 22 },
    { x: CITY_NODES.eastCivic.x, z: CITY_NODES.eastCivic.z, radius: 22 },
    { x: CITY_NODES.centerHarbor.x, z: CITY_NODES.centerHarbor.z, radius: 24 }
  ];
}

// The render layer and data checks share this exact plan, so city buildings can
// never regress onto a road simply because a visual implementation changed.
export function buildCityBuildingPlans(landmarkClearings) {
  const plans = [];
  let seed = 7;

  for (const district of CITY_DISTRICTS) {
    let created = 0;
    let attempts = 0;
    while (created < district.count && attempts < district.count * 35) {
      attempts += 1;
      seed += 1;
      const angle = citySeed(seed, 1) * Math.PI * 2;
      const radius = Math.sqrt(citySeed(seed, 2));
      const x = district.x + Math.cos(angle) * district.rx * radius;
      const z = district.z + Math.sin(angle) * district.rz * radius;
      if (Math.abs(x) > CITY_HALF - 10 || Math.abs(z) > CITY_HALF - 10 || distanceToRiver(x, z) < 19) continue;

      const roadHit = closestRoadPoint(x, z);
      if (!roadHit) continue;
      if (landmarkClearings.some((spot) => Math.hypot(x - spot.x, z - spot.z) < spot.radius)) continue;

      const residential = district.id === "residential" || district.id === "river";
      const highRise = district.id === "center" || district.id === "tech" || district.id === "north";
      const width = (residential ? 6 : highRise ? 8.2 : 7) + citySeed(seed, 3) * (residential ? 2.2 : highRise ? 4.3 : 3.2);
      const depth = (residential ? 6 : highRise ? 8.2 : 7) + citySeed(seed, 4) * (residential ? 2.2 : highRise ? 4.3 : 3.2);
      const footprintRadius = Math.hypot(width, depth) * 0.5;
      const roadClearance = roadHit.distance - roadHit.road.width / 2 - footprintRadius;
      if (roadClearance < 4.5) continue;
      if (plans.some((item) => Math.hypot(x - item.x, z - item.z) < footprintRadius + item.footprintRadius + 3)) continue;

      const height = (district.minHeight + citySeed(seed, 5) * (district.maxHeight - district.minHeight)) * (highRise ? 1.38 : 1);
      const segmentStart = roadHit.road.path[roadHit.segmentIndex];
      const segmentEnd = roadHit.road.path[roadHit.segmentIndex + 1];
      const rotation = Math.atan2(segmentEnd.x - segmentStart.x, segmentEnd.z - segmentStart.z) + (citySeed(seed, 6) - 0.5) * 0.16;
      plans.push({
        seed,
        district,
        residential,
        highRise,
        x,
        z,
        width,
        depth,
        footprintRadius,
        height,
        rotation,
        color: district.colors[seed % district.colors.length],
        baseY: terrainHeightAt(x, z),
        roadClearance
      });
      created += 1;
    }
  }

  return plans;
}
