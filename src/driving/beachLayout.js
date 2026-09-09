import { COAST_ROADS, COAST_PADS, FORK, offsetPoint, nearestRoad } from './coastRoute.js';

// Road layout/collision never changes for this art pass. Keep props outside lanes,
// junction approaches and turnaround pads, including their full crown envelope.
export function beachPropClear(q, radius = 5) {
  const near = nearestRoad(q);
  return near.distance > near.halfWidth + radius + 3
    && Math.hypot(q.x - FORK.x, q.z - FORK.z) > 55 + radius
    && COAST_PADS.every(p => Math.hypot(q.x - p.x, q.z - p.z) > p.radius + radius + 5);
}
export function coastPalmLayout() {
  const palms = [];
  for (const [id, points] of Object.entries(COAST_ROADS)) {
    let lastS = -100;
    for (const p of points) {
      if (p.s - lastS < (id === 'harbor' && p.s < 420 ? 27 : 34)) continue;
      lastS = p.s;
      for (const side of [1, -1]) {
        if (side === -1 && id === 'harbor' && p.s < 430) continue; // Existing frontage footprint.
        const q = offsetPoint(p, side * (p.halfWidth + 11));
        if (!beachPropClear(q)) continue;
        palms.push({ ...q, height: 7.4 + (palms.length % 4) * .6, yaw: palms.length * 2.4 });
      }
    }
  }
  return palms;
}
