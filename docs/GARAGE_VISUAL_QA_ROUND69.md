# Garage visual QA · Round 69

## Scope

- Revalidated the live local build at `http://localhost:5173/` in the in-app browser.
- Checked garage orbit/front/service views, circuit selection, race countdown and live race.
- Checked browser warnings and errors after the complete flow.

## Defect found and fixed

The first visual capture showed only four floating wheels in the showroom. The Kenney GLB chassis was not reliable in the browser render path even though the asset and wheel nodes loaded. Vehicle loading now:

- normalizes car materials to opaque, double-sided, depth-writing materials;
- treats the color map as optional so a late texture cannot make the chassis disappear;
- keeps a lightweight procedural chassis readability layer underneath the catalog GLB;
- preserves the chassis during asset replacement while retaining Rapier wheel references.

This makes every selected machine readable in the garage and race camera even when an individual GLB texture is unavailable.

## Browser evidence

- Garage: selected APEX GT has visible body, cockpit, wings, wheels, glow and service lighting.
- Circuit select: all three circuits render with the themed preview scene.
- Countdown: start gantry, five start lights, sector strip and car grid render.
- Live race: player and AI chassis remain visible, HUD updates time/lap/sector/speed.
- Browser diagnostics: no warning or error entries after reload and the full flow.

## Automated checks

```text
npm.cmd run check
CC0 asset validation passed: 201 files / 7.5 MB
Vehicle asset validation passed: 10 catalog entries
Garage quality validation passed: 35 runtime markers / 9 UI markers / 9 curated assets
Physics validation passed: 15 Rapier/vehicle/AI markers
Circuit quality validation passed: 30 circuit markers / 10 district assets
Visual quality validation passed: 9 runtime markers / 6 UI markers / 3 tracks / 10 curated GLBs
Vite build passed (Rapier chunk advisory remains ~2.85 MB)
```

## Follow-up

The next polish pass can replace the readability fallback with per-vehicle body materials once the Kenney body texture pipeline is audited per asset. Gameplay, physics, circuit dressing and the current browser flow are already operational.
