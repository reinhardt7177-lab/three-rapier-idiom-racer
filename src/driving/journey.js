import { COAST_ROADS, COAST_PADS, COAST_START, offsetPoint } from './coastRoute.js';

export const JOURNEY_KEY = 'mumu.coast.journey.v1';
const pointAt = (id, s) => COAST_ROADS[id].reduce((a, b) => Math.abs(b.s - s) < Math.abs(a.s - s) ? b : a);
export const JOURNEY_GATES = [pointAt('harbor', 280), pointAt('harbor', 650), pointAt('lookout', 65)];
export const JOURNEY_HOME = { ...offsetPoint(COAST_ROADS.harbor.find(p => p.z >= COAST_START.z), -3.5), radius: 19 };
export const SIGNAL_STATION = { x: COAST_PADS[0].x + 22, z: COAST_PADS[0].z + 34 };
export const journeyLocked = j => !!j && ['briefing', 'signal', 'complete'].includes(j.phase);
export function newJourney() { return { phase: 'briefing', gate: 0, hold: 0, elapsed: 0, distance: 0, saved: null }; }
export function continueJourney(j) {
  if (j.phase === 'briefing') return { ...j, phase: 'outbound' };
  if (j.phase === 'signal') return { ...j, phase: 'return', gate: 0, hold: 0 };
  return j;
}
export function interruptJourney(j) { return j ? { ...j, hold: 0 } : j; }
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function crossed(gate, previous, current, direction) {
  const along = p => ((p.x - gate.x) * gate.tx + (p.z - gate.z) * gate.tz) * direction;
  const lateral = (current.position.x - gate.x) * -gate.tz + (current.position.z - gate.z) * gate.tx;
  return along(previous.position) < 0 && along(current.position) >= 0 &&
    Math.abs(lateral) <= gate.halfWidth && current.contacts >= 2;
}
export function updateJourney(j, previous, current, dt) {
  if (journeyLocked(j)) return j;
  const step = Math.min(1 / 15, Math.max(0, Number.isFinite(dt) ? dt : 0));
  if (!step) return j;
  const moved = distance(previous.position, current.position);
  // Discontinuous resets/recovery must never count as a gate crossing or distance.
  if (!Number.isFinite(moved) || moved > 5) return { ...j, hold: 0 };
  const returning = j.phase === 'return';
  const gates = returning ? [...JOURNEY_GATES].reverse() : JOURNEY_GATES;
  let gate = j.gate;
  if (gate < gates.length && crossed(gates[gate], previous, current, returning ? -1 : 1)) gate++;
  const target = returning ? JOURNEY_HOME : COAST_PADS[0];
  const stopped = gate === gates.length && distance(current.position, target) < (returning ? target.radius : 22) &&
    current.kmh < 2 && current.contacts >= 3 && current.position.y > .1 && current.position.y < 2;
  const hold = stopped ? j.hold + step : 0;
  return { ...j, gate, hold, elapsed: j.elapsed + step, distance: j.distance + moved,
    phase: hold >= 2 ? returning ? 'complete' : 'signal' : j.phase };
}
export function journeyHint(j, snapshot) {
  if (j.phase === 'briefing') return { objective: '첫 해안 운행 · 약 3–5분', speaker: '서진 · 정비소', text: '바람곶의 옛 신호소에 다시 불이 들어왔대. 전망대에서 신호를 확인하고 돌아와. 오늘은 기록 경쟁이 아니야.' };
  if (j.phase === 'signal') return { objective: '신호 확인 · 정차 중', speaker: '유나 · 항구 라디오', text: '이 불빛, 예전에는 마지막 차가 돌아올 때까지 켜 뒀어. 네 차고에 불이 켜진 걸 보고 우리도 다시 켰지. 이제 천천히 돌아와.' };
  if (j.phase === 'complete') return { objective: '첫 해안 운행 완료', speaker: '서진 · 정비소', text: '다녀왔네. 신호소도, 우리 차고도 다시 불이 켜졌어. 오늘의 첫 운행을 정비 일지에 남겨 둘게.' };
  if (j.phase === 'outbound' && distance(snapshot.position, COAST_PADS[1]) < 70) return { objective: '솔숲 쉼터입니다 · 회차 후 전망대 방향', speaker: '유나 · 항구 라디오', text: '여기는 솔숲 쉼터야. 안전하게 돌아 나와 갈림길의 바람곶 표지를 따라가면 돼. 시간제한은 없어.' };
  const gate = (j.phase === 'return' ? [...JOURNEY_GATES].reverse() : JOURNEY_GATES)[j.gate];
  if (gate && ((snapshot.position.x - gate.x) * gate.tx + (snapshot.position.z - gate.z) * gate.tz) * (j.phase === 'return' ? -1 : 1) > 30) return { objective: '경유 확인 누락 · 메뉴에서 안내 확인', speaker: '서진 · 정비소', text: '경유 구간을 도로 밖으로 지나친 것 같아. 안전하게 돌아가 길을 따라 다시 통과해 줘. 어렵다면 메뉴의 시작점 복귀로 이번 운행을 다시 시작할 수 있어.' };
  if (j.phase === 'return') return { objective: j.gate === 3 ? `항구 귀환 구역 · 2초 정차 ${Math.min(2, j.hold).toFixed(1)}/2` : '항구 정비소로 귀환 · 오른쪽 차로', speaker: '서진 · 정비소', text: '회차장을 넓게 돌아 나와. 왔던 길의 오른쪽 차로를 따라 항구 표지까지 돌아오면 돼.' };
  if (j.gate < 2) return { objective: j.gate === 0 ? '항만대로 출발 · 전망대 방향' : '해안 굽잇길 · 코너 진입 전 감속', speaker: '서진 · 정비소', text: '바다 쪽 난간을 따라가. 굽잇길부터 차로가 줄어드니 속도를 낮춰. 40–60km/h로도 충분해.' };
  return { objective: j.gate === 2 ? '갈림길 우회전 · 바람곶 신호소' : `전망대 회차장 · 2초 정차 ${Math.min(2, j.hold).toFixed(1)}/2`, speaker: '유나 · 항구 라디오', text: '오른쪽 길 끝, 석재 신호소가 보여? 회차장 안에 완전히 멈추면 오래된 불빛의 이야기를 들려줄게.' };
}
export function loadJourney(storage) {
  try { const d = JSON.parse(storage?.getItem(JOURNEY_KEY) || 'null'); return d?.version === 1 && d?.signalRunComplete === true; } catch { return false; }
}
export function saveJourney(storage) {
  try { storage.setItem(JOURNEY_KEY, JSON.stringify({ version: 1, signalRunComplete: true })); return true; } catch { return false; }
}
