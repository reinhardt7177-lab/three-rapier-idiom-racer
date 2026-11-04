import test from 'node:test';
import assert from 'node:assert/strict';
import * as pose from '../src/rebuild/vehiclePose.js';
import {createRaceInput} from '../src/rebuild/raceInput.js';

test('recovery avoids a civilian occupying the preferred lane without moving forward',()=>{
 const route={length:1000,points:Array.from({length:100},(_,i)=>({distance:i*10}))};
 const car={state:{position:{x:900,y:1,z:0}}},other={state:{position:{x:600,y:1,z:0}}};
 const civilian={state:{position:{x:240,y:1,z:3},velocity:{x:0,y:0,z:0}}};
 const obstacles=pose.recoveryObstacles?.(car,[car,other],[civilian])??[other.state];
 const spawn=(index,lane)=>({position:{x:index*10,y:1,z:lane}});
 const found=pose.findRecoveryPose(route,24,[3,-3,0],obstacles,spawn);
 assert.ok(found);assert.notDeepEqual(found.pose.position,civilian.state.position);
 assert.equal(found.index,24);assert.equal(found.lane,-3);assert.ok(!obstacles.includes(car.state));
 assert.deepEqual(civilian.state.position,{x:240,y:1,z:3});
});
test('recovery also respects the next second of civilian travel and fails safely when all candidates are occupied',()=>{
 const car={state:{position:{x:0,y:1,z:0}}},moving={state:{position:{x:240,y:1,z:12},velocity:{x:0,y:0,z:-10}}};
 const obstacles=pose.recoveryObstacles?.(car,[car],[moving])??[];
 assert.equal(pose.recoverySpaceClear({x:240,y:1,z:3},obstacles),false);
 const route={length:100,points:Array.from({length:10},(_,i)=>({distance:i*10}))};
 const occupied=Array.from({length:10},(_,i)=>({state:{position:{x:i*10,y:1,z:0},velocity:{x:0,y:0,z:0}}}));
 const all=pose.recoveryObstacles?.(car,[car],occupied)??[];
 assert.equal(pose.findRecoveryPose(route,5,[0],all,i=>({position:{x:i*10,y:1,z:0}})),null);
});
test('touch drift can combine gas and steering, with independent pointer and keyboard release',()=>{
 const input=createRaceInput();input.press('ArrowUp','pointer-gas');input.press('ArrowRight','pointer-turn');input.press('TouchDrift','pointer-drift');
 assert.deepEqual(input.read(),{throttle:1,brake:0,reverse:0,steer:1,handbrake:true,boost:false});
 input.press('ShiftLeft');input.release('TouchDrift','pointer-drift');assert.equal(input.read().handbrake,true);
 input.release('ShiftLeft');assert.equal(input.read().handbrake,false);assert.equal(input.read().throttle,1);
 input.press('TouchDrift','pointer-1');input.press('TouchDrift','pointer-2');input.release('TouchDrift','pointer-1');assert.equal(input.read().handbrake,true);
 input.clear();assert.deepEqual(input.read(),{throttle:0,brake:0,reverse:0,steer:0,handbrake:false,boost:false});
});
