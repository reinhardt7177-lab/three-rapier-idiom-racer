import * as THREE from 'three';

// Diagnostic A/B/A uses one frozen scene. It never advances physics, moves cars,
// changes race progress, exports an asset or runs in production.
export function createFrozenComparison({apply,reset,measure,framesPerPhase=360,middleMode='tread',middlePhase='tread-only',now=()=>performance.now()}){
 const phases=['full-before',middlePhase,'full-after'];
 let phase=0,frames=0,status='idle',previous=null;const results=[],intervals=[],transitions=[];
 const capture=complete=>results.push({phase:phases[phase],frames,complete,measurement:measure()});
 return {start(){if(status!=='idle')return;const start=now();status='running';apply('full');reset();transitions.push({to:phases[0],cpuMs:now()-start});},
 record(timestamp){if(status!=='running')return;
  if(Number.isFinite(timestamp)){if(previous!==null)intervals.push({phase:phases[phase],gapMs:timestamp-previous});previous=timestamp;}
  if(++frames<framesPerPhase)return;const start=now();
  capture(true);frames=0;
  if(++phase===phases.length){status='complete';apply('full');transitions.push({to:'complete',cpuMs:now()-start});return;}
  apply(phase===1?middleMode:'full');reset();transitions.push({to:phases[phase],cpuMs:now()-start});
 },cancel(){if(status==='running'&&frames)capture(false);status='cancelled';apply('full');},
 active:()=>status==='running',label:()=>phases[phase]??'complete',
 snapshot:()=>({status,framesPerPhase,phase:phases[phase]??'complete',frames,results:results.map(r=>({...r})),transitions:transitions.map(t=>({...t})),intervals:status==='running'?[]:intervals.map(i=>({...i}))})};
}

// Changes only the ghost's transparent double-sided draw policy, at phase
// boundaries. The original material flags survive completion and cancellation.
export function createFrozenGhostTrial(root){
 const originals=new Map();let eligibleMeshes=0,triangles=0;
 root?.traverse(o=>{
  if(!o.isMesh)return;
  const materials=Array.isArray(o.material)?o.material:[o.material];
  const eligible=materials.filter(m=>m.transparent&&m.side===THREE.DoubleSide&&!m.forceSinglePass);
  for(const m of eligible)if(!originals.has(m))originals.set(m,m.forceSinglePass);
  if(eligible.length){eligibleMeshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}
 });
 return {apply(mode){for(const [m,original] of originals)m.forceSinglePass=mode==='ghost-single-pass'?true:original;},
  snapshot:()=>({kind:'ghost-single-pass',present:!!root,visible:root?.visible??false,eligibleMaterials:originals.size,eligibleMeshes,triangles})};
}

// Rejected production LOD is exercised here ONLY at phase transitions. This
// separates the changed GPU draw set from its former per-frame CPU updates.
export function createFrozenTreadTrial(views,camera,height){
 const details=[],point=new THREE.Vector3();camera.updateWorldMatrix(true,false);
 views.forEach((view,i)=>{
  view.root.updateMatrixWorld(true);
  view.root.traverse(o=>{
   if(!o.isMesh||Array.isArray(o.material)||o.material.name!=='Tread grooves')return;
   o.geometry.computeBoundingSphere();
   const sphere=o.geometry.boundingSphere.clone().applyMatrix4(o.matrixWorld);
   point.copy(sphere.center).applyMatrix4(camera.matrixWorldInverse);
   const depth=-point.z-sphere.radius,pixels=depth>0?sphere.radius*height*camera.projectionMatrix.elements[5]/depth:Infinity;
   details.push({mesh:o,visible:o.visible,omit:i!==0&&pixels<16,pixels:Number.isFinite(pixels)?pixels:null,triangles:(o.geometry.index?.count??o.geometry.attributes.position.count)/3});
  });
 });
 return {apply(mode){for(const d of details)d.mesh.visible=d.visible&&!(mode==='tread'&&d.omit);},snapshot(){return {eligible:details.filter(d=>d.visible&&d.omit).length,triangles:details.reduce((s,d)=>s+(d.visible&&d.omit?d.triangles:0),0),pixels:details.map(d=>d.pixels)};}};
}
