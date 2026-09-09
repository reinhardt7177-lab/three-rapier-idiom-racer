import { COAST_ROADS, nearestRoad } from './coastRoute.js';

export const SPRINT_KEY = 'mumu.coast.sprint.v1';
export const SPRINT_ROUTE = 'harbor-s860-v1';
const at = s => COAST_ROADS.harbor.reduce((a,b)=>Math.abs(a.s-s)<Math.abs(b.s-s)?a:b);
export const SPRINT_GATES = [at(280),at(600),at(860)];
export const SPRINT_LABELS = ['항만 직선','해안 S커브','바람곶 피니시'];
export const sprintLocked = s => !!s && ['briefing','countdown','complete'].includes(s.phase);
export function formatTime(value) {
  if (!Number.isFinite(value)) return '—';
  const cs=Math.floor(Math.max(0,value)*100);
  return `${Math.floor(cs/6000)}:${String(Math.floor(cs/100)%60).padStart(2,'0')}.${String(cs%100).padStart(2,'0')}`;
}
export function newSprint(best=null,saved=null) { return {phase:'briefing',countdown:3,elapsed:0,gate:0,splits:[],delta:null,valid:true,reason:'',best,saved:best&&typeof saved==='boolean'?saved:null,personalBest:false}; }
export function startSprint(s) { return s.phase==='briefing'?{...s,phase:'countdown'}:s; }
export function advanceCountdown(s,dt) {
  if(s.phase!=='countdown')return s;
  const countdown=Math.max(0,s.countdown-(Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0));
  return {...s,countdown,phase:countdown<=.0001?'running':'countdown'};
}
export function invalidateSprint(s,reason='도로 복귀 사용') { return s&&s.phase==='running'?{...s,valid:false,reason:s.reason||reason}:s; }
export function updateSprint(s,previous,current,dt) {
  if(s.phase==='cooldown') {
    const cooldownElapsed=(s.cooldownElapsed||0)+(Number.isFinite(dt)?Math.min(1/15,Math.max(0,dt)):0);
    const fallen=current.position.y < -8;
    if (!fallen && current.kmh<.1 && current.contacts>=3) return {...s,cooldownElapsed,phase:'complete'};
    if (fallen || cooldownElapsed>=8) return {...s,cooldownElapsed,phase:'complete',valid:false,reason:'안전 정지 실패 · 기록 제외. 차고 복귀 또는 재도전을 선택해 주세요.'};
    return {...s,cooldownElapsed};
  }
  if(s.phase!=='running')return s;
  const step=Number.isFinite(dt)?Math.min(1/15,Math.max(0,dt)):0;
  if(!step)return s;
  let next={...s,elapsed:s.elapsed+step};
  const p=current.position,old=previous.position,moved=Math.hypot(p.x-old.x,p.z-old.z);
  if(!Number.isFinite(moved)||moved>5)return invalidateSprint(next,'비연속 이동 · 기록 제외');
  const near=nearestRoad(p,{harbor:COAST_ROADS.harbor});
  if(near.distance>near.halfWidth+.6||p.y<-.1||p.y>4) next=invalidateSprint(next,'노면 이탈 · 기록 제외');
  const gate=SPRINT_GATES[s.gate];
  const along=q=>(q.x-gate.x)*gate.tx+(q.z-gate.z)*gate.tz;
  const before=along(old),after=along(p);
  if(before<0&&after>=0) {
    const ratio=-before/(after-before),x=old.x+(p.x-old.x)*ratio,z=old.z+(p.z-old.z)*ratio;
    const lateral=(x-gate.x)*-gate.tz+(z-gate.z)*gate.tx;
    if(Math.abs(lateral)<=gate.halfWidth&&current.contacts>=2&&p.y>.1&&p.y<2) {
      const split=s.elapsed+step*ratio,splits=[...s.splits,split];
      next={...next,gate:s.gate+1,splits,delta:s.best?split-s.best.splits[s.gate]:null};
      if(next.gate===SPRINT_GATES.length) next={...next,elapsed:split,phase:'cooldown',cooldownElapsed:0};
    }
  }
  return next;
}
export function sprintHint(s) {
  if(s.phase==='briefing')return '해안 스프린트 · 약 770 m';
  if(s.phase==='countdown')return `출발 준비 ${Math.ceil(s.countdown)}`;
  if(s.phase==='cooldown')return '피니시 통과 · 자동 감속 중';
  if(s.phase==='complete')return s.valid?'주행 기록 완료':'완주 · 기록 제외';
  return s.valid?`${s.gate+1}/3 · ${SPRINT_LABELS[s.gate]}`:s.reason;
}
function cleanSprintRecord(record) {
  if(!record||!Number.isFinite(record.time)||record.time<5||record.time>3600||!Array.isArray(record.splits)||record.splits.length!==3)return null;
  if(Array.from(record.splits).some((v,i)=>!Number.isFinite(v)||v<=0||(i&&v<=record.splits[i-1]))||Math.abs(record.splits[2]-record.time)>.001)return null;
  return {time:record.time,splits:[...record.splits]};
}
function readSprintStorage(storage) {
  try {
    const raw=storage.getItem(SPRINT_KEY);
    if(raw==null)return {record:null,writable:true};
    let value;
    try{value=JSON.parse(raw);}catch{return {record:null,writable:true};}
    const incompatible=value&&typeof value==='object'&&((value.version!==undefined&&value.version!==1)||(value.route!==undefined&&value.route!==SPRINT_ROUTE));
    return {record:value?.version===1&&value.route===SPRINT_ROUTE?cleanSprintRecord(value):null,writable:!incompatible};
  }catch{
    // A failed read must not become permission to overwrite an unknown record.
    return {record:null,writable:false};
  }
}
export function loadSprint(storage) { return readSprintStorage(storage).record; }
export function recordSprint(s,storage) {
  if(s.phase!=='complete'||s.valid!==true)return s;
  const record=cleanSprintRecord({time:s.elapsed,splits:s.splits});
  if(!record)return s;
  const stored=readSprintStorage(storage),memory=cleanSprintRecord(s.best);
  const previous=!memory||(stored.record&&stored.record.time<=memory.time)?stored.record:memory;
  const personalBest=!previous||record.time<previous.time,best=personalBest?record:previous;
  let saved=false;
  if(stored.writable) {
    try {
      // A slower retry still retries a previously blocked in-memory best.
      const serialized=JSON.stringify(best);
      if(JSON.stringify(stored.record)!==serialized)storage.setItem(SPRINT_KEY,JSON.stringify({version:1,route:SPRINT_ROUTE,...best}));
      const confirmed=readSprintStorage(storage);
      saved=confirmed.writable&&JSON.stringify(confirmed.record)===serialized;
    }catch{ /* Keep the best in memory when persistence is blocked. */ }
  }
  return {...s,best,personalBest,saved};
}
