# Garage quality round 47 — eased prop streaming

Asynchronous GLB props now enter the scene through a short ease-out scale animation instead of popping from zero to full size:

- `loadProp` records each clone's target scale and spawn time in `scene.userData.spawnables`.
- The existing ambient animation loop advances and removes completed spawnables.
- The same behavior covers garage dressing and trackside props, and pending loads stop safely when the runtime is destroyed.
- The implementation adds no timers per prop and uses a single short-lived array, keeping the steady-state cost at zero.

## Verification

- Garage quality validation: 17 runtime markers / 4 UI markers / 9 curated assets.
- CC0 asset validation: 201 files / 7.5 MB.
- Vehicle asset validation: 10 catalog entries.
- Progression validation: 5 finishes / 4 wins / 430 gold / 10 cars unlocked.
- Vite production build passed with only the existing Rapier chunk-size advisory.
