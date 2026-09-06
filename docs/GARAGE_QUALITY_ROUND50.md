# Garage quality round 50 — renderer pipeline gate

The garage quality check now guards the renderer fundamentals that make the scene read correctly:

- shadow map enabled
- sRGB output color space
- ACES filmic tone mapping
- device-pixel-ratio adaptation
- Unreal Bloom post-processing

This prevents future refactors from keeping the garage geometry while silently degrading the final image pipeline.

## Verification

- Garage quality validation: 25 runtime markers / 4 UI markers / 9 curated assets.
- Physics validation: 13 Rapier/vehicle/AI markers.
- CC0 asset validation: 201 files / 7.5 MB.
- Vehicle asset validation: 10 catalog entries.
- Progression validation: 5 finishes / 4 wins / 430 gold / 10 cars unlocked.
- Vite production build passed with only the existing Rapier chunk-size advisory.
