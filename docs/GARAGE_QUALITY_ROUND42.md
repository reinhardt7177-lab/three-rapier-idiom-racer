# Garage quality round 42 — showroom light shafts

The bay now has a restrained depth layer behind the hero vehicle:

- Three low-opacity, additive light shafts descend from the rear ceiling plane.
- Shafts drift by only 0.03 radians and pulse inside a narrow opacity band, so they read as atmospheric light rather than UI noise.
- SERVICE mode receives a small 12% lift; reduced-motion mode still keeps the existing showroom motion limits.
- The effect uses one shared 128×512 CanvasTexture and three planes, avoiding new external assets or a measurable geometry spike.

## Verification

- Garage quality validation: 10 runtime markers / 4 UI markers / 5 curated assets.
- CC0 asset validation: 201 files / 7.5 MB.
- Vehicle asset validation: 10 catalog entries.
- Progression validation: 5 finishes / 4 wins / 430 gold / 10 cars unlocked.
- Vite production build passed with the existing Rapier chunk-size advisory only.
