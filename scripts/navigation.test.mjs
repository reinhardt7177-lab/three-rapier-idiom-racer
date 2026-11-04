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


function switchbacks(start=20){
 const n=400,length=n*5;let x=0,z=0;
 const points=Array.from({length:n},(_,i)=>{const a=i<start?0:i<start+20?(i-start)*.025:i<start+45?.5:i<start+65?.5-(i-start-45)*.025:0;
  const p={x,y:0,z,distance:i*5,dx:Math.sin(a),dz:Math.cos(a)};x+=p.dx*5;z+=p.dz*5;return p;});return {length,points};
}
test('a continuing bend previews the next independent corner rather than the next point of the same bend',()=>{
 const route=switchbacks(),guide=routeGuidance(route,25,125);
 assert.equal(guide.direction,'left');assert.equal(guide.distance,0);
 assert.equal(guide.next?.direction,'right');assert.ok(guide.next.distance>100&&guide.next.distance<250);
 assert.equal(routeGuidance(circle(),0).next,null,'a circular bend is one bend through the route seam');
 assert.equal(routeGuidance(route,25,route.length-30).next,null,'nothing beyond the finish');
});
test('high speed previews a bend earlier without changing low-speed finish or lap rules',()=>{
 const route=switchbacks(63),before=JSON.stringify(route);
 assert.equal(routeGuidance(route,0).direction,'straight');
 const fast=routeGuidance(route,0,0,route.length,{speedKmh:260});
 assert.equal(fast.direction,'left');assert.ok(fast.distance>250&&fast.distance<325);
 assert.equal(routeGuidance(route,398,1990,route.length*3).direction,'straight');
 assert.equal(routeGuidance(route,398,route.length*3-10,route.length*3,{speedKmh:260}).direction,'finish');
 assert.equal(JSON.stringify(route),before);
});
test('static corner lookup does not rescan the road on every HUD update',()=>{
 const route=switchbacks(63),original=route.points;let reads=0;
 route.points=new Proxy(original,{get(target,key,receiver){if(/^\d+$/.test(String(key)))reads++;return Reflect.get(target,key,receiver);}});
 routeGuidance(route,0);reads=0;
 for(let i=0;i<100;i++)routeGuidance(route,0,0,route.length,{speedKmh:260});
 assert.ok(reads<=600,`${reads} point reads for 100 cached announcements`);
});

test('invalid speeds cannot create a false urgent warning or extend the lookahead',()=>{
 const route=switchbacks(63),slow=routeGuidance(route,0);
 for(const speedKmh of [NaN,Infinity,-Infinity,-100])assert.deepEqual(routeGuidance(route,0,0,route.length,{speedKmh}),slow);
 const sharp=circle(1,180,35);
 assert.equal(routeGuidance(sharp,0,0,sharp.length,{speedKmh:90}).urgent,true);
});

test('cached announcement retains the original first corner at low speed on all four routes',()=>{
 for(const id of ['world','namak','yeosu','seongsamjae']){
  const route=JSON.parse(fs.readFileSync(new URL('../public/assets/rebuild/'+id+'-route.json',import.meta.url))),flags=routeBends(route),n=route.points.length;
  for(let index=0;index<n;index+=7){
   const origin=route.points[index].distance;let expected=null;
   for(let k=0;k<n;k++){const i=(index+k)%n,d=(route.points[i].distance-origin+route.length)%route.length;if(d>250)break;if(flags[i]){expected={...flags[i],distance:d<3?0:Math.max(5,Math.round(d/5)*5)};break;}}
   const actual=routeGuidance(route,index,0,route.length*3);
   assert.equal(actual.direction,expected?.direction??'straight',`${id}/${index}`);assert.equal(actual.distance,expected?.distance??250);assert.equal(actual.sharp,expected?.sharp??false);
  }
 }
});
