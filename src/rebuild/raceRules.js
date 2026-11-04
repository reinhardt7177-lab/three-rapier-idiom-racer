const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// Nitro is earned, not free: a small trickle, drifting, drafting and overtakes.
export const RACE_NITRO=Object.freeze({startCharge:35,passiveCharge:1.5,draftCharge:8});
export const OVERTAKE_CHARGE=12;
// A pass only counts against a car physically close by, so a rival sent back
// by road recovery never hands out free nitro.
export const OVERTAKE_RANGE=30;

// Drafting strength 0..1 behind the closest moving car in the same lane.
// Pure geometry from Rapier snapshots; it never moves a car by itself.
export function slipstream(state,others){
 const v=state.velocity||{x:0,z:0},speed=Math.hypot(v.x,v.z);
 if(speed<60/3.6)return 0;
 const q=state.rotation;let fx=2*(q.x*q.z+q.w*q.y),fz=1-2*(q.x*q.x+q.y*q.y);
 const n=Math.hypot(fx,fz)||1;fx/=n;fz/=n;
 let best=0;
 for(const o of others){
  const dx=o.position.x-state.position.x,dz=o.position.z-state.position.z;
  if(Math.abs(o.position.y-state.position.y)>2.5)continue;
  const along=dx*fx+dz*fz,lateral=Math.abs(dx*fz-dz*fx);
  if(along<4||along>30||lateral>1.5)continue;
  if(Math.hypot(o.velocity?.x??0,o.velocity?.z??0)<40/3.6)continue;
  best=Math.max(best,(1-(along-4)/26)*(1-.5*lateral/1.5)*Math.min(1,(speed-60/3.6)/8));
 }
 return clamp(best,0,1);
}

// Rivals that went from ahead of the player to behind, while within range.
export function createOvertakeCounter(){
 const ahead=new Map();
 return {
  reset(){ahead.clear();},
  update(player,rivals){
   let passes=0;
   for(const r of rivals){
    const isAhead=r.finish!==null||r.progress>player.progress;
    if(ahead.get(r)===true&&!isAhead&&Math.abs(r.progress-player.progress)<OVERTAKE_RANGE)passes++;
    ahead.set(r,isAhead);
   }
   return passes;
  },
 };
}

const ASSIST_KEY='mumu.circuit.assist.v1';
export function loadAssist(storage){try{return storage?.getItem(ASSIST_KEY)!=='off';}catch{return true;}}
export function saveAssist(storage,on){try{storage?.setItem(ASSIST_KEY,on?'on':'off');}catch{}}
