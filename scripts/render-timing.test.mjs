import {createRenderProfile,classifyDraw} from '../src/rebuild/renderProfile.js';
import * as THREE from 'three';
import {createFrozenComparison,createFrozenTreadTrial} from '../src/rebuild/frozenComparison.js';

test('frozen renderer comparison captures all three A/B/A phases and always restores full geometry',()=>{
 const modes=[],snapshots=[];let resets=0,cost=0;
 const c=createFrozenComparison({framesPerPhase:3,apply:m=>modes.push(m),reset:()=>resets++,measure:()=>({cost:++cost})});
 c.start();c.start();assert.equal(resets,1);
 const times=[0,16,32,232,248,264,280,296,312];
 for(let i=0;i<9;i++){assert.equal(c.active(),true);c.record(times[i]);snapshots.push(c.snapshot());}
 assert.equal(c.active(),false);assert.equal(c.snapshot().status,'complete');
 assert.deepEqual(modes,['full','tread','full','full']);assert.equal(resets,3);
 assert.deepEqual(c.snapshot().results.map(r=>[r.phase,r.frames,r.complete,r.measurement.cost]),[['full-before',3,true,1],['tread-only',3,true,2],['full-after',3,true,3]]);
 c.record();assert.equal(c.snapshot().results.length,3);
 assert.equal(c.snapshot().intervals.length,8);assert.ok(c.snapshot().intervals.some(i=>i.phase==='tread-only'&&i.gapMs===200),'Phase reset cannot erase a slow transition interval');
 assert.equal(c.snapshot().transitions.length,4);
});

test('cancelled frozen comparisons retain partial evidence and cannot continue a half-finished draw set',()=>{
 const modes=[],c=createFrozenComparison({framesPerPhase:3,apply:m=>modes.push(m),reset:()=>{},measure:()=>({raw:[1,50,200]})});
 c.start();for(let i=0;i<4;i++)c.record();c.cancel();
 assert.equal(c.active(),false);assert.equal(modes.at(-1),'full');
 assert.deepEqual(c.snapshot().results.map(r=>[r.phase,r.frames,r.complete]),[['full-before',3,true],['tread-only',1,false]]);
 c.start();c.record();assert.equal(c.snapshot().results.length,2);
});

test('frozen tread A/B changes only distant rival accents and restores authored visibility and resources',()=>{
 const material=new THREE.MeshStandardMaterial();material.name='Tread grooves';
 const geometry=new THREE.SphereGeometry(.35,12,8),views=[];
 for(let i=0;i<2;i++){
  const root=new THREE.Group(),wheel=new THREE.Group(),tread=new THREE.Mesh(geometry,material),tyre=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
  root.add(wheel);wheel.add(tread,tyre);const hidden=tread.clone();hidden.visible=false;wheel.add(hidden);views.push({root,wheel,tread,tyre,hidden});
 }
 const camera=new THREE.PerspectiveCamera(60,16/9,.1,1000);camera.position.z=100;
 const before=views.map(v=>({root:v.root.position.toArray(),rotation:v.wheel.quaternion.toArray()}));
 const trial=createFrozenTreadTrial(views,camera,720);assert.equal(trial.snapshot().eligible,1);
 trial.apply('tread');assert.equal(views[0].tread.visible,true);assert.equal(views[1].tread.visible,false);
 for(const v of views){assert.equal(v.tyre.visible,true);assert.equal(v.hidden.visible,false);assert.equal(v.tread.geometry,geometry);assert.equal(v.tread.material,material);}
 assert.deepEqual(views.map(v=>({root:v.root.position.toArray(),rotation:v.wheel.quaternion.toArray()})),before);
 trial.apply('full');assert.ok(views.every(v=>v.tread.visible&&!v.hidden.visible));
});

test('frozen tyre projection leaves close and behind-camera accents intact',()=>{
 const roots=[new THREE.Group(),new THREE.Group()],mat=new THREE.MeshStandardMaterial();mat.name='Tread grooves';
 roots.forEach(r=>r.add(new THREE.Mesh(new THREE.SphereGeometry(.35,8,4),mat)));
 const camera=new THREE.PerspectiveCamera(60,16/9,.1,1000);camera.position.z=3;
 assert.equal(createFrozenTreadTrial(roots.map(root=>({root})),camera,720).snapshot().eligible,0);
 camera.position.z=-3;assert.equal(createFrozenTreadTrial(roots.map(root=>({root})),camera,720).snapshot().eligible,0);
});
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRenderTiming,createPauseRendering,createFrameEvidence} from '../src/rebuild/renderTiming.js';
import {createFrameMetrics} from '../src/rebuild/worldRendering.js';
import {createRacePreparation,createRaceStartBoundary} from '../src/rebuild/racePreparation.js';

test('slow frame intervals remain visible when CPU submission is short',()=>{
 const frames=createFrameMetrics(),info={calls:868,triangles:1_279_323};
 frames.record(0,info,{workMs:5,physicsMs:1,renderMs:3});
 for(const now of [16,49,82])frames.record(now,info,{workMs:5,physicsMs:1,renderMs:3});
 const s=frames.snapshot();assert.equal(s.p95Ms,33);assert.equal(s.cpu.workMs.p95,5);
 assert.equal(s.cpu.physicsMs.mean,1);assert.equal(s.cpu.renderMs.mean,3);
 assert.equal(s.samples,3);assert.equal(s.calls,868);
});

test('missing CPU observations are explicit and sessions cannot reuse old cost samples',()=>{
 const costs=createRenderTiming(3);
 costs.record({workMs:6,physicsMs:1,renderMs:3});costs.record({workMs:8,physicsMs:NaN,renderMs:-1});costs.record({workMs:10});
 const s=costs.snapshot();assert.equal(s.physicsMs.missing,2);assert.equal(s.renderMs.samples,1);
 costs.record({workMs:2,physicsMs:0,renderMs:1});assert.equal(costs.snapshot().workMs.max,10);
 costs.reset();assert.deepEqual(costs.snapshot().workMs,{samples:0,missing:0});
});

test('pause draws once, remains idle, and redraws after resize or camera changes',()=>{
 const gate=createPauseRendering();let draws=0;
 for(let i=0;i<600;i++)if(gate.draw(true))draws++;
 assert.equal(draws,1);
 gate.invalidate();assert.equal(gate.draw(true),true);assert.equal(gate.draw(true),false);
 for(let i=0;i<120;i++)assert.equal(gate.draw(false),true);
 gate.invalidate();assert.equal(gate.draw(true),true);assert.equal(gate.draw(true),false);
});

test('frame and CPU measurements reset together after a pause',()=>{
 const frames=createFrameMetrics(),info={calls:1,triangles:2};
 frames.record(0,info);frames.record(17,info,{workMs:8,physicsMs:2,renderMs:4});
 frames.reset();frames.record(10000,info,{workMs:1,physicsMs:0,renderMs:1});
 assert.deepEqual(frames.snapshot(),{samples:0});
 frames.record(10017,info,{workMs:2,physicsMs:1,renderMs:1});
 assert.equal(frames.snapshot().cpu.workMs.max,2);assert.equal(frames.snapshot().maxMs,17);
});

test('slow gaps preserve previous callback work and both focus endpoints without filtering',()=>{
 const evidence=createFrameEvidence(2),context={visible:true,focused:false,callbackDelayMs:0,droppedSeconds:0};
 const cost={workMs:80,physicsMs:5,renderMs:70};
 evidence.record(0,cost,context);cost.workMs=999;context.focused=true;
 evidence.record(100,{workMs:3},{visible:true,focused:true,callbackDelayMs:2});
 const s=evidence.snapshot();assert.equal(s.spikes[0].previous.cpu.workMs,80);
 assert.equal(s.spikes[0].previous.context.focused,false);assert.equal(s.spikes[0].current.cpu.workMs,3);
 s.spikes[0].previous.cpu.workMs=123;assert.equal(evidence.snapshot().spikes[0].previous.cpu.workMs,80);
 evidence.record(1100,{workMs:4},{visible:false});evidence.record(2100,{workMs:5},{visible:true});
 assert.equal(evidence.snapshot().slowIntervals,3);assert.equal(evidence.snapshot().evicted,1);
 assert.equal(evidence.snapshot().spikes[0].current.context.visible,false);
 evidence.reset();assert.deepEqual(evidence.snapshot(),{totalIntervals:0,slowIntervals:0,retained:0,evicted:0,spikes:[]});
});

test('rolling frame averages cannot erase session slow gap evidence',()=>{
 const frames=createFrameMetrics(2),info={calls:1,triangles:2};
 frames.record(0,info,{workMs:3},{visible:true});frames.record(1000,info,{workMs:4},{visible:true});
 frames.record(1017,info,{workMs:2});frames.record(1034,info,{workMs:2});
 const s=frames.snapshot();assert.equal(s.over50Ms,0);assert.equal(s.evidence.slowIntervals,1);
 assert.equal(s.evidence.spikes[0].gapMs,1000);assert.equal(s.evidence.spikes[0].previous.cpu.workMs,3);
});

test('race waits for asynchronous shaders and warm draw; duplicate starts cannot move the clock',async()=>{
 let resolve,clockStarts=0,draws=0,setups=0,time=0;
 const gate=createRacePreparation({now:()=>time,yieldTurn:async()=>{}});
 const task={setup(){setups++;time+=5;},compile:()=>new Promise(r=>resolve=r),draw(){draws++;time+=40;},ready(){clockStarts++;}};
 const running=gate.run(task);await Promise.resolve();assert.equal(gate.blocked(),true);
 assert.equal(await gate.run(task),false);assert.equal(setups,1);assert.equal(draws,0);assert.equal(clockStarts,0);
 time+=5000;resolve();assert.equal(await running,true);assert.equal(clockStarts,1);assert.equal(draws,1);
 assert.deepEqual(gate.snapshot(),{phase:'ready',busy:false,error:null,setupMs:5,compileMs:5000,drawMs:40,totalMs:5045});
});

test('garage/disposal cancellation prevents a pending preparation from drawing stale objects',async()=>{
 let resolve,draws=0,starts=0;
 const gate=createRacePreparation({yieldTurn:async()=>{}});
 const running=gate.run({setup(){},compile:()=>new Promise(r=>resolve=r),draw(){draws++;},ready(){starts++;}});
 await Promise.resolve();gate.cancel();resolve();assert.equal(await running,false);
 assert.equal(draws,0);assert.equal(starts,0);assert.equal(gate.blocked(),false);
});

test('preparation errors keep driving blocked, expose the cause, and permit a clean retry',async()=>{
 let starts=0;const gate=createRacePreparation({yieldTurn:async()=>{}});
 const task={setup(){},compile:async()=>{throw new Error('shader preparation failed');},draw(){throw new Error('must not draw');},ready(){starts++;}};
 assert.equal(await gate.run(task),false);assert.equal(gate.blocked(),true);assert.equal(starts,0);
 assert.equal(gate.snapshot().error,'shader preparation failed');
 assert.equal(await gate.run({...task,compile:async()=>{},draw(){}}),true);
 assert.equal(starts,1);assert.equal(gate.blocked(),false);assert.equal(gate.snapshot().error,null);
});

test('preparation timestamp boundary retains wait costs and cannot admit stale animation timestamps',()=>{
 const gate=createRaceStartBoundary();gate.begin(1500);
 assert.equal(gate.enter(1000,1510).accepted,false);assert.equal(gate.enter(1499,1520).accepted,false);
 assert.equal(gate.pending(),true);assert.deepEqual(gate.enter(1516,1530),{accepted:true,first:true});
 assert.deepEqual(gate.snapshot(),{pending:false,readyAtMs:1500,firstFrameWaitMs:30,skippedFrames:2});
 assert.deepEqual(gate.enter(2516,2530),{accepted:true,first:false});
 assert.equal(gate.snapshot().firstFrameWaitMs,30);gate.cancel();assert.equal(gate.pending(),false);
});

function profileFixture(gpuSupported=false){
 let time=0,available=false,disjoint=false,deleted=0;const ext={TIME_ELAPSED_EXT:1,GPU_DISJOINT_EXT:2};
 const gl={QUERY_RESULT_AVAILABLE:3,QUERY_RESULT:4,CURRENT_QUERY:5,getExtension:()=>gpuSupported?ext:null,getParameter:()=>disjoint,getQuery:()=>null,createQuery:()=>({}),beginQuery(){},endQuery(){},getQueryParameter:(q,p)=>p===3?available:2_500_000,deleteQuery(){deleted++;}};
 const camera={},shadow={},vehicle={},road={},renderer={getContext:()=>gl,info:{render:{calls:0,triangles:0}},renderBufferDirect(c,s,g,m,o){time+=2;this.info.render.calls++;this.info.render.triangles+=3;return o;},render(){time++;this.renderBufferDirect(camera,null,null,null,vehicle);this.renderBufferDirect(shadow,null,null,null,road);time++;return 7;}};
 return {renderer,camera,now:()=>time,vehicle,road,setAvailable:v=>available=v,setDisjoint:v=>disjoint=v,deleted:()=>deleted};
}
test('draw profile counts main/shadow deltas while leaving render results and hooks intact',()=>{
 const f=profileFixture(),original=f.renderer.renderBufferDirect,p=createRenderProfile(f.renderer,{now:f.now,classify:o=>o===f.vehicle?'vehicle':'road',every:2});
 assert.equal(p.render({},f.camera),7);assert.equal(f.renderer.renderBufferDirect,original);let s=p.snapshot();
 assert.equal(s.gpu.supported,false);assert.equal(s.records[0].calls,2);assert.equal(s.records[0].triangles,6);assert.equal(s.records[0].drawCpuMs,4);assert.equal(s.records[0].otherCpuMs,2);
 assert.equal(s.records[0].unattributedCalls,0);assert.deepEqual(s.records[0].buckets.map(b=>b.pass),['main','shadow']);
 p.render({},f.camera);assert.equal(p.snapshot().records.length,1);s.records[0].buckets[0].calls=999;assert.equal(p.snapshot().records[0].buckets[0].calls,1);p.dispose();
});
test('GPU profile polls after a browser turn, rejects disjoint data and frees bounded queries',()=>{
 const f=profileFixture(true),p=createRenderProfile(f.renderer,{now:f.now,every:1});p.render({},f.camera);assert.equal(p.snapshot().gpu.samples.length,0);
 f.setAvailable(true);p.render({},f.camera);assert.equal(p.snapshot().gpu.samples[0].ms,2.5);assert.equal(f.deleted(),1);
 f.setAvailable(false);f.setDisjoint(true);p.render({},f.camera);assert.equal(p.snapshot().gpu.invalid,1);assert.equal(p.snapshot().gpu.pending,0);
 f.setDisjoint(false);for(let i=0;i<6;i++)p.render({},f.camera);assert.equal(p.snapshot().gpu.pending,4);assert.ok(p.snapshot().gpu.skipped>=2);p.dispose();assert.equal(f.deleted(),6);
});
test('render failure preserves the original exception, restores the hook and deletes the GPU query',()=>{
 const f=profileFixture(true),original=f.renderer.renderBufferDirect,p=createRenderProfile(f.renderer,{now:f.now,every:1});f.renderer.render=()=>{throw new Error('draw failed');};
 assert.throws(()=>p.render({},f.camera),/draw failed/);assert.equal(f.renderer.renderBufferDirect,original);assert.equal(p.snapshot().records[0].completed,false);assert.equal(p.snapshot().gpu.pending,0);assert.equal(f.deleted(),1);p.dispose();
});
test('draw categories use actual scene ancestry and keep parked cars separate from world meshes',()=>{
 const world={},vehicle={},parked={name:'Namak_Parked_supra_80',parent:world},sky={};
 assert.equal(classifyDraw({name:'Road_Asphalt_1',parent:world},{world}),'road');
 assert.equal(classifyDraw({material:{name:'Namak_Leaf'},parent:world},{world}),'vegetation');
 assert.equal(classifyDraw({parent:parked},{world}),'parked');assert.equal(classifyDraw({parent:vehicle},{world,vehicles:[vehicle]}),'vehicle');assert.equal(classifyDraw(sky,{world,sky}),'sky');
});
