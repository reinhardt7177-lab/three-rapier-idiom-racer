import test from 'node:test';
import assert from 'node:assert/strict';
import {aiInput} from './course-gap.mjs';
const route={length:4000,points:Array.from({length:800},(_,i)=>({x:0,y:0,z:i*5,dx:0,dz:1,distance:i*5}))};
const state={position:{x:0,y:.53,z:100},rotation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:10},speed:10,kmh:36,steeringLimit:.52};
const lead=gap=>({...state,position:{...state.position,z:100+gap}});
const options={trafficGap:12,speedProfile:{maxSpeed:245,lateralAcceleration:7.3}};
test('restoring a short moving headway briefly slows below the lead rather than following forever',()=>{
 const front=lead(8),before=JSON.stringify([state,front]);
 const input=aiInput(route,state,20,0,1,[front],{...options,restoreFollowGap:true});
 assert.ok(input.targetKmh>0&&input.targetKmh<front.kmh);
 assert.equal(input.throttle,0);assert.ok(input.brake>0&&input.brake<1);
 assert.equal(input.waitingForTraffic,false);assert.equal(JSON.stringify([state,front]),before);
});
test('the existing gap remains the target and ordinary no-traffic-race behavior is preserved',()=>{
 const centred=aiInput(route,state,20,0,1,[lead(12)],{...options,restoreFollowGap:true});
 assert.equal(centred.targetKmh,36);assert.equal(centred.brake,0);
 for(const gap of [8,12,16]){
  assert.deepEqual(aiInput(route,state,20,0,1,[lead(gap)],options),aiInput(route,state,20,0,1,[lead(gap)],{...options,restoreFollowGap:false}));
 }
});
test('restoring headway keeps the stopped-car hold and never requests a negative speed',()=>{
 const front=lead(4);front.velocity={x:0,y:0,z:0};front.speed=front.kmh=0;
 const input=aiInput(route,state,20,0,1,[front],{...options,restoreFollowGap:true});
 assert.equal(input.targetKmh,0);assert.equal(input.throttle,0);assert.equal(input.brake,1);
 assert.equal(input.waitingForTraffic,true);
});
