# Physics quality round 48 — Rapier regression gate

Added `scripts/check-physics.mjs` to the main `npm run check` chain. It verifies the current runtime still contains:

- Rapier dynamic import and CCD-enabled rigid bodies
- Track and barrier colliders
- Vehicle controller and four-wheel setup
- Steering, engine force, braking, friction slip, side friction, and suspension tuning
- Rival creation through the same vehicle path and `applyDrive` handling function

## Verification

- Physics validation: 13 Rapier/vehicle/AI markers.
- Garage quality validation: 17 runtime markers / 4 UI markers / 9 curated assets.
- CC0 asset validation: 201 files / 7.5 MB.
- Vehicle asset validation: 10 catalog entries.
- Progression validation: 5 finishes / 4 wins / 430 gold / 10 cars unlocked.
- Vite production build passed with only the existing Rapier chunk-size advisory.
