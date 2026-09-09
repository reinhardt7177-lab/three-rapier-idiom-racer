import { SPRINT_ROUTE } from '../driving/sprint.js';

export const CAMPAIGN_KEY = 'mumu.coast.campaign.v1';
export const CAMPAIGN_BRAND = 'COASTLINE / HORIZON CLUB';

export const CHAPTER_ONE = Object.freeze({
  id: 'first-light', title: '태양 아래 첫 기록', mentor: '민서', playable: true,
  eyebrow: 'CHAPTER 01 / FIRST LIGHT',
  summary: '항구 정비소에서 시작하는 해안 클럽의 첫 초대.',
  briefing: '민서: “차고의 GT를 준비했어. 해안의 세 지점을 순서대로 지나, 내 기준 기록 안에 들어와 봐.”',
  objective: '해안 스프린트의 세 체크포인트를 순서대로 통과하고 정차하세요.',
  opponent: 'AI 차량 없이 민서의 기준 기록과 겨루는 싱글 플레이 도전입니다.',
  targets: Object.freeze({ standard: 45, relaxed: 60, elite: 36 }),
  reward: 'HORIZON CLUB 라이선스',
});

export const CHAPTERS = Object.freeze([
  CHAPTER_ONE,
  Object.freeze({ id: 'rival-line', title: '라이벌의 라인', playable: false,
    summary: '라이벌의 실제 주행 기록을 재생하는 고스트와 구간 기록 대결.', objective: '충돌 없는 기록 고스트임을 명시하고 실제 샘플 재생 검증 후 제작.' }),
  Object.freeze({ id: 'garage-choice', title: '나만의 GT', playable: false,
    summary: '외형 취향과 운전 성향을 차고에서 선택하는 장.', objective: '장식 구매보다 조작 차이가 검증된 제한적 튜닝부터 제작.' }),
  Object.freeze({ id: 'coast-crew', title: '해안의 동료들', playable: false,
    summary: '해안 동네의 인물과 목표가 있는 소규모 주행 이벤트.', objective: '기존 도로 안의 다른 목표로 이벤트 변주를 검증.' }),
  Object.freeze({ id: 'heat-run', title: '뜨거운 해안', playable: false,
    summary: '시야와 위험 판단을 요구하는 긴장감 있는 주행.', objective: '교통·충돌·실패 후 복구를 검증한 뒤 추격 여부 결정.' }),
  Object.freeze({ id: 'horizon-final', title: '수평선의 마지막 라인', playable: false,
    summary: '익숙해진 해안에서 첫 기록과 실력을 다시 비교하는 결승.', objective: '앞선 장의 검증된 주행 요소를 짧은 결승으로 통합.' }),
]);

export const newCampaign = () => ({ version: 1, route: SPRINT_ROUTE, chapterOne: null, license: false });
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const difficultyValid = value => value === 'standard' || value === 'relaxed';
const targetFor = difficulty => CHAPTER_ONE.targets[difficulty];
const medalFor = (time, difficulty) => difficulty === 'relaxed' ? 'assisted' : time <= CHAPTER_ONE.targets.elite ? 'elite' : 'club';
const splitsValid = (time, splits) => Number.isFinite(time) && time >= 5 && time <= 3600 &&
  Array.isArray(splits) && splits.length === 3 && Array.from(splits).every((value, index) =>
    Number.isFinite(value) && value > 0 && (!index || value > splits[index - 1])) && Math.abs(splits[2] - time) <= .001;

function cleanRecord(record) {
  if (!isObject(record) || !difficultyValid(record.difficulty) || !splitsValid(record.time, record.splits) ||
    record.time > targetFor(record.difficulty) || record.medal !== medalFor(record.time, record.difficulty)) return null;
  return { time: record.time, splits: [...record.splits], difficulty: record.difficulty, medal: record.medal };
}

function cleanProfile(value) {
  if (!isObject(value) || value.version !== 1 || value.route !== SPRINT_ROUTE || typeof value.license !== 'boolean') return newCampaign();
  const chapterOne = cleanRecord(value.chapterOne);
  // A licence cannot exist without a verified chapter record, nor vice versa.
  if (!chapterOne || !value.license) return newCampaign();
  return { version: 1, route: SPRINT_ROUTE, chapterOne, license: true };
}

function incompatible(value) {
  return isObject(value) && ((value.version !== undefined && value.version !== 1) ||
    (value.route !== undefined && value.route !== SPRINT_ROUTE));
}

function readStorage(storage) {
  try {
    const raw = storage?.getItem(CAMPAIGN_KEY);
    if (raw == null) return { profile: newCampaign(), writable: true };
    let value;
    try { value = JSON.parse(raw); } catch { return { profile: newCampaign(), writable: true }; }
    return { profile: cleanProfile(value), writable: !incompatible(value) };
  } catch {
    // Never overwrite an unknown existing record when even reading is denied.
    return { profile: newCampaign(), writable: false };
  }
}

export function loadCampaign(storage) {
  return readStorage(storage).profile;
}

export function evaluateChapterRun(sprint, difficulty = 'standard') {
  const target = difficultyValid(difficulty) ? targetFor(difficulty) : null;
  const fail = reason => ({ passed: false, reason, target, medal: null });
  if (!difficultyValid(difficulty)) return fail('지원하지 않는 난이도입니다. 다시 출발해 주세요.');
  if (!isObject(sprint) || sprint.phase !== 'complete' || sprint.paused === true) return fail('세 지점을 통과한 뒤 안전하게 정차해야 기록을 심사합니다.');
  if (sprint.valid !== true || sprint.recoveryUsed === true || sprint.recovered === true || sprint.teleported === true) return fail('도로 이탈·복귀 없는 유효 기록이 필요합니다.');
  if ((sprint.route !== undefined && sprint.route !== SPRINT_ROUTE) || sprint.gate !== 3 || !splitsValid(sprint.elapsed, sprint.splits)) return fail('체크포인트 순서 또는 기록을 확인할 수 없습니다. 다시 도전해 주세요.');
  if (sprint.elapsed > target) return fail(`기준 ${target}초를 넘었습니다. 코너 전에 감속하고 다시 도전하세요.`);
  const medal = medalFor(sprint.elapsed, difficulty);
  return { passed: true, reason: medal === 'elite' ? '엘리트 기록! 민서의 기준을 여유 있게 넘었습니다.' :
    difficulty === 'relaxed' ? '여유 모드 기준을 통과했습니다. 보조 모드 기록으로 남습니다.' : '민서의 기준 기록을 통과했습니다.', target, medal };
}

function betterRecord(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (b.time < a.time || (b.time === a.time && b.difficulty === 'standard' && a.difficulty !== 'standard')) return b;
  return a;
}

function mergeProfiles(a, b) {
  const chapterOne = betterRecord(a.chapterOne, b.chapterOne);
  return { ...newCampaign(), chapterOne: chapterOne ? { ...chapterOne, splits: [...chapterOne.splits] } : null, license: !!chapterOne };
}

export function completeChapter(profile, sprint, difficulty = 'standard', storage) {
  const stored = readStorage(storage);
  const previous = mergeProfiles(cleanProfile(profile), stored.profile);
  const evaluation = evaluateChapterRun(sprint, difficulty);
  if (!evaluation.passed) return { profile: previous, saved: stored.writable && !incompatible(profile) && JSON.stringify(previous) === JSON.stringify(stored.profile), awarded: false, evaluation };
  const record = { time: sprint.elapsed, splits: [...sprint.splits], difficulty, medal: evaluation.medal };
  const next = mergeProfiles(previous, { ...newCampaign(), chapterOne: record, license: true });
  const awarded = !previous.license;
  let saved = false;
  if (stored.writable && !incompatible(profile)) {
    try {
      const serialized = JSON.stringify(next);
      if (JSON.stringify(stored.profile) !== serialized) storage.setItem(CAMPAIGN_KEY, serialized);
      // Read back: private storage adapters may silently drop writes.
      saved = JSON.stringify(readStorage(storage).profile) === serialized;
    } catch { /* Keep the earned record in memory when persistence is blocked. */ }
  }
  return { profile: next, saved, awarded, evaluation };
}

export function chapterHint(sprint, difficulty = 'standard') {
  const target = difficultyValid(difficulty) ? targetFor(difficulty) : CHAPTER_ONE.targets.standard;
  if (!isObject(sprint) || sprint.phase === 'briefing') return `민서의 기준 ${target}초 · AI 없이 기록 대결`;
  if (sprint.phase === 'countdown') return '출발 신호를 기다리세요 · 세 지점 순서대로';
  if (sprint.phase === 'cooldown') return '피니시 통과 · 안전하게 정차한 뒤 결과 확인';
  if (sprint.phase === 'complete') return evaluateChapterRun(sprint, difficulty).reason;
  if (sprint.valid !== true) return '이번 주행은 기록 제외 · 다시 도전할 수 있어요';
  return `${Math.min(3, Math.max(1, Number.isInteger(sprint.gate) ? sprint.gate + 1 : 1))}/3 체크포인트 · 민서의 기준 ${target}초`;
}
