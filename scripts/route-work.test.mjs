import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {nearestRoute} from '../src/rebuild/course.js';
import {nearestRoad,COAST_ROADS} from '../src/driving/coastRoute.js';
import * as timing from '../src/rebuild/renderTiming.js';
import {PerspectiveCamera} from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const {createPauseRendering}=timing;

// Frozen pre-optimization arithmetic/order is the compatibility oracle.
function originalRoute(route,position,hint=null){
 const points=route.points,n=points.length;let best={index:0,distance:Infinity};
 const visit=i=>{i=(i+n)%n;const p=points[i],d=Math.hypot(p.x-position.x,p.z-position.z);if(d<best.distance)best={index:i,distance:d};};
 if(hint===null)for(let i=0;i<n;i++)visit(i);
 else{for(let i=hint-65;i<=hint+65;i++)visit(i);if(best.distance>35)for(let i=0;i<n;i++)visit(i);}
 return {...best,point:points[best.index]};
}
function originalRoad(position,roads=COAST_ROADS){
 let best=null;
 for(const [id,points]of Object.entries(roads))for(let i=0;i<points.length-1;i++){
  const a=points[i],b=points[i+1],dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz;
  const t=Math.max(0,Math.min(1,((position.x-a.x)*dx+(position.z-a.z)*dz)/l2));
  const x=a.x+dx*t,z=a.z+dz*t,d=Math.hypot(position.x-x,position.z-z);
  if(!best||d<best.distance)best={x,z,...(a.y===undefined?{}:{y:a.y+((b.y??a.y)-a.y)*t}),tx:dx/Math.sqrt(l2),tz:dz/Math.sqrt(l2),halfWidth:a.halfWidth+(b.halfWidth-a.halfWidth)*t,s:a.s+(b.s-a.s)*t,id,index:i,distance:d};
 }return best;
}
function hypotCalls(fn){const original=Math.hypot;let calls=0;Math.hypot=(...v)=>{calls++;return original(...v);};try{fn();return calls;}finally{Math.hypot=original;}}
test('four real routes retain exact nearest point, distance, hint fallback and wrap order',()=>{
 let samples=0;
 for(const id of ['namak','yeosu','seongsamjae','world']){
  const file=id+'-route',route=JSON.parse(fs.readFileSync(new URL('../public/assets/rebuild/'+file+'.json',import.meta.url)));
  for(let k=0;k<80;k++){
   const index=Math.floor(k*route.points.length/80),p=route.points[index];
   for(const lane of [-120,-7,0,7,120]){
    const position={x:p.x+p.dz*lane+.123,z:p.z-p.dx*lane-.321};
    for(const hint of [null,index,(index+route.points.length-60)%route.points.length]){assert.deepEqual(nearestRoute(route,position,hint),originalRoute(route,position,hint));samples++;}
   }
  }
 }assert.equal(samples,4800);
});
test('hint bounds preserve earlier ties and robust distances at very large finite coordinates',()=>{
 const points=Array.from({length:501},(_,i)=>({x:i,z:0}));points[249]={x:250,z:0};const route={points};
 for(const p of [{x:250,z:0},{x:250,z:1e300},{x:Infinity,z:0},{x:NaN,z:0}])assert.deepEqual(nearestRoute(route,p,250),originalRoute(route,p,250));
 assert.equal(nearestRoute(route,{x:250,z:0},250).index,249);
});
test('steady route tracking avoids at least 90 percent of redundant exact hypot calls',()=>{
 const route={points:Array.from({length:501},(_,i)=>({x:i,z:0}))},p={x:250.125,z:.125};
 const before=hypotCalls(()=>originalRoute(route,p,250)),after=hypotCalls(()=>nearestRoute(route,p,250));
 assert.equal(before,131);assert.ok(after<=Math.floor(before*.1),`${after} expensive distances, was ${before}`);
});
test('legacy coastline projections retain all values including degenerate segments and crossing ties',()=>{
 for(let k=0;k<150;k++){const p={x:-600+(k*73)%750,z:-850+(k*97)%1600};assert.deepEqual(nearestRoad(p),originalRoad(p));}
 const roads={a:[{x:0,z:0,s:0,halfWidth:6},{x:0,z:0,s:0,halfWidth:6}],b:[{x:-1,z:0,s:0,halfWidth:6},{x:1,z:0,s:2,halfWidth:6}]};
 assert.deepEqual(nearestRoad({x:0,z:0},roads),originalRoad({x:0,z:0},roads));
});
test('coastline startup search skips impossible distance evaluations',()=>{
 const p={x:0,z:-805};const before=hypotCalls(()=>originalRoad(p)),after=hypotCalls(()=>nearestRoad(p));
 assert.ok(after<before*.1,`${after} expensive distances, was ${before}`);
});
test('idle drawing wakes during camera damping and explicit changes; racing never skips draws',()=>{
 const gate=createPauseRendering();assert.equal(gate.draw(true),true);
 for(let n=0;n<600;n++)assert.equal(gate.draw(true),false);
 for(let n=0;n<30;n++)assert.equal(gate.draw(true,true),true,'camera damping must keep drawing');
 assert.equal(gate.draw(true),false);gate.invalidate();assert.equal(gate.draw(true),true);assert.equal(gate.draw(true),false);
 for(let n=0;n<600;n++)assert.equal(gate.draw(false),true);
 assert.equal(gate.stats.draws,632);
});
test('a real OrbitControls dolly schedules an idle draw even when the following update returns false',()=>{
 const camera=new PerspectiveCamera();camera.position.set(5,2,7);const controls=new OrbitControls(camera,null),gate=createPauseRendering();
 const stop=timing.bindRenderInvalidation?.(controls,gate)??(()=>{});
 try{
  gate.draw(true);assert.equal(gate.draw(true),false);const distance=camera.position.length();
  controls.dollyIn(.9);assert.ok(camera.position.length()<distance);assert.equal(controls.update(),false);
  assert.equal(gate.draw(true),true,'wheel/pinch already updated the camera before RAF');
  assert.equal(gate.draw(true),false);stop();controls.dollyIn(.9);assert.equal(gate.draw(true),false,'remove owned event listener');
 }finally{stop();}
});
