import test from 'node:test';import assert from 'node:assert/strict';
import {initPhysics} from '../src/driving/physics.js';
import {createRival,duelResult} from '../src/driving/rival.js';
test('rival physically finishes three gates and reset reproduces the same race',async()=>{
 await initPhysics();const r=createRival();try{const run=()=>{for(let i=0;i<12000&&r.race.phase!=='complete';i++)r.step();return structuredClone(r.race);};
 const a=run();assert.equal(a.valid,true);assert.equal(a.gate,3);assert.ok(a.elapsed>25&&a.elapsed<50);assert.equal(r.state.contacts,4);
 r.reset();assert.equal(r.race.elapsed,0);assert.equal(r.race.gate,0);const b=run();assert.ok(Math.abs(a.elapsed-b.elapsed)<.1);
 }finally{r.dispose();}
});
test('winner uses crossing times, invalid player never wins and rival failure is explicit',()=>{
 const a={valid:true,elapsed:35,gate:3},b={valid:true,elapsed:36,gate:3};
 assert.equal(duelResult(a,b),'승리');assert.equal(duelResult(b,a),'패배');assert.equal(duelResult(a,a),'무승부');
 assert.equal(duelResult({...a,valid:false},b),'무효 · 재도전');assert.equal(duelResult(a,{...b,valid:false}),'완주 · 라이벌 주행 실패');
});
