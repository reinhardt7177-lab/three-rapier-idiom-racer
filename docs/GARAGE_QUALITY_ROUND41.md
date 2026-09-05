# Garage quality round 41 — vehicle lamp fidelity and locked-state UX

## Vehicle presentation

- Imported meshes whose name/material identifies a headlight, lamp, taillight, or brake light now receive cloned emissive materials.
- Headlamps use a warm-white emission; brake/taillight meshes use the circuit red. Existing texture maps remain attached.
- Wheel, tire, glass, and window materials stay excluded from the body tint pass.

## Garage controls

- Locked collection slots are now non-interactive at the CSS layer in addition to the existing `chooseCar` guard. This prevents dead clicks while preserving the visible unlock state.

## Verification

- `npm run check` passed, including the garage quality gate.
- CC0 asset validation: 201 files / 7.5 MB.
- Vehicle asset validation: 10 catalog entries.
- Progression validation: 5 finishes / 4 wins / 430 gold / 10 cars unlocked.
- Vite production build passed; the existing Rapier chunk-size advisory remains.
