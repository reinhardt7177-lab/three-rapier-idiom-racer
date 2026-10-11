import test from 'node:test';
import assert from 'node:assert/strict';
import {createRenderTiming,createPauseRendering,createFrameEvidence} from '../src/rebuild/renderTiming.js';
import {createFrameMetrics} from '../src/rebuild/worldRendering.js';

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
