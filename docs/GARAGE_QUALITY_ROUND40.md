# Garage quality round 40 — cinematic light pools and visual regression gate

## Visual pass

- Added two soft, additive headlight pools to the hero turntable floor.
- The pools follow the current showroom camera intent and brighten slightly in SERVICE mode.
- The pools use a single shared CanvasTexture and simple planes, keeping the effect inexpensive on mobile.
- The existing contact shadow, reflection, accent ring, and car-specific tint remain layered underneath instead of being replaced.

## Regression gate

`scripts/check-garage-quality.mjs` now verifies the showroom runtime markers, reduced-motion/UI safeguards, and five curated Retro Urban / wheel assets. It is part of `npm run check`, so missing garage polish cannot silently ship.

## Verification

- Garage quality validation: 9 runtime markers / 4 UI markers / 5 curated assets.
- CC0 asset validation: 201 files / 7.5 MB.
- Vehicle asset validation: 10 catalog entries.
- Progression validation: 5 finishes / 4 wins / 430 gold / 10 cars unlocked.
- Vite production build passed; the only warning is the existing Rapier chunk-size advisory.
