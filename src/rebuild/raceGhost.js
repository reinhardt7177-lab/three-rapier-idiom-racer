// Best-run ghost: the player's physics pose sampled at a fixed race-time
// interval, replayed as a translucent car with no collider and no physics.
const INTERVAL=.1,VERSION=1;
const round=(v,d)=>Math.round(v*d)/d;

export function createGhostRecorder(vehicle,interval=INTERVAL){
 const data=[];let next=0;
 return {
  record(time,state){
   if(time+1e-9<next)return;
   const p=state.position,q=state.rotation;
   data.push(round(p.x,100),round(p.y,100),round(p.z,100),round(q.x,1e4),round(q.y,1e4),round(q.z,1e4),round(q.w,1e4));
   next=data.length/7*interval;
  },
  finish:time=>({version:VERSION,vehicle,interval,time,data:[...data]}),
 };
}

// Interpolated pose at a race time, or null outside the recording.
export function ghostPose(ghost,time){
 const count=ghost?.data?.length/7|0;
 if(!count||!(time>=0))return null;
 const f=time/ghost.interval,i=Math.floor(f);
 if(i>=count-1)return null;
 const a=i*7,b=a+7,t=f-i,d=ghost.data;
 const lerp=k=>d[a+k]+(d[b+k]-d[a+k])*t;
 // Normalised lerp is enough for 0.1 s apart orientations; keep the short arc.
 const dot=d[a+3]*d[b+3]+d[a+4]*d[b+4]+d[a+5]*d[b+5]+d[a+6]*d[b+6],s=dot<0?-1:1;
 const qx=d[a+3]+(s*d[b+3]-d[a+3])*t,qy=d[a+4]+(s*d[b+4]-d[a+4])*t,qz=d[a+5]+(s*d[b+5]-d[a+5])*t,qw=d[a+6]+(s*d[b+6]-d[a+6])*t;
 const n=Math.hypot(qx,qy,qz,qw)||1;
 return {position:{x:lerp(0),y:lerp(1),z:lerp(2)},rotation:{x:qx/n,y:qy/n,z:qz/n,w:qw/n}};
}

const key=(trackId,laps)=>`mumu.circuit.ghost.v1.${trackId}.${laps}`;
export function loadGhost(storage,trackId,laps){
 try{
  const ghost=JSON.parse(storage?.getItem(key(trackId,laps))||'null');
  return ghost?.version===VERSION&&Array.isArray(ghost.data)&&ghost.data.length%7===0&&typeof ghost.vehicle==='string'?ghost:null;
 }catch{return null;}
}
// Full storage simply means no ghost is kept; the race result is unaffected.
export function saveGhost(storage,trackId,laps,ghost){
 try{storage?.setItem(key(trackId,laps),JSON.stringify(ghost));return true;}catch{return false;}
}
