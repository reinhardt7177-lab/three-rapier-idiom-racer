const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Only the horizontal velocity change produced by the shared world solver is
// observed. Wheel acceleration and vertical road support cannot trigger this.
// No heading, transform or velocity is written; steering and reverse stay live.
export function createCollisionResponse(){
 let severity=0,peakDeltaV=0;
 return {
  update(dt){if(dt>0)severity=Math.max(0,severity-dt/ .65);},
  observe(before,after){
   const deltaV=Math.hypot(after.x-before.x,after.z-before.z);
   if(deltaV>1.8){severity=Math.max(severity,clamp((deltaV-1.8)/6,0,1));peakDeltaV=Math.max(peakDeltaV,deltaV);}
  },
  snapshot:()=>({severity,powerScale:1-.48*severity,rearGripScale:1-.14*severity,peakDeltaV}),
  reset(){severity=peakDeltaV=0;},
 };
}
