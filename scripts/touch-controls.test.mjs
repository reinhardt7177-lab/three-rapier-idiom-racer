import test from 'node:test';
import assert from 'node:assert/strict';
import {hasTouchInput,showTouchControls} from '../src/rebuild/touchControls.js';
import {landscapePresentation,createPresentationGuard} from '../src/rebuild/landscape.js';
import {createRaceInput,raceLayout} from '../src/rebuild/raceInput.js';

test('touch detection includes tablets with a mouse and desktop-mode touch browsers',()=>{
 assert.equal(hasTouchInput(),false);
 assert.equal(hasTouchInput({primaryCoarse:true}),true);
 assert.equal(hasTouchInput({primaryCoarse:false,anyCoarse:true}),true);
 assert.equal(hasTouchInput({primaryCoarse:false,anyCoarse:false,maxTouchPoints:5}),true);
 assert.equal(hasTouchInput({maxTouchPoints:0}),false);
});

test('phones, large tablets and manual fallback show pedals regardless of primary pointer',()=>{
 for(const [width,height] of [[844,390],[667,375],[1024,768],[1180,820],[1366,1024],[1920,1080]]){
  const stage=landscapePresentation(width,height,true);
  assert.equal(showTouchControls(stage.width,stage.height,{touch:true}),true,`${width}x${height}`);
  assert.equal(showTouchControls(stage.width,stage.height,{force:true}),true,'manual override');
 }
 for(const [width,height] of [[1280,720],[1024,576],[1920,1080]]){
  assert.equal(showTouchControls(width,height),false,'large keyboard-only window stays clear');
 }
});

test('layout guard matches the compact HUD at widths above 1000 and the 550px boundary',()=>{
 assert.equal(showTouchControls(1100,550),true);
 assert.equal(showTouchControls(1100,551),false);
 assert.equal(raceLayout(1100,550),'landscape-touch');
 assert.equal(raceLayout(1100,551),'landscape-keyboard');
 assert.equal(raceLayout(1366,768,true),'landscape-touch');
 assert.equal(raceLayout(700,394),'landscape-touch');
});

test('changing control visibility releases every owner and pauses once, not on address-bar resize',()=>{
 const input=createRaceInput(),pauses=[];
 const guard=createPresentationGuard({clear:()=>input.clear(),pause:reason=>pauses.push(reason)});
 guard.update({...landscapePresentation(1366,1024),controlsVisible:false});
 input.press('ArrowUp','pointer-1');input.press('ArrowRight','pointer-2');input.press('KeyW');
 guard.update({...landscapePresentation(1366,1024),controlsVisible:true});
 assert.equal(input.read().throttle,0);assert.equal(input.read().steer,0);
 assert.deepEqual(pauses,['layout']);
 guard.update({...landscapePresentation(1366,980),controlsVisible:true});
 assert.deepEqual(pauses,['layout']);
 input.press('ArrowUp','pointer-3');
 guard.update({...landscapePresentation(1366,980),controlsVisible:false});
 assert.equal(input.read().throttle,0);assert.deepEqual(pauses,['layout','layout']);
 input.press('KeyW','keyboard',true);assert.equal(input.read().throttle,0);
});

test('a hybrid tablet rotated to portrait blocks driving and clears simultaneous pedals',()=>{
 const touch=hasTouchInput({primaryCoarse:false,maxTouchPoints:10}),input=createRaceInput();
 const guard=createPresentationGuard({clear:()=>input.clear(),pause(){}});
 guard.update(landscapePresentation(1024,768,touch));
 input.press('ArrowUp','pointer-1');input.press('ArrowLeft','pointer-2');
 guard.update(landscapePresentation(768,1024,touch));
 assert.equal(guard.canDrive(),false);assert.equal(input.read().throttle,0);assert.equal(input.read().steer,0);
});
