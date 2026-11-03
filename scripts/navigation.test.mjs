import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PerspectiveCamera,Vector3} from 'three';
import {routeBends,routeGuidance} from '../src/rebuild/routeGuidance.js';
import * as navigation from '../src/rebuild/routeGuidance.js';

// A real centreline, not just arbitrarily signed heading metadata. At +Z,
// +X is the driver's LEFT when viewed from behind with world-up +Y.
function circle(sign=1,n=180,radius=100,yaw=0){
 const c=Math.cos(yaw),s=Math.sin(yaw),length=Math.PI*2*radius;
 return {length,points:Array.from({length:n},(_,i)=>{const a=i*Math.PI*2/n,x=sign*radius*(1-Math.cos(a)),z=radius*Math.sin(a),dx=sign*Math.sin(a),dz=Math.cos(a);return {x:c*x+s*z,y:0,z:-s*x+c*z,dx:c*dx+s*dz,dz:-s*dx+c*dz,distance:i*length/n};})};
}
test('left and right arrow paths point to their screen side without a CSS mirror transform',()=>{
 for(const direction of ['left','right']){
  const path=navigation.routeArrowPath?.(direction);assert.equal(typeof path,'string');
  const start=Number(path.match(/^M(\d+)/)?.[1]),tip=Number(path.match(/H(\d+)/)?.[1]);
  assert.ok(direction==='left'?tip<start:tip>start,`${direction}: arrowhead must face its stated screen side`);
 }
 assert.equal(navigation.routeArrowPath('straight'),navigation.routeArrowPath('finish'));
});
for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2])test(`navigation follows the actual driver-camera side at yaw ${yaw}`,()=>{
 for(const sign of [-1,1]){
  const route=circle(sign,180,100,yaw),origin=route.points[0],camera=new PerspectiveCamera(60,16/9,.1,1000);
  camera.position.set(origin.x-origin.dx*10,2,origin.z-origin.dz*10);camera.lookAt(origin.x+origin.dx*20,2,origin.z+origin.dz*20);camera.updateMatrixWorld(true);
  const target=route.points[8],screen=new Vector3(target.x,2,target.z).project(camera),expected=screen.x<0?'left':'right';
  assert.equal(expected,sign===1?'left':'right');
  for(const index of [0,45,90,179])assert.equal(routeGuidance(route,index).direction,expected);
 }
});

test('all four authored courses agree with geometric road tangents, not a mirrored heading convention',()=>{
 const reports=[];
 for(const id of ['world','namak','yeosu','seongsamjae']){
  const route=JSON.parse(fs.readFileSync(new URL('../public/assets/rebuild/'+id+'-route.json',import.meta.url))),p=route.points,n=p.length,flags=routeBends(route);let checked=0;
  const forward=(a,b)=>(b-a+route.length)%route.length;
  for(let i=0;i<n;i++){
   if(!flags[i])continue;let a=i,b=i;
   for(let k=1;k<n;k++){a=(i-k+n)%n;if(forward(p[a].distance,p[i].distance)>=15)break;}
   for(let k=1;k<n;k++){b=(i+k)%n;if(forward(p[i].distance,p[b].distance)>=15)break;}
   const prev=p[(a-1+n)%n],next=p[(a+1)%n],prev2=p[(b-1+n)%n],next2=p[(b+1)%n];
   const incoming=new Vector3(next.x-prev.x,0,next.z-prev.z).normalize(),outgoing=new Vector3(next2.x-prev2.x,0,next2.z-prev2.z).normalize();
   const right=new Vector3().crossVectors(incoming,new Vector3(0,1,0)),side=outgoing.dot(right);
   // Skip nearly straight/noisy inflections: a side must be geometrically resolved.
   if(Math.abs(side)<.08)continue;
   assert.equal(flags[i].direction,side<0?'left':'right',`${id} road point ${i}`);checked++;
  }
  assert.ok(checked>50,`${id} must contain many independently checked bends`);reports.push({id,checked});
 }
 console.log('Geometric course guidance',reports);
});

