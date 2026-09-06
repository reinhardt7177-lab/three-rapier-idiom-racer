# Garage quality round 39 — service wheel articulation

The SERVICE showroom view now reads as an active inspection bay instead of a static car preview.

## What changed

- Each imported wheel lazily captures its original local `rotation.y` the first time the showroom renders it.
- SERVICE mode applies a restrained ±0.075 rad micro-steer oscillation to those wheel nodes.
- FRONT and ORBIT modes always return to the captured base rotation.
- The animation is scoped to the garage mesh only; Rapier bodies, AI steering, collision, and race input are untouched.

## Verification

- `npm run check` passed.
- CC0 asset validation: 201 files / 7.5 MB.
- Vehicle asset validation: 10 catalog entries, all with wheel nodes.
- Progression validation: 5 finishes / 4 wins / 430 gold / 10 cars unlocked.
- Vite production build passed; only the existing Rapier chunk-size warning remains.
