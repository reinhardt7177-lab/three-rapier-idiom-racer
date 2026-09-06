import test from 'node:test';
import assert from 'node:assert/strict';
import { HUD_SETTINGS_KEY, loadHudSettings, saveHudSettings, graphicsBudget, viewLayout, compactCamera, createDriveInput } from '../src/driving/hudSettings.js';

test('tablet settings use light graphics by default, validate values and survive denied storage', () => {
  assert.deepEqual(loadHudSettings(null, true), { quality: 'light', touch: 'auto' });
  assert.equal(loadHudSettings(null, false).quality, 'standard');
  assert.equal(loadHudSettings({ getItem() { return '{bad'; } }, true).quality, 'light');
  assert.deepEqual(loadHudSettings({ getItem() { return '{"version":1,"quality":"ultra","touch":"fake"}'; } }, true), { quality: 'light', touch: 'auto' });
  assert.equal(saveHudSettings({ setItem() { throw Error('denied'); } }, {}), false);
});
test('settings persist only the HUD key and preserve story/garage records', () => {
  const data = new Map([['story', 'keep'], ['garage', 'keep']]);
  const storage = { getItem: k => data.get(k), setItem: (k, v) => data.set(k, v) };
  assert.equal(saveHudSettings(storage, { quality: 'light', touch: 'on', secret: 'not saved' }), true);
  assert.equal(data.get('story'), 'keep'); assert.equal(data.get('garage'), 'keep');
  assert.deepEqual(loadHudSettings(storage), { quality: 'light', touch: 'on' });
  assert.ok(!data.get(HUD_SETTINGS_KEY).includes('secret'));
});
test('tablet portrait and narrow split view get compact camera; landscape keeps the road view', () => {
  for (const [w, h, mode, compact] of [[1280,800,'landscape',false],[800,1280,'portrait',true],[1024,600,'landscape',false],[600,960,'portrait',true],[640,400,'landscape',true]]) {
    assert.equal(viewLayout(w,h), mode); assert.equal(compactCamera(w,h), compact);
  }
});
test('graphics modes bound pixel fill and shadow size even on a high-DPR tablet', () => {
  for (const quality of ['light','standard']) for (const [w,h] of [[1280,800],[2560,1600],[800,1280]]) {
    const b = graphicsBudget(quality,w,h,3);
    assert.ok(w*h*b.ratio**2 <= (quality==='light'?1800000:3200000)+1);
    assert.equal(b.shadowSize, quality==='light'?1024:2048);
    assert.ok(b.ratio <= (quality==='light'?1:1.5));
  }
});
test('independent fingers support gas+steering and releasing one finger never cancels another', () => {
  const input = createDriveInput();
  input.pointer(1,'KeyW',true); input.pointer(2,'KeyA',true); input.pointer(3,'KeyW',true);
  assert.ok(input.has('KeyW') && input.has('KeyA'));
  input.pointer(1,'KeyW',false); assert.ok(input.has('KeyW'));
  input.pointer(2,'KeyA',false); assert.ok(!input.has('KeyA'));
  input.key('KeyD',true); input.clear(); assert.ok(!input.has('KeyW','KeyA','KeyD'));
  input.pointer(3,'KeyW',false); assert.ok(!input.has('KeyW'));
});
