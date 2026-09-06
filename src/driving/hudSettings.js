export const HUD_SETTINGS_KEY = 'mumu.coast.hud.v1';
export const viewLayout = (width, height) => width < height ? 'portrait' : 'landscape';
export const compactCamera = (width, height) => viewLayout(width, height) === 'portrait' || width < 740;
export function loadHudSettings(storage, touch = false) {
  const defaults = { quality: touch ? 'light' : 'standard', touch: 'auto' };
  try {
    const raw = JSON.parse(storage?.getItem(HUD_SETTINGS_KEY));
    if (raw?.version !== 1) return defaults;
    return { quality: ['light', 'standard'].includes(raw.quality) ? raw.quality : defaults.quality, touch: ['auto', 'on', 'off'].includes(raw.touch) ? raw.touch : 'auto' };
  } catch { return defaults; }
}
export function saveHudSettings(storage, value) {
  try { storage.setItem(HUD_SETTINGS_KEY, JSON.stringify({ version: 1, quality: value.quality === 'light' ? 'light' : 'standard', touch: ['on', 'off'].includes(value.touch) ? value.touch : 'auto' })); return true; } catch { return false; }
}
export function graphicsBudget(quality, width, height, dpr) {
  const light = quality === 'light';
  const pixels = light ? 1800000 : 3200000;
  return { ratio: Math.min(Math.max(.5, dpr || 1), light ? 1 : 1.5, Math.sqrt(pixels / Math.max(1, width * height))), shadowSize: light ? 1024 : 2048 };
}
export function createDriveInput() {
  const keys = new Set(), pointers = new Map();
  return {
    key(code, down) { if (down) keys.add(code); else keys.delete(code); },
    pointer(id, code, down) { if (down) pointers.set(id, code); else pointers.delete(id); },
    has(...codes) { return codes.some(c => keys.has(c) || [...pointers.values()].includes(c)); },
    clear() { keys.clear(); pointers.clear(); },
  };
}
