import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PREFERENCES, PREFERENCE_KEY, normalizePreferences, loadPreferences, savePreferences } from '../src/garage/preferences.js';

test('unknown versions and malformed fields use safe defaults', () => {
  assert.deepEqual(normalizePreferences({ version: 99, color: '#ffffff' }), { ...DEFAULT_PREFERENCES });
  const result = normalizePreferences({ version: 1, color: 'red', warm: 'false', wet: false, motion: false, shutterOpen: 0 });
  assert.equal(result.color, DEFAULT_PREFERENCES.color); assert.equal(result.warm, true);
  assert.equal(result.wet, false); assert.equal(result.motion, false); assert.equal(result.shutterOpen, true);
});
test('first visit honors reduced motion; user preference is retained', () => {
  assert.equal(normalizePreferences(null, true).motion, false);
  assert.equal(normalizePreferences({ version: 1, motion: true }, true).motion, true);
});
test('unavailable or corrupt storage never blocks startup', () => {
  assert.deepEqual(loadPreferences({ getItem: () => '{broken' }), { ...DEFAULT_PREFERENCES });
  assert.deepEqual(loadPreferences({ getItem: () => { throw new Error('denied'); } }), { ...DEFAULT_PREFERENCES });
  assert.equal(savePreferences({ setItem: () => { throw new Error('denied'); } }, DEFAULT_PREFERENCES), false);
});
test('writes only its versioned key and preserves unrelated records', () => {
  const values = new Map([['legacy-race', 'keep']]);
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.equal(savePreferences(storage, { ...DEFAULT_PREFERENCES, color: '#b34d31', shutterOpen: false }), true);
  assert.equal(values.get('legacy-race'), 'keep'); assert.equal(values.size, 2);
  assert.equal(loadPreferences(storage).color, '#b34d31');
  assert.equal(JSON.parse(values.get(PREFERENCE_KEY)).shutterOpen, false);
});
