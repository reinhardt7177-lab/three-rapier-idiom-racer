import * as THREE from 'three';

export const PERFORMANCE_EXPERIMENTS=Object.freeze({
 ghost:['없음','있음','없음'],material:['양면','단면 단일 패스','양면'],instrumentation:['꺼짐','켜짐','꺼짐'],
});
const summarize=values=>{const sorted=[...values].sort((a,b)=>a-b);return {samples:values.length,mean:values.reduce((a,b)=>a+b,0)/values.length,p95:sorted[Math.ceil(sorted.length*.95)-1],max:sorted.at(-1)};};

// Full-duration observations, independent of the rolling HUD metrics. Minimal
// timestamps remain enabled in A; expensive GPU queries/draw hooks do not.
export function createPerformanceRun({durationMs=30000}={}){
 if(durationMs<30000)throw new Error('Each performance condition must last at least 30 seconds');
 let start=null,previous=null,status='idle';const intervals=[],submission=[],draws=[];
 return {start(){start=previous=null;status='running';intervals.length=submission.length=draws.length=0;},
 record(now,cost,info,context){if(status!=='running')return false;if(start===null){start=previous=now;return false;}
  intervals.push({at:now-start,ms:now-previous,visible:context.visible,focused:context.focused});previous=now;
  submission.push(cost);draws.push({calls:info.calls,triangles:info.triangles});
  if(now-start>=durationMs){status='complete';return true;}return false;
 },snapshot(){const frame=summarize(intervals.map(i=>i.ms)),cpu=summarize(submission);return {status,durationMs:previous===null?0:previous-start,frame:{...frame,over50:intervals.filter(i=>i.ms>50).length},cpu,draws:draws.length?{first:draws[0],last:draws.at(-1)}:null,intervals:[...intervals],submission:[...submission]};},status:()=>status};
}

export function applyGhostComparison(root,experiment,condition){
 const materials=new Map();root?.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(!materials.has(m))materials.set(m,{side:m.side,forceSinglePass:m.forceSinglePass});});
 const shown=root?.visible;
 if(experiment==='material'&&condition===1)for(const m of materials.keys()){m.side=THREE.FrontSide;m.forceSinglePass=true;m.needsUpdate=true;}
 return {visible:experiment!=='ghost'||condition===1,restore(){if(root)root.visible=shown;for(const [m,flags]of materials){Object.assign(m,flags);m.needsUpdate=true;}},materials:materials.size};
}
