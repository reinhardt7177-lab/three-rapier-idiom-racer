# Garage render fix - round 86

## What was wrong

The procedural fallback shell was left visible after a valid Kenney GLB loaded. The two silhouettes occupied the same bay, so the car looked like a bright, flattened yellow plate and its wheels appeared misaligned.

## Fix

- Valid car GLBs now own the showroom silhouette (`useFallback=false`).
- Single-material GLB meshes are assigned a scalar material instead of a one-item array.
- Body tint is darker and less metallic so the bay lights reveal the chassis shape.
- Garage light caps were tightened to keep yellow and red vehicles from clipping into bloom.

## Verification

- APEX GT: imported GLB silhouette and four wheels visible in the showroom.
- RALLY R: sedan silhouette visible with readable roof, hood and wheel separation.
- Browser console: no error/warning entries after a fresh garage load.
- Race speed and physics checks remain covered by `npm.cmd run check`.
