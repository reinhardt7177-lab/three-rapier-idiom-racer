# Garage quality round 51 — service lamp breathing

Imported vehicle lamp nodes are now retained separately from the wheel audit:

- Headlight/brake/taillight meshes are collected as `assetLamps` during GLB replacement.
- In SERVICE mode only, their emissive intensity receives a restrained pulse tied to the showroom rhythm.
- FRONT, ORBIT, and all race states keep a stable lamp intensity; no gameplay lighting or Rapier state changes.

## Verification

- Garage quality validation: 26 runtime markers / 4 UI markers / 9 curated assets.
- Physics validation: 13 Rapier/vehicle/AI markers.
- CC0 asset validation: 201 files / 7.5 MB.
- Vehicle asset validation: 10 catalog entries.
- Progression validation: 5 finishes / 4 wins / 430 gold / 10 cars unlocked.
- Vite production build passed with only the existing Rapier chunk-size advisory.
