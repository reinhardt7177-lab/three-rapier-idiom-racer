// CPU submission time is distinct from the interval between animation frames.
// These values do not measure GPU execution or React's later DOM commit.
export function createRenderTiming(capacity=240){
 const samples=[];
 return {reset(){samples.length=0;},record(cost){
  samples.push(cost);if(samples.length>capacity)samples.shift();
 },snapshot(){
  const result={};
  for(const key of ['workMs','physicsMs','renderMs']){
   const values=samples.map(s=>s?.[key]).filter(v=>Number.isFinite(v)&&v>=0).sort((a,b)=>a-b);
   result[key]={samples:values.length,missing:samples.length-values.length};
   if(values.length)Object.assign(result[key],{mean:values.reduce((n,v)=>n+v,0)/values.length,p95:values[Math.ceil(values.length*.95)-1],max:values.at(-1)});
  }
  return result;
 }};
}

// A paused camera only needs another draw after a visible state change.
export function createPauseRendering(){
 let dirty=true;const stats={draws:0,skipped:0};
 return {stats,invalidate(){dirty=true;},draw(paused){
  if(!paused){dirty=false;stats.draws++;return true;}
  if(!dirty){stats.skipped++;return false;}dirty=false;stats.draws++;return true;
 }};
}
