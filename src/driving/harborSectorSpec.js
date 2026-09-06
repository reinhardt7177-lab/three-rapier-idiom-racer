// Shared visual / collision bounds. Road remains x=-10..10, clear of hard props.
export const HARBOR_SECTOR = Object.freeze({ start: -790, end: -390, wallX: 14.8, wallHalfWidth: .45, wallHeight: 1.1 });
export function harborWallColliders() {
  return [-1, 1].map(side => ({ x: side * HARBOR_SECTOR.wallX, y: HARBOR_SECTOR.wallHeight / 2, z: (HARBOR_SECTOR.start + HARBOR_SECTOR.end) / 2,
    hx: HARBOR_SECTOR.wallHalfWidth, hy: HARBOR_SECTOR.wallHeight / 2, hz: (HARBOR_SECTOR.end - HARBOR_SECTOR.start) / 2 }));
}
export function harborPavementColliders() {
  const z = (HARBOR_SECTOR.start + HARBOR_SECTOR.end) / 2, hz = (HARBOR_SECTOR.end - HARBOR_SECTOR.start) / 2;
  return [-1, 1].flatMap(side => [
    { x: side * 10.45, y: .075, z, hx: .19, hy: .075, hz },
    { x: side * 12.6, y: .02, z, hx: 1.85, hy: .11, hz },
  ]);
}
