// Keep physics time independent of drawing. Catch up normal long frames while
// bounding work and reporting any time discarded by a truly excessive stall.
export function createRaceClock(step,{maxSteps=12,maxBacklog=.25}={}){
 let pending=0,simulated=0,dropped=0,last={rawSeconds:0,steps:0};
 return {
  reset(){pending=simulated=dropped=0;last={rawSeconds:0,steps:0};},
  advance(seconds,update){
   const raw=Number.isFinite(seconds)?Math.max(0,seconds):0;
   const total=pending+raw;pending=Math.min(total,maxBacklog);dropped+=Math.max(0,total-maxBacklog);
   let count=0;
   while(pending+1e-10>=step&&count<maxSteps){update();pending=Math.max(0,pending-step);simulated+=step;count++;}
   last={rawSeconds:raw,steps:count};return count;
  },
  alpha:()=>Math.min(1,pending/step),
  snapshot:()=>({...last,simulatedSeconds:simulated,pendingSeconds:pending,droppedSeconds:dropped}),
 };
}
