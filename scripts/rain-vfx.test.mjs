import test from 'node:test';import assert from 'node:assert/strict';
import {createRainVfx} from '../src/rebuild/rainVfx.js';
test('rain and contact spray use fixed buffers, respect quality and stop when dry or paused',()=>{
 const effect=createRainVfx(),geometry=effect.root.children[0].geometry;
 const state={position:{x:10,y:1,z:20},velocity:{x:0,z:20},kmh:72,wheels:Array.from({length:4},(_,i)=>({contact:true,point:{x:i,y:0,z:20}}))};
 effect.setBudget(36);for(let i=0;i<120;i++)effect.update(state,1/60,true);
 assert.equal(effect.stats().drops,36);assert.ok(effect.stats().spray>0&&effect.stats().spray<=36);assert.equal(effect.root.children[0].geometry,geometry);
 assert.ok([...geometry.attributes.position.array].every(Number.isFinite));
 const texture=effect.root.children[1].material.map;assert.equal(texture.image.data[3],0);assert.ok(texture.image.data[(16*32+16)*4+3]>200);
 state.wheels.forEach(w=>w.contact=false);for(let i=0;i<60;i++)effect.update(state,1/60,true);assert.equal(effect.stats().spray,0);
 effect.update(state,1/60,false);assert.equal(effect.stats().drops,0);assert.equal(effect.root.visible,false);effect.dispose();
});
