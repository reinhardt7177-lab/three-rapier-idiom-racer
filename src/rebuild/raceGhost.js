// Best-run ghost: the player's physics pose sampled at a fixed race-time
// interval, replayed as a translucent car with no collider and no physics.
import {TRACKS} from './tracks.js';
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

// Derive a smooth velocity from existing pose samples; older saved replays
// need no format change. Central differences avoid 0.1s stair-step lean.
export function ghostVelocity(ghost,time){
 const n=ghost?.data?.length/7|0;if(n<2)return {x:0,y:0,z:0};
 const f=Math.max(0,Math.min(n-1,time/ghost.interval)),i=Math.min(n-2,Math.floor(f)),t=f-i,d=ghost.data;
 const velocity=(j,k)=>{const a=Math.max(0,j-1),b=Math.min(n-1,j+1);return (d[b*7+k]-d[a*7+k])/((b-a)*ghost.interval);};
 return {x:velocity(i,0)*(1-t)+velocity(i+1,0)*t,y:velocity(i,1)*(1-t)+velocity(i+1,1)*t,z:velocity(i,2)*(1-t)+velocity(i+1,2)*t};
}

const key=(trackId,laps)=>`mumu.circuit.ghost.v1.${trackId}.${laps}${TRACKS.find(t=>t.id===trackId)?.revision?'.'+TRACKS.find(t=>t.id===trackId).revision:''}`;
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

// A replay exactly matching the driver can put its double-sided glass/roof
// inside the cockpit camera. Keep its pose/motion, but exclude that overlap
// from the first-person view; distant replays and chase view remain visible.
export function ghostVisibleFromCamera(mode,ghostPosition,playerPosition){
 if(mode!=='first-person')return true;
 if(!ghostPosition||!playerPosition)return false;
 const dx=ghostPosition.x-playerPosition.x,dy=ghostPosition.y-playerPosition.y,dz=ghostPosition.z-playerPosition.z;
 return dx*dx+dy*dy+dz*dz>=16;
}
