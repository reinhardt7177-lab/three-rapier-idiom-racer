// Story state is independent of rendering. Time is simulation time, never a wall-clock timer.
export const STORY_KEY = 'mumu.coast.story.v1';
export const STORY_START = Object.freeze({ x: -7.5, y: .8, z: -720 });
export const STORY_STOP = Object.freeze({ x: -7.5, z: -470, halfWidth: 1.5, halfLength: 10 });
export const INTRO_SHOTS = Object.freeze([
  { title: '다시, 항구로', speaker: '프롤로그 · 첫 번째 호출', text: '오랫동안 닫혀 있던 정비소의 셔터를 올렸다. 첫 시운전을 앞두고, 무전기에 익숙한 목소리가 들린다.' },
  { title: '주파수 03', speaker: '유나 · 항구 라디오', text: '그 엔진 소리… 정말 돌아왔네. 방파제 앞 라디오 쉼터에서 만나. 보여 줄 게 있어.' },
  { title: '길 위에서 시작되는 이야기', speaker: '서진 · 정비소', text: '오늘은 기록보다 차의 상태부터 보자. 오른쪽 차로로 가고, 쉼터에 천천히 세워. 다녀와.' },
]);
export function newStory() { return { phase: 'intro', introTime: 0, checkpoint: 0, stopTime: 0, saved: null }; }
export function startStory(state) { return state.phase === 'intro' ? { ...state, phase: 'drive' } : state; }
export function advanceIntro(state, dt) {
  if (state.phase !== 'intro') return state;
  const introTime = Math.min(15, state.introTime + Math.max(0, dt));
  return { ...state, introTime, phase: introTime >= 15 ? 'drive' : 'intro' };
}
export function updateStory(state, previous, current, dt) {
  if (state.phase !== 'drive') return state;
  let checkpoint = state.checkpoint;
  const onRoad = current.position.x < -.5 && current.position.x > -9.6 && current.contacts >= 2;
  // Cross in the correct direction. Resetting/teleporting cannot jump the route gates.
  const crossed = z => previous.position.z < z && current.position.z >= z && current.position.z - previous.position.z < 5 && onRoad;
  if (checkpoint === 0 && crossed(-650)) checkpoint = 1;
  if (checkpoint === 1 && crossed(-550)) checkpoint = 2;
  const stopped = checkpoint === 2 && Math.abs(current.position.x - STORY_STOP.x) <= STORY_STOP.halfWidth &&
    Math.abs(current.position.z - STORY_STOP.z) <= STORY_STOP.halfLength && current.kmh < 2 && current.contacts >= 3;
  const stopTime = stopped ? state.stopTime + Math.max(0, dt) : 0;
  return { ...state, checkpoint, stopTime, phase: stopTime >= 2 ? 'complete' : 'drive' };
}
export function storyHint(state, snapshot) {
  if (state.checkpoint === 0) return { speaker: '서진 · 정비소', text: '항만대로를 따라 직진해. 이번 주행에는 시간제한이 없어.', objective: '오른쪽 차로로 항구를 빠져나가기' };
  if (state.checkpoint === 1) return { speaker: '유나 · 항구 라디오', text: '횡단보도 너머, 바다 쪽 쉼터야. 저녁에 모이는 드라이버들을 소개해 줄게.', objective: '횡단보도를 지나 라디오 쉼터로' };
  if (snapshot.position.z > STORY_STOP.z + STORY_STOP.halfLength) return { speaker: '유나 · 항구 라디오', text: '쉼터를 지나쳤어. 주변을 확인하고 천천히 돌아와. R로 의뢰를 다시 시작해도 돼.', objective: '쉼터로 돌아오기 · R 의뢰 재시작' };
  return { speaker: '유나 · 항구 라디오', text: '오른쪽 크림색 정차 구역이 보여? 그 안에 차를 세우면 돼. B는 제동 전용이야.', objective: `라디오 쉼터에서 2초 정차 · ${Math.min(2, state.stopTime).toFixed(1)} / 2.0초` };
}
export function loadStory(storage) {
  try { const data = JSON.parse(storage?.getItem(STORY_KEY) || 'null'); return data?.version === 1 && data?.firstCallComplete === true; }
  catch { return false; }
}
export function saveStory(storage) {
  try { storage.setItem(STORY_KEY, JSON.stringify({ version: 1, firstCallComplete: true })); return true; }
  catch { return false; }
}
