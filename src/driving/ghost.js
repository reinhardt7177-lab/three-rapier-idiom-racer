import { Quaternion } from 'three';
import { SPRINT_ROUTE } from './sprint.js';

export const GHOST_KEY = 'mumu.coast.ghost.v1';
// Bump when vehicle/steering/track tuning changes; never race incompatible paths.
export const GHOST_PHYSICS = 'coast-gt-20260908-v1';
export const GHOST_LIMIT = 180;
const MAX_ROWS = 3602, MAX_BYTES = 1200000;
const meta = { version:1, route:SPRINT_ROUTE, physics:GHOST_PHYSICS };
const compatible = d => d?.version===1 && d.route===SPRINT_ROUTE && d.physics===GHOST_PHYSICS;
const rounded = (v,n=4) => Number(v.toFixed(n));

export function validateGhost(d) {
  if(!compatible(d)||!Number.isFinite(d.time)||d.time<5||d.time>GHOST_LIMIT||!Array.isArray(d.samples)||d.samples.length<2||d.samples.length>MAX_ROWS)return null;
  if(!Array.isArray(d.splits)||d.splits.length!==3||!Array.from(d.splits).every((t,i)=>Number.isFinite(t)&&t>0&&(!i||t>d.splits[i-1]))||Math.abs(d.splits[2]-d.time)>.001)return null;
  let previous;
  for(const row of d.samples) {
    if(!Array.isArray(row)||row.length!==20||!Array.from(row).every(Number.isFinite))return null;
    if(row[0]<0||row[0]>d.time+.001||Math.abs(row[1])>3000||Math.abs(row[3])>3000||row[2]<-1||row[2]>5)return null;
    if(Math.abs(Math.hypot(...row.slice(4,8))-1)>.01)return null;
    if(row.slice(8).some(v=>Math.abs(v)>100000))return null;
    if(previous) {
      const dt=row[0]-previous[0];
      if(dt<=0||dt>.07||Math.hypot(row[1]-previous[1],row[2]-previous[2],row[3]-previous[3])>90*dt+.02)return null;
    }
    previous=row;
  }
  if(d.samples[0][0]!==0||Math.abs(previous[0]-d.time)>.001)return null;
  return {...meta,time:d.time,splits:[...d.splits],samples:d.samples.map(r=>[...r])};
}
function read(storage) {
  try {
    const raw=storage.getItem(GHOST_KEY);
    if(raw==null)return {record:null,writable:true};
    if(raw.length>MAX_BYTES)return {record:null,writable:false};
    let d;try{d=JSON.parse(raw);}catch{return {record:null,writable:false};}
    return {record:validateGhost(d),writable:compatible(d)};
  }catch{return {record:null,writable:false};}
}
export const loadGhost = storage => read(storage).record;
export function saveGhost(candidate,memory,storage) {
  const stored=read(storage);
  const choices=[validateGhost(candidate),validateGhost(memory),stored.record].filter(Boolean).sort((a,b)=>a.time-b.time);
  const best=choices[0]||null;
  let saved=false;
  if(best&&stored.writable)try{
    const json=JSON.stringify(best);
    if(json.length<=MAX_BYTES) {
      if(JSON.stringify(stored.record)!==json)storage.setItem(GHOST_KEY,json);
      saved=JSON.stringify(read(storage).record)===json;
    }
  }catch{}
  return {best,saved};
}
function pack(time,state) {
  const p=state.position,q=state.rotation;
  return [time,rounded(p.x),rounded(p.y),rounded(p.z),rounded(q.x,6),rounded(q.y,6),rounded(q.z,6),rounded(q.w,6),...state.wheels.flatMap(w=>[rounded(w.y),rounded(w.steering),rounded(w.rotation)])];
}
export function createGhostRecorder() {
  let samples=[],failed=false;
  return {
    start(state){samples=[pack(0,state)];failed=false;},
    capture(time,state,final=false){
      if(failed||!samples.length)return;
      if(time>GHOST_LIMIT||samples.length>=MAX_ROWS){failed=true;samples=[];return;}
      if(time<=samples.at(-1)[0])return;
      if(final||time-samples.at(-1)[0]>=.05-1e-7)samples.push(pack(time,state));
    },
    finish(sprint){return sprint.phase==='complete'&&sprint.valid===true&&sprint.gate===3&&!failed?validateGhost({...meta,time:sprint.elapsed,splits:sprint.splits,samples}):null;},
    clear(){samples=[];failed=false;},
  };
}
export function createGhostSampler() {
  const qa=new Quaternion(),qb=new Quaternion();
  return (record,time) => {
    if(!record||!Number.isFinite(time)||time<0||time>record.time)return null;
    let lo=0,hi=record.samples.length-1;
    while(lo+1<hi){const mid=(lo+hi)>>1;if(record.samples[mid][0]<=time)lo=mid;else hi=mid;}
    const a=record.samples[lo],b=record.samples[hi],alpha=Math.max(0,Math.min(1,(time-a[0])/(b[0]-a[0])));
    const lerp=i=>a[i]+(b[i]-a[i])*alpha;
    qa.fromArray(a,4).normalize();qb.fromArray(b,4).normalize();qa.slerp(qb,alpha);
    return {position:{x:lerp(1),y:lerp(2),z:lerp(3)},rotation:{x:qa.x,y:qa.y,z:qa.z,w:qa.w},wheels:Array.from({length:4},(_,i)=>({y:lerp(8+i*3),steering:lerp(9+i*3),rotation:lerp(10+i*3)}))};
  };
}
export function interpolateGhostPose(a,b,alpha) {
  return createGhostSampler()({time:1,samples:[pack(0,a),pack(1,b)]},Math.max(0,Math.min(1,alpha)));
}
