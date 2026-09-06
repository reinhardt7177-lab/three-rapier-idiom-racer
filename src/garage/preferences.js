export const PREFERENCE_KEY = 'mumu.garage.preferences.v1';
export const PAINT_COLORS = Object.freeze([
  ['#286963', '항구 청록'], ['#b34d31', '테라코타'], ['#d5cbb5', '아이보리'], ['#404b5e', '슬레이트'],
]);
export const DEFAULT_PREFERENCES = Object.freeze({ version: 1, color: '#286963', warm: true, wet: true, shutterOpen: true, motion: true });

export function normalizePreferences(value, reducedMotion = false) {
  const defaults = { ...DEFAULT_PREFERENCES, motion: !reducedMotion };
  if (!value || value.version !== 1 || Array.isArray(value)) return defaults;
  const result = { ...defaults };
  if (PAINT_COLORS.some(([color]) => color === value.color)) result.color = value.color;
  for (const key of ['warm', 'wet', 'shutterOpen', 'motion']) if (typeof value[key] === 'boolean') result[key] = value[key];
  return result;
}

export function loadPreferences(storage, reducedMotion = false) {
  try { return normalizePreferences(JSON.parse(storage.getItem(PREFERENCE_KEY)), reducedMotion); }
  catch { return normalizePreferences(null, reducedMotion); }
}

export function savePreferences(storage, value) {
  try { storage.setItem(PREFERENCE_KEY, JSON.stringify(normalizePreferences(value))); return true; }
  catch { return false; }
}
