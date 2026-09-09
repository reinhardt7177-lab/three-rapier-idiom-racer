import test from 'node:test';
import assert from 'node:assert/strict';
import {createGhostRecorder,createGhostSampler,validateGhost,loadGhost,saveGhost,GHOST_KEY,GHOST_LIMIT} from '../src/driving/ghost.js';
import {createGT} from '../src/garage/gt.js';
import {createGhostView} from '../src/driving/ghostView.js';
import {createSceneDisposer} from '../src/rendering/sceneResources.js';
import {Scene} from 'three';
const state=t=>({position:{x:0,y:.6,z:t*10},rotation:{x:0,y:0,z:0,w:1},wheels:Array.from({length:4},()=>({y:.38,steering:0,rotation:t*25}))});
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
function record(time=6){const r=createGhostRecorder();r.start(state(0));for(let i=1;i<=time*120;i++)r.capture(i/120,state(i/120),i===time*120);return r.finish({phase:'complete',valid:true,gate:3,elapsed:time,splits:[2,4,time]});}
test('records bounded real-time snapshots including start and finish; copies storage data',()=>{
 const d=record();assert.ok(d);assert.equal(d.samples.length,121);assert.equal(d.samples[0][0],0);assert.equal(d.samples.at(-1)[0],6);
 const c=validateGhost(d);c.samples[0][1]=20;assert.equal(d.samples[0][1],0);
});
test('playback uses race time, interpolates wheels and quaternion, and is deterministic after seek/pause',()=>{
 const d=record(),sample=createGhostSampler();const a=sample(d,2.025);assert.ok(Math.abs(a.position.z-20.25)<.001);assert.ok(Math.abs(a.wheels[0].rotation-50.625)<.001);
 assert.deepEqual(sample(d,2.025),a);sample(d,5);assert.deepEqual(sample(d,2.025),a);assert.equal(sample(d,6.1),null);assert.equal(sample(d,-1),null);
 const flipped=structuredClone(d);flipped.samples[1].splice(4,4,0,0,0,-1);assert.ok(Math.abs(sample(flipped,.025).rotation.w-1)<.001);
});
test('invalid/recovered/incomplete/overlong runs cannot create a ghost',()=>{
 const r=createGhostRecorder();r.start(state(0));r.capture(6,state(6),true);
 assert.equal(r.finish({phase:'complete',valid:false,gate:3,elapsed:6,splits:[2,4,6]}),null);
 r.clear();assert.equal(r.finish({phase:'complete',valid:true,gate:3,elapsed:6,splits:[2,4,6]}),null);
 r.start(state(0));r.capture(GHOST_LIMIT+1,state(1));assert.equal(r.finish({phase:'complete',valid:true,gate:3,elapsed:6,splits:[2,4,6]}),null);
});
test('version, route, malformed gaps, missing values and discontinuities are rejected',()=>{
 for(const mutate of [d=>d.version=2,d=>d.physics='new',d=>d.route='other',d=>delete d.samples[2][1],d=>d.samples[2][1]=100,d=>d.samples[1][0]=0,d=>d.samples[1][4]=5,d=>d.splits[1]=1]){const d=record();mutate(d);assert.equal(validateGhost(d),null);}
});
test('faster ghosts win; blocked saving is retried and incompatible data is never overwritten',()=>{
 const s=memory(),a=record(6),b=record(7);let saved=saveGhost(a,null,s);assert.equal(saved.saved,true);assert.equal(loadGhost(s).time,6);
 saved=saveGhost(b,a,s);assert.equal(saved.best.time,6);
 const blocked=saveGhost(a,null,{getItem:()=>null,setItem(){throw Error('denied');}});assert.equal(blocked.saved,false);assert.equal(blocked.best.time,6);
 const fresh=memory();assert.equal(saveGhost(b,blocked.best,fresh).saved,true);assert.equal(loadGhost(fresh).time,6);
 const future=JSON.stringify({...a,physics:'future'});fresh.setItem(GHOST_KEY,future);assert.equal(saveGhost(a,null,fresh).saved,false);assert.equal(fresh.getItem(GHOST_KEY),future);
 assert.equal(saveGhost(a,null,{getItem:()=>null,setItem(){}}).saved,false);
});
test('ghost uses shared geometry, independent translucent material, recorded wheels and overlap fade',()=>{
 const gt=createGT(),ghost=createGhostView(gt,.2),scene=new Scene();scene.add(gt.root,ghost.root);
 assert.equal(ghost.update(state(0),{x:0,z:0},true),false);
 assert.equal(ghost.update(state(2),{x:0,z:0},true),true);
 assert.equal(ghost.root.position.z,20);assert.ok(Math.abs(ghost.root.position.y-.4)<.0001);
 ghost.root.traverse(o=>{if(o.isMesh){assert.equal(o.castShadow,false);assert.equal(o.material.depthWrite,false);assert.equal(o.material.transparent,true);}});
 assert.equal(gt.paint.transparent,false);assert.equal(ghost.update(state(2),{x:0,z:0},false),false);createSceneDisposer(scene)();
});
