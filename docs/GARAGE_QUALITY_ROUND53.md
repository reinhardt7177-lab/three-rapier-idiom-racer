# Garage quality round 53 — adaptive soft shadows

Desktop rendering now uses `THREE.PCFSoftShadowMap` for smoother car/contact and prop shadows. Mobile keeps `THREE.PCFShadowMap` to protect the frame budget while retaining the same shadow coverage.

## Verification

- Garage quality validation: 27 runtime markers / 4 UI markers / 9 curated assets.
- Physics validation: 13 Rapier/vehicle/AI markers.
- CC0 asset validation: 201 files / 7.5 MB.
- Vehicle asset validation: 10 catalog entries.
- Progression validation: 5 finishes / 4 wins / 430 gold / 10 cars unlocked.
- Vite production build passed with only the existing Rapier chunk-size advisory.
