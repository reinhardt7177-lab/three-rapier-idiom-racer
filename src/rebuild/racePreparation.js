// Preparation costs are reported separately, never discarded as "good" frames.
// A cancelled or failed preparation cannot start the clock or draw stale assets.
export function createRaceStartBoundary(){
 let pending=false,readyAtMs=null,firstFrameWaitMs=0,skippedFrames=0;
 return {pending:()=>pending,cancel(){pending=false;readyAtMs=null;firstFrameWaitMs=skippedFrames=0;},begin(at){pending=true;readyAtMs=at;firstFrameWaitMs=skippedFrames=0;},enter(timestamp,wallTime){
  if(!pending)return {accepted:true,first:false};
  firstFrameWaitMs=Math.max(0,wallTime-readyAtMs);
  if(timestamp<readyAtMs){skippedFrames++;return {accepted:false,first:false};}
  pending=false;return {accepted:true,first:true};
 },snapshot:()=>({pending,readyAtMs,firstFrameWaitMs,skippedFrames})};
}

export function createRacePreparation({now=()=>performance.now(),onChange=()=>{},yieldTurn=()=>new Promise(resolve=>setTimeout(resolve,0))}={}){
 let generation=0,state={phase:'idle',busy:false,error:null};
 const change=next=>{state={...state,...next};onChange();};
 return {busy:()=>state.busy,blocked:()=>state.busy||state.phase==='failed',snapshot:()=>({...state}),cancel(){generation++;change({phase:'idle',busy:false,error:null});},async run({setup,compile,draw,ready}){
  if(state.busy)return false;const token=++generation,start=now();
  change({phase:'setup',busy:true,error:null,setupMs:0,compileMs:0,drawMs:0,totalMs:0});
  try {
   await yieldTurn();if(token!==generation)return false;
   const setupStart=now();setup();change({phase:'compile',setupMs:now()-setupStart});
   const compileStart=now();await compile();if(token!==generation)return false;
   change({phase:'draw',compileMs:now()-compileStart});
   const drawStart=now();draw();if(token!==generation)return false;
   state={...state,drawMs:now()-drawStart,totalMs:now()-start,phase:'ready',busy:false};
   ready();onChange();return true;
  }catch(error){if(token===generation)change({phase:'failed',busy:false,error:error?.message||String(error),totalMs:now()-start});return false;}
 }};
}
