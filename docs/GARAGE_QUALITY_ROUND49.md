# Garage quality round 49 — adaptive showroom quality

The garage now receives the existing `mobileQuality` profile when it is built:

- Desktop keeps 72 atmospheric motes and three rear light shafts.
- Mobile uses 36 motes and two shafts, preserving depth and accent lighting without paying for the full particle/plane count.
- The same accent, camera, and service-beacon behavior remains active on both profiles.
- No gameplay or Rapier path is changed; this is a render-cost adaptation only.

## Verification

- Garage quality validation: 20 runtime markers / 4 UI markers / 9 curated assets.
- Physics validation: 13 Rapier/vehicle/AI markers.
- CC0 asset validation: 201 files / 7.5 MB.
- Vehicle asset validation: 10 catalog entries.
- Progression validation: 5 finishes / 4 wins / 430 gold / 10 cars unlocked.
- Vite production build passed with only the existing Rapier chunk-size advisory.
