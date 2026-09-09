import test from 'node:test';
import assert from 'node:assert/strict';
import { newSprint, updateSprint, recordSprint } from '../src/driving/sprint.js';
import { completeChapter, newCampaign } from '../src/campaign/campaign.js';
import { createFrameLoop } from '../src/driving/frameLoop.js';

const cooldown = () => ({...newSprint(), phase:'cooldown', elapsed:32, splits:[8,20,32], gate:3});
const car = (contacts=0, kmh=0, y=.6) => ({contacts, kmh, position:{x:0,z:0,y}});
test('finish rescue does not change valid time, and normal braking still completes', () => {
  let s=cooldown();
  for(let i=0;i<7*120;i++) s=updateSprint(s,car(4,70),car(4,70),1/120);
  assert.equal(s.phase,'cooldown'); assert.equal(s.elapsed,32);
  s=updateSprint(s,car(4,.05),car(4,.05),1/120);
  assert.equal(s.phase,'complete'); assert.equal(s.valid,true); assert.equal(s.elapsed,32);
});
test('an overturned finish has a bounded explicit failure, never a PB or license', () => {
  let s=cooldown();
  for(let i=0;i<7*120;i++) s=updateSprint(s,car(),car(),1/120);
  assert.equal(s.phase,'cooldown');
  for(let i=0;i<122;i++) s=updateSprint(s,car(),car(),1/120);
  assert.equal(s.phase,'complete'); assert.equal(s.valid,false);
  assert.match(s.reason,/안전 정지/); assert.equal(s.elapsed,32);
  const writes=[]; const storage={getItem:()=>null,setItem:(...args)=>writes.push(args)};
  recordSprint(s,storage);
  const result=completeChapter(newCampaign(),s,'standard',storage);
  assert.equal(result.profile.license,false); assert.equal(result.awarded,false);
  assert.deepEqual(writes,[]);
  assert.equal(newSprint().cooldownElapsed ?? 0,0);
});
test('a finish falling below the world exits immediately without teleporting', () => {
  const current=car(0,40,-10), before=structuredClone(current);
  const s=updateSprint(cooldown(),car(),current,1/120);
  assert.equal(s.phase,'complete'); assert.equal(s.valid,false);
  assert.deepEqual(current,before);
});
test('frame loop queues one frame across repeated starts and visibility changes', () => {
  const jobs=new Map(); let id=0, isHidden=true, renders=0;
  const loop=createFrameLoop(()=>renders++,{request:cb=>{jobs.set(++id,cb);return id;},cancel:key=>jobs.delete(key),hidden:()=>isHidden});
  loop.start(); assert.equal(jobs.size,0);
  isHidden=false; loop.start(); loop.start(); assert.equal(jobs.size,1);
  const [key,cb]=[...jobs][0]; jobs.delete(key); cb(10); assert.equal(renders,1); assert.equal(jobs.size,1);
  isHidden=true; loop.stop(); assert.equal(jobs.size,0);
  isHidden=false; loop.start(); loop.start(); assert.equal(jobs.size,1);
  loop.dispose(); loop.dispose(); loop.start(); assert.equal(jobs.size,0);
});
test('a pending frame which becomes hidden neither renders nor requeues', () => {
  let callback,isHidden=false,renders=0,requested=0;
  const loop=createFrameLoop(()=>renders++,{request:cb=>{callback=cb;return ++requested;},cancel:()=>{},hidden:()=>isHidden});
  loop.start(); isHidden=true; callback(10); assert.equal(renders,0); assert.equal(requested,1);
  isHidden=false; loop.start(); assert.equal(requested,2); loop.dispose();
});
