# Garage quality round 46 — rotating service beacon

BAY 02 now has a small animated service beacon rather than a static signal stack:

- A low-poly mast, housing, lens, rotor bar, and point light are grouped as one reusable prop.
- The existing ambient animation loop rotates the rotor and pulses the lens/light at a restrained rate.
- The beacon is placed outside the hero car's focus path and adds a clear “service active” cue to the inspection view.
- The geometry is local and lightweight; no external asset or new texture was introduced.

## Verification

- Garage quality validation: 16 runtime markers / 4 UI markers / 9 curated assets.
- CC0 asset validation: 201 files / 7.5 MB.
- Vehicle asset validation: 10 catalog entries.
- Progression validation: 5 finishes / 4 wins / 430 gold / 10 cars unlocked.
- Vite production build passed with only the existing Rapier chunk-size advisory.
