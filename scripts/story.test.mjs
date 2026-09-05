import test from 'node:test';
import assert from 'node:assert/strict';
import { newStory, startStory, advanceIntro, updateStory, storyHint, loadStory, saveStory, STORY_KEY, STORY_STOP } from '../src/driving/story.js';
const sample = (z, kmh = 50, x = -7.5, contacts = 4) => ({ position: { x, y: .6, z }, kmh, contacts });
function gates() {
  let s = startStory(newStory());
  s = updateStory(s, sample(-651), sample(-649), .02);
  return updateStory(s, sample(-551), sample(-549), .02);
}
test('intro can finish naturally or skip; skip never skips the actual mission', () => {
  assert.equal(advanceIntro(newStory(), 14).phase, 'intro');
  assert.equal(advanceIntro(newStory(), 15).phase, 'drive');
  assert.equal(startStory(newStory()).checkpoint, 0);
  assert.equal(updateStory(newStory(), sample(-651), sample(-649), .02).checkpoint, 0);
});
test('route gates enforce order, direction, road contact and no teleport skipping', () => {
  const s = startStory(newStory());
  assert.equal(updateStory(s, sample(-649), sample(-651), .02).checkpoint, 0);
  assert.equal(updateStory(s, sample(-551), sample(-549), .02).checkpoint, 0);
  assert.equal(updateStory(s, sample(-720), sample(-640), .02).checkpoint, 0);
  assert.equal(updateStory(s, sample(-651), sample(-649, 50, 7), .02).checkpoint, 0);
  assert.equal(updateStory(s, sample(-651), sample(-649, 50, -7.5, 0), .02).checkpoint, 0);
  assert.equal(gates().checkpoint, 2);
});
test('finish requires route gates and two continuous seconds stopped inside the bay', () => {
  const p = sample(STORY_STOP.z, 0); let s = gates();
  assert.equal(updateStory(startStory(newStory()), p, p, 3).phase, 'drive');
  s = updateStory(s, p, p, 1.5); assert.equal(s.phase, 'drive');
  s = updateStory(s, p, sample(STORY_STOP.z, 3), .1); assert.equal(s.stopTime, 0);
  s = updateStory(s, p, sample(STORY_STOP.z, 0, -2.5), 3); assert.equal(s.phase, 'drive');
  s = updateStory(s, p, sample(STORY_STOP.z, 0, -7.5, 0), 3); assert.equal(s.phase, 'drive');
  s = updateStory(s, p, p, 2); assert.equal(s.phase, 'complete');
  assert.equal(updateStory(s, p, p, 3), s);
});
test('overshooting supplies a recovery hint and a fresh mission clears progress', () => {
  assert.match(storyHint(gates(), sample(-430)).objective, /돌아오기/);
  assert.deepEqual(newStory(), { phase: 'intro', introTime: 0, checkpoint: 0, stopTime: 0, saved: null });
});
test('story saves only its own versioned key, idempotently; invalid/blocked storage is safe', () => {
  const data = new Map([['garage', 'unchanged']]);
  const storage = { getItem: k => data.get(k), setItem: (k, v) => data.set(k, v) };
  assert.equal(loadStory(storage), false); assert.equal(saveStory(storage), true); assert.equal(saveStory(storage), true);
  assert.equal(loadStory(storage), true); assert.equal(data.get('garage'), 'unchanged'); assert.equal(data.size, 2);
  storage.setItem(STORY_KEY, '{broken'); assert.equal(loadStory(storage), false);
  storage.setItem(STORY_KEY, JSON.stringify({ version: 99, firstCallComplete: true })); assert.equal(loadStory(storage), false);
  assert.equal(saveStory({ setItem() { throw Error('blocked'); } }), false);
});
