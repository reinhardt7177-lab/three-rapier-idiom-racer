// Metres; +Z is outbound at the harbor. These samples own graphics AND collision.
export const COAST_START = Object.freeze({ x: -3.5, y: .8, z: -720 });
// Camera faces +Z at the harbor, so driver-right (-X) must be map-right too.
export function coastMapPoint(p) { return { x: -p.x, y: -p.z - 500 }; }
export const FORK = Object.freeze({ x: -150, z: 155 });
const curves = {
  harbor: [
    [[0, -810], [0, -680], [0, -510], [0, -390]],
    [[0, -390], [0, -250], [-150, -200], [-150, -60]],
    [[-150, -60], [-150, 10], [-150, 85], [-150, 155]],
  ],
  lookout: [[[-150, 155], [-150, 230], [-260, 285], [-310, 285]]],
  rest: [[[-150, 155], [-150, 220], [-50, 285], [30, 285]]],
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function sampleCurves(segments, id) {
  const points = []; let s = 0;
  for (const c of segments) {
    // A cubic derivative is bounded by 3 * the longest control edge.
    // Average arc length alone can leave overlong segments near a tangent handle.
    const count = Math.ceil(Math.max(...c.slice(1).map((p, i) => Math.hypot(p[0] - c[i][0], p[1] - c[i][1]))));
    for (let i = points.length ? 1 : 0; i <= count; i++) {
      const t = i / count, u = 1 - t;
      const coordinate = axis => u ** 3 * c[0][axis] + 3 * u * u * t * c[1][axis] + 3 * u * t * t * c[2][axis] + t ** 3 * c[3][axis];
      const derivative = axis => 3 * u * u * (c[1][axis] - c[0][axis]) + 6 * u * t * (c[2][axis] - c[1][axis]) + 3 * t * t * (c[3][axis] - c[2][axis]);
      const x = coordinate(0), z = coordinate(1), dx = derivative(0), dz = derivative(1), length = Math.hypot(dx, dz);
      if (points.length) s += distance({ x, z }, points.at(-1));
      const taper = Math.min(1, Math.max(0, (s - 420) / 170));
      points.push({ x, z, tx: dx / length, tz: dz / length, s, halfWidth: id === 'harbor' ? 10 - 4 * taper * taper * (3 - 2 * taper) : 6, id });
    }
  }
  return points;
}
export const COAST_ROADS = Object.fromEntries(Object.entries(curves).map(([id, c]) => [id, sampleCurves(c, id)]));
export const COAST_PADS = [
  { ...COAST_ROADS.lookout.at(-1), radius: 27, label: '바람곶 전망대' },
  { ...COAST_ROADS.rest.at(-1), radius: 25, label: '솔숲 회차 쉼터' },
  { x: 0, z: -820, radius: 24, tx: 0, tz: -1, id: 'home', label: '항구 회차장' },
];
export function offsetPoint(p, d) { return { x: p.x - p.tz * d, z: p.z + p.tx * d }; }
export function nearestRoad(position, roads = COAST_ROADS) {
  let best = null;
  for (const [id, points] of Object.entries(roads)) for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((position.x - a.x) * dx + (position.z - a.z) * dz) / l2));
    const x = a.x + dx * t, z = a.z + dz * t, d = Math.hypot(position.x - x, position.z - z);
    if (!best || d < best.distance) best = { x, z, tx: dx / Math.sqrt(l2), tz: dz / Math.sqrt(l2), halfWidth: a.halfWidth + (b.halfWidth - a.halfWidth) * t, s: a.s + (b.s - a.s) * t, id, index: i, distance: d };
  }
  return best;
}
export function ribbonData(points, left = p => -p.halfWidth, right = p => p.halfWidth, y = 0) {
  const vertices = [], indices = [], uv = [];
  points.forEach((p, i) => {
    for (const d of [left(p), right(p)]) { const q = offsetPoint(p, d); vertices.push(q.x, y, q.z); uv.push(d / 6, p.s / 6); }
    if (i < points.length - 1) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
  });
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices), uv: new Float32Array(uv) };
}
export function padData(pad, extra = 0, y = 0) {
  const vertices = [pad.x, y, pad.z], indices = [], uv = [0, 0];
  for (let i = 0; i <= 64; i++) { const a = i * Math.PI / 32, x = Math.cos(a) * (pad.radius + extra), z = Math.sin(a) * (pad.radius + extra); vertices.push(pad.x + x, y, pad.z + z); uv.push(x / 6, z / 6); if (i < 64) indices.push(0, i + 2, i + 1); }
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices), uv: new Float32Array(uv) };
}
export const COAST_SURFACES = [...Object.values(COAST_ROADS).map(p => ribbonData(p, p => -p.halfWidth - 2.5, p => p.halfWidth + 2.5)), ...COAST_PADS.map(p => padData(p))];
function makeBarriers() {
  const entries = [];
  function segment(a, b) {
    const x = (a.x + b.x) / 2, z = (a.z + b.z) / 2;
    entries.push({ x, y: .55, z, hx: .22, hy: .55, hz: distance(a, b) / 2 + .08, yaw: Math.atan2(b.x - a.x, b.z - a.z) });
  }
  for (const points of Object.values(COAST_ROADS)) for (const side of [-1, 1]) for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    if (a.id === 'harbor' && a.z < -388) continue; // Existing masonry is kept in the harbor.
    const pa = offsetPoint(a, side * (a.halfWidth + 2.4)), pb = offsetPoint(b, side * (b.halfWidth + 2.4));
    const mid = { x: (pa.x + pb.x) / 2, z: (pa.z + pb.z) / 2 };
    if (COAST_PADS.some(p => distance(p, mid) < p.radius + 1) || distance(mid, FORK) < 40) continue;
    // No rail may cross another branch's drivable surface.
    const others = Object.fromEntries(Object.entries(COAST_ROADS).filter(([id]) => id !== a.id));
    const near = nearestRoad(mid, others);
    if (near && near.distance < near.halfWidth + 3) continue;
    segment(pa, pb);
  }
  for (const pad of COAST_PADS) for (let i = 0; i < 64; i++) {
    const a = i * Math.PI / 32, b = (i + 1) * Math.PI / 32, r = pad.radius;
    const pa = { x: pad.x + Math.cos(a) * r, z: pad.z + Math.sin(a) * r }, pb = { x: pad.x + Math.cos(b) * r, z: pad.z + Math.sin(b) * r };
    const near = nearestRoad({ x: (pa.x + pb.x) / 2, z: (pa.z + pb.z) / 2 });
    if (near.distance < near.halfWidth + 3) continue; // Open entry throat, not a sealed circle.
    segment(pa, pb);
  }
  return entries;
}
export const COAST_BARRIERS = makeBarriers();
export function coastStatus(snapshot, visit = { lookout: false, returned: false }) {
  const p = snapshot.position, near = nearestRoad(p);
  const stopped = snapshot.kmh < 4 && snapshot.contacts >= 3;
  const lookout = visit.lookout || (distance(p, COAST_PADS[0]) < 22 && stopped);
  const returned = visit.returned || (lookout && distance(p, COAST_START) < 20 && stopped);
  const area = distance(p, COAST_PADS[0]) < 32 ? '바람곶 전망대' : distance(p, COAST_PADS[1]) < 30 ? '솔숲 회차 쉼터' : distance(p, FORK) < 65 ? '해안 갈림길' : near.id === 'harbor' && near.s < 430 ? '항만대로' : '바람곶 해안길';
  return { lookout, returned, area, road: near.id, offRoad: near.distance > near.halfWidth + 3 && !COAST_PADS.some(pad => distance(pad, p) < pad.radius), distance: Math.round(distance(p, lookout ? COAST_START : COAST_PADS[0])) };
}
// A test driver follows these lane-centre samples using normal forces/steering.
// The game itself has no autopilot. Endpoint arc uses the real paved turning area.
export function tourWaypoints(branch = 'lookout') {
  const path = [...COAST_ROADS.harbor.filter(p => p.z >= -720), ...COAST_ROADS[branch].slice(1)];
  const end = path.at(-1), forward = { x: end.tx, z: end.tz }, right = { x: -end.tz, z: end.tx };
  const out = path.map(p => ({ ...offsetPoint(p, 3.5), speed: p.s < 330 && p.id === 'harbor' ? 65 : 44 }));
  // Arc is inside a 25+ m plaza. Approach widens progressively, never clips a rail.
  for (let i = Math.max(0, out.length - 10); i < out.length; i++) out[i] = { ...offsetPoint(path[i], 3.5 + 5.5 * (i - (out.length - 10)) / 9), speed: 22 };
  for (let i = 1; i <= 32; i++) { const a = i * Math.PI / 32; out.push({ x: end.x + right.x * 9 * Math.cos(a) + forward.x * 9 * Math.sin(a), z: end.z + right.z * 9 * Math.cos(a) + forward.z * 9 * Math.sin(a), speed: 20 }); }
  const back = path.slice().reverse().map((p, i) => ({ ...offsetPoint(p, -(i < 10 ? 9 - 5.5 * i / 9 : 3.5)), speed: i < 15 ? 22 : 44 }));
  return [...out, ...back.slice(1)];
}
