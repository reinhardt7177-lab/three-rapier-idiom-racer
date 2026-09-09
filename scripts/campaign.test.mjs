import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGN_KEY, CHAPTERS, CHAPTER_ONE, newCampaign, loadCampaign, evaluateChapterRun, completeChapter, chapterHint } from '../src/campaign/campaign.js';

const run = (time = 40, extra = {}) => ({ phase: 'complete', valid: true, gate: 3, elapsed: time, splits: [time / 3, time * 2 / 3, time], ...extra });
const memory = () => {
  const map = new Map();
  return { map, writes: 0, getItem: key => map.get(key) ?? null, setItem(key, value) { this.writes++; map.set(key, value); } };
};

test('six chapters honestly expose only the first playable record challenge', () => {
  assert.equal(CHAPTERS.length, 6);
  assert.equal(new Set(CHAPTERS.map(chapter => chapter.id)).size, 6);
  assert.deepEqual(CHAPTERS.filter(chapter => chapter.playable), [CHAPTER_ONE]);
  assert.match(CHAPTER_ONE.opponent, /AI 차량 없이/);
  assert.equal(CHAPTER_ONE.targets.standard, 45);
  assert.equal(CHAPTER_ONE.targets.relaxed, 60);
});

test('standard thresholds and elite bonus are inclusive, not automatic completion rewards', () => {
  assert.equal(evaluateChapterRun(run(45)).passed, true);
  assert.equal(evaluateChapterRun(run(45.001)).passed, false);
  assert.equal(evaluateChapterRun(run(36)).medal, 'elite');
  assert.equal(evaluateChapterRun(run(36.001)).medal, 'club');
  assert.equal(evaluateChapterRun(run(50)).target, 45);
});

test('relaxed records remain labelled as assisted and cannot earn an elite medal', () => {
  assert.equal(evaluateChapterRun(run(60), 'relaxed').passed, true);
  assert.equal(evaluateChapterRun(run(60.001), 'relaxed').passed, false);
  assert.equal(evaluateChapterRun(run(30), 'relaxed').medal, 'assisted');
  assert.equal(evaluateChapterRun(run(), 'unknown').passed, false);
});

test('invalid, recovered, paused, incomplete and wrong-route runs cannot award progress', () => {
  const failures = [null, {}, ...['briefing', 'countdown', 'running', 'cooldown', 'paused'].map(phase => run(40, { phase })),
    run(40, { valid: false }), run(40, { valid: 1 }), run(40, { paused: true }),
    run(40, { recoveryUsed: true }), run(40, { recovered: true }), run(40, { teleported: true }),
    run(40, { route: 'other-route' }), run(40, { gate: 2 }), run(40, { gate: '3' })];
  const storage = memory();
  for (const sprint of failures) {
    const result = completeChapter(newCampaign(), sprint, 'standard', storage);
    assert.equal(result.evaluation.passed, false);
    assert.equal(result.profile.license, false);
    assert.equal(result.awarded, false);
  }
  assert.equal(storage.writes, 0);
});

test('exactly three finite increasing splits and an agreeing finish time are mandatory', () => {
  const failures = [run(NaN), run(Infinity), run(0), run(4.9), run(40, { splits: [, 20, 40] }),
    run(40, { splits: [10, 30, 20] }), run(40, { splits: [10, 10, 40] }),
    run(40, { splits: [-1, 20, 40] }), run(40, { splits: [10, 20, 39] }),
    run(40, { splits: [10, NaN, 40] }), run(40, { splits: [10, 20] }),
    run(40, { splits: [10, 20, 30, 40] }), run(40, { splits: ['10', 20, 40] })];
  for (const sprint of failures) assert.equal(evaluateChapterRun(sprint).passed, false);
});

test('one licence only: duplicate result, stale profile, slower retry and new best cannot repeat the award', () => {
  const storage = memory(), initial = newCampaign(), sprint = run(40);
  const first = completeChapter(initial, sprint, 'standard', storage);
  assert.equal(first.awarded, true);
  assert.equal(first.saved, true);
  assert.equal(first.profile.license, true);
  const writes = storage.writes;
  for (const profile of [first.profile, initial]) {
    const repeated = completeChapter(profile, sprint, 'standard', storage);
    assert.equal(repeated.awarded, false);
    assert.equal(repeated.saved, true);
    assert.equal(storage.writes, writes);
  }
  const slower = completeChapter(first.profile, run(43), 'standard', storage);
  assert.equal(slower.profile.chapterOne.time, 40);
  assert.equal(slower.awarded, false);
  const better = completeChapter(slower.profile, run(35), 'standard', storage);
  assert.equal(better.profile.chapterOne.time, 35);
  assert.equal(better.profile.chapterOne.medal, 'elite');
  assert.equal(better.awarded, false);
});

test('failure preserves previous completion and merges a better valid record already in storage', () => {
  const storage = memory();
  const first = completeChapter(newCampaign(), run(43), 'standard', storage);
  const faster = completeChapter(first.profile, run(35), 'standard', storage);
  const failed = completeChapter(first.profile, run(90), 'standard', storage);
  assert.equal(failed.evaluation.passed, false);
  assert.equal(failed.awarded, false);
  assert.equal(failed.saved, true, 'a failed retry does not erase a previously persisted license or invent a save failure');
  assert.deepEqual(failed.profile, faster.profile);
  const tied = completeChapter(newCampaign(), run(35), 'relaxed', storage);
  assert.equal(tied.profile.chapterOne.difficulty, 'standard');
});

test('blocked storage retains earned in-memory progress without repeating a licence on retry', () => {
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  const first = completeChapter(newCampaign(), run(), 'standard', blocked);
  assert.equal(first.saved, false);
  assert.equal(first.awarded, true);
  assert.equal(first.profile.license, true);
  const again = completeChapter(first.profile, run(35), 'standard', blocked);
  assert.equal(again.awarded, false);
  assert.equal(again.profile.chapterOne.time, 35);
  assert.equal(again.saved, false);
  assert.deepEqual(loadCampaign(blocked), newCampaign());
  const silent = { getItem: () => null, setItem() {} };
  assert.equal(completeChapter(newCampaign(), run(), 'standard', silent).saved, false);
});

test('corrupt inputs are rejected, unknown fields are stripped and returned arrays never alias source data', () => {
  const storage = memory();
  for (const value of ['{bad-json', 'null', '[]', '123', JSON.stringify({ ...newCampaign(), license: true }),
    JSON.stringify({ ...newCampaign(), license: true, chapterOne: { time: 40, splits: [10, 30, 20], difficulty: 'standard', medal: 'club' } })]) {
    storage.setItem(CAMPAIGN_KEY, value);
    assert.deepEqual(loadCampaign(storage), newCampaign());
  }
  storage.setItem('mumu.coast.sprint.v1', 'sprint-kept');
  storage.setItem('mumu.story.v1', 'story-kept');
  const sprint = run(), result = completeChapter(newCampaign(), sprint, 'standard', storage);
  sprint.splits[0] = 999;
  assert.notEqual(result.profile.chapterOne.splits[0], 999);
  storage.setItem(CAMPAIGN_KEY, JSON.stringify({ ...result.profile, gold: 999, secret: 'do-not-copy', chapterOne: { ...result.profile.chapterOne, executable: 'do-not-copy' } }));
  assert.deepEqual(loadCampaign(storage), result.profile);
  assert.equal(storage.getItem('mumu.coast.sprint.v1'), 'sprint-kept');
  assert.equal(storage.getItem('mumu.story.v1'), 'story-kept');
});

test('future, legacy and mismatched-route records are never overwritten by this campaign version', () => {
  for (const changed of [{ version: 2 }, { version: 0 }, { route: 'future-route' }]) {
    const storage = memory(), raw = JSON.stringify({ ...newCampaign(), ...changed, futureProgress: ['keep'] });
    storage.setItem(CAMPAIGN_KEY, raw);
    assert.deepEqual(loadCampaign(storage), newCampaign());
    const result = completeChapter(newCampaign(), run(), 'standard', storage);
    assert.equal(result.saved, false);
    assert.equal(result.profile.license, true);
    assert.equal(storage.getItem(CAMPAIGN_KEY), raw);
  }
  const storage = memory();
  assert.equal(completeChapter({ ...newCampaign(), version: 2 }, run(), 'standard', storage).saved, false);
  assert.equal(storage.writes, 0);
});

test('hints disclose target timing and do not promise nonexistent AI opponents', () => {
  assert.match(chapterHint(null), /45초.*AI 없이/);
  assert.match(chapterHint(null, 'relaxed'), /60초/);
  assert.match(chapterHint({ phase: 'countdown' }), /출발 신호/);
  assert.match(chapterHint({ phase: 'cooldown' }), /정차/);
  assert.match(chapterHint({ phase: 'running', valid: true, gate: 1 }), /2\/3/);
  assert.match(chapterHint({ phase: 'running', valid: false }), /기록 제외/);
  assert.match(chapterHint(run(40)), /통과/);
});
