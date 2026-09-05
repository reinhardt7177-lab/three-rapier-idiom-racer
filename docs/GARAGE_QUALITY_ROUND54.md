# Garage quality round 54 — PBR vehicle surface pass

Non-wheel, non-glass vehicle materials now receive a restrained showroom PBR pass when cloned:

- minimum metalness keeps painted bodywork readable under the garage lights
- roughness is capped for a cleaner controlled highlight
- Physical materials receive a subtle clearcoat and tighter clearcoat roughness
- wheel, tire, glass, window, and lamp exceptions remain intact

## Verification

- Garage quality validation: 29 runtime markers / 4 UI markers / 9 curated assets.
- Physics validation: 13 Rapier/vehicle/AI markers.
- CC0 asset validation: 201 files / 7.5 MB.
- Vehicle asset validation: 10 catalog entries.
- Progression validation: 5 finishes / 4 wins / 430 gold / 10 cars unlocked.
- Vite production build passed with only the existing Rapier chunk-size advisory.
