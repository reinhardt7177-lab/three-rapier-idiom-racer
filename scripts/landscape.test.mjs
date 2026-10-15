import test from 'node:test';
import assert from 'node:assert/strict';
import {landscapePresentation,createPresentationGuard,requestLandscapeFullscreen} from '../src/rebuild/landscape.js';
import {createRaceInput} from '../src/rebuild/raceInput.js';

test('landscape stage fits tall desktop panes, portrait phones and wide displays without cropping or stretching',()=>{
  for(const [width,height] of [[559,668],[700,780],[390,844],[844,390],[1280,720],[1920,1080],[2560,1080]]){
    const stage=landscapePresentation(width,height);
    assert.ok(Math.abs(stage.width/stage.height-16/9)<1e-12);
    assert.ok(stage.width<=width&&stage.height<=height);
    assert.ok(stage.width===width||Math.abs(stage.height-height)<1e-8);
    assert.equal(stage.blocked,false,'tall desktop panes still show the landscape game');
  }
  assert.deepEqual(landscapePresentation(0,0),{width:0,height:0,orientation:'landscape',blocked:false});
});

test('touch portrait requires rotation; landscape touch and narrow desktop remain usable',()=>{
  assert.ok(landscapePresentation(390,844,true).blocked);
  assert.ok(!landscapePresentation(844,390,true).blocked);
  assert.ok(!landscapePresentation(559,668,false).blocked);
});

test('physical viewport rotation clears simultaneous pedals even though the game stage stays landscape',()=>{
  const input=createRaceInput(),pauses=[];
  const guard=createPresentationGuard({clear:()=>input.clear(),pause:reason=>pauses.push(reason)});
  guard.update(landscapePresentation(844,390,true));
  input.press('ArrowUp','pointer-1');input.press('ArrowRight','pointer-2');input.press('KeyW');
  guard.update(landscapePresentation(390,844,true));
  assert.deepEqual(input.read(),{throttle:0,brake:0,reverse:0,steer:0,handbrake:false,boost:false});
  assert.equal(guard.canDrive(),false);assert.deepEqual(pauses,['orientation']);
  guard.update(landscapePresentation(390,800,true));assert.deepEqual(pauses,['orientation']);
  guard.update(landscapePresentation(844,390,true));assert.equal(guard.canDrive(),true);
  assert.deepEqual(pauses,['orientation','layout'],'rotation back pauses rather than automatically restarting');
  input.press('KeyW','keyboard',true);assert.equal(input.read().throttle,0);
});

test('initial portrait or switching from fine pointer to portrait touch blocks controls',()=>{
  const pauses=[];const guard=createPresentationGuard({clear(){},pause:r=>pauses.push(r)});
  guard.update(landscapePresentation(559,668));assert.equal(guard.canDrive(),true);
  guard.update(landscapePresentation(559,668,true));assert.equal(guard.canDrive(),false);
  assert.deepEqual(pauses,['orientation']);
});

test('fullscreen is requested before the orientation lock, on an explicit user action',async()=>{
  const calls=[],doc={fullscreenElement:null};
  const el={async requestFullscreen(options){calls.push(['fullscreen',options]);doc.fullscreenElement=el;}};
  const orientation={async lock(value){assert.equal(doc.fullscreenElement,el);calls.push(['lock',value]);}};
  assert.deepEqual(await requestLandscapeFullscreen(el,{documentApi:doc,orientation}),{fullscreen:true,locked:true});
  assert.deepEqual(calls,[['fullscreen',{navigationUI:'hide'}],['lock','landscape']]);
});

test('denied fullscreen, missing API, denied lock and already fullscreen are handled without a false success',async()=>{
  const doc={fullscreenElement:null};let locks=0;
  const orientation={async lock(){locks++;throw new Error('not supported');}};
  assert.deepEqual(await requestLandscapeFullscreen({}, {documentApi:doc,orientation}),{fullscreen:false,locked:false});
  assert.deepEqual(await requestLandscapeFullscreen({async requestFullscreen(){throw new Error('denied');}}, {documentApi:doc,orientation}),{fullscreen:false,locked:false});
  assert.equal(locks,0);
  doc.fullscreenElement={};
  assert.deepEqual(await requestLandscapeFullscreen({}, {documentApi:doc,orientation}),{fullscreen:true,locked:false});
  assert.equal(locks,1);
  assert.deepEqual(await requestLandscapeFullscreen({}, {documentApi:doc,orientation:{}}),{fullscreen:true,locked:false});
});
