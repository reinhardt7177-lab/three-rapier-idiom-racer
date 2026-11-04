import test from 'node:test';
import assert from 'node:assert/strict';
import {createRivalPlanner} from '../src/rebuild/rivalPlanner.js';
import {aiInput} from '../src/rebuild/course.js';
const route={length:4000,points:Array.from({length:800},(_,i)=>({x:0,y:0,z:i*5,dx:0,dz:1,distance:i*5}))};
const profile={maxSpeed:245,lateralAcceleration:7.3,fullBrakingHorizon:true};
const fake=(z,lane,v,player=false)=>({id:'supra',index:Math.round(z/5),lane,pace:1,progress:z,player,finish:null,state:{position:{x:lane,y:.53,z},rotation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:v},speed:v,kmh:v*3.6,contacts:4,ride:{locked:true},steeringLimit:.52}});
const advance=(planner,cars,traffic=[])=>{for(let i=0;i<30;i++)planner.update(cars,1/120,traffic);};
function passing(){
 const car=fake(100,-2.2,25),original=fake(130,-2.2,10,true);let road=true;
 const planner=createRivalPlanner(route,{roadClear:()=>road,speedProfile:profile});
 planner.update([car,original],1/120);assert.equal(planner.snapshot(car).mode,'changing');
 car.state.position.x=2.2;original.state.position.z=250;advance(planner,[car,original]);
 assert.equal(planner.snapshot(car).mode,'passing');
 return {planner,car,original,setRoad:v=>road=v};
}
test('a new moving lead can be passed before the original lead is behind',()=>{
 const {planner,car,original}=passing(),lead=fake(125,2.2,16.5,true),cars=[car,original];
 const before=JSON.stringify(cars);advance(planner,cars,[lead]);
 assert.equal(planner.snapshot(car).mode,'changing');assert.equal(planner.snapshot(car).targetLane,-2.2);
 assert.equal(planner.snapshot(car).attempts,2);assert.equal(JSON.stringify(cars),before);
});
test('re-planning a moving lead still respects road proof and closing rear traffic',()=>{
 for(const blocked of ['road','rear']){
  const {planner,car,original,setRoad}=passing(),lead=fake(125,2.2,16.5,true),cars=[car,original];
  if(blocked==='road')setRoad(false);else cars.push(fake(80,-2.2,45,true));
  const before=JSON.stringify(cars);advance(planner,cars,[lead]);
  assert.equal(planner.snapshot(car).mode,'passing');assert.equal(planner.snapshot(car).reason,'slow-ahead');
  assert.equal(planner.snapshot(car).targetLane,2.2);assert.equal(planner.snapshot(car).attempts,1);
  assert.equal(JSON.stringify(cars),before);
 }
});
test('a lead with no passing speed advantage does not start another crossing',()=>{
 const {planner,car,original}=passing(),lead=fake(125,2.2,68,true);advance(planner,[car,original],[lead]);
 assert.equal(planner.snapshot(car).mode,'passing');assert.equal(planner.snapshot(car).attempts,1);
});
test('after a partial crossing yield, the next pass points away from the new lead on either side',()=>{
 for(const side of [1,-1]){
  const car=fake(100,-2.2*side,25),original=fake(130,-2.2*side,10,true),rear=fake(90,2.2*side,45,true);
  const planner=createRivalPlanner(route,{roadClear:()=>true,speedProfile:profile});planner.update([car,original],1/120);
  car.state.position.x=.3*side;car.state.position.z=115;car.index=23;
  advance(planner,[car,original,rear]);assert.equal(planner.snapshot(car).reason,'yield-rear');
  rear.state.position.z=180;const lead=fake(140,-1.5*side,16.5,true),cars=[car,original,rear],before=JSON.stringify(cars);
  advance(planner,cars,[lead]);assert.equal(planner.snapshot(car).mode,'changing');assert.equal(planner.snapshot(car).targetLane,2.2*side);
  assert.equal(JSON.stringify(cars),before);
 }
});
test('a race without civilians keeps the validated original passing sequence',()=>{
 const {planner,car,original}=passing(),lead=fake(125,2.2,16.5,true);
 advance(planner,[car,original,lead]);
 assert.equal(planner.snapshot(car).mode,'passing');assert.equal(planner.snapshot(car).attempts,1);
 assert.equal(planner.snapshot(car).targetLane,2.2);
});
const state=fake(100,0,10).state,lead=gap=>({...state,position:{...state.position,z:100+gap}}),options={trafficGap:12,speedProfile:profile};
test('restoring short moving headway briefly slows below the lead without stopping',()=>{
 const front=lead(8),before=JSON.stringify([state,front]);
 const input=aiInput(route,state,20,0,1,[front],{...options,restoreFollowGap:true});
 assert.ok(input.targetKmh>0&&input.targetKmh<front.kmh);assert.equal(input.throttle,0);
 assert.ok(input.brake>0&&input.brake<1);assert.equal(input.waitingForTraffic,false);assert.equal(JSON.stringify([state,front]),before);
});
test('the existing gap remains the target and ordinary non-traffic-race behavior is preserved',()=>{
 const centred=aiInput(route,state,20,0,1,[lead(12)],{...options,restoreFollowGap:true});
 assert.equal(centred.targetKmh,36);assert.equal(centred.brake,0);
 for(const gap of [8,12,16])assert.deepEqual(aiInput(route,state,20,0,1,[lead(gap)],options),aiInput(route,state,20,0,1,[lead(gap)],{...options,restoreFollowGap:false}));
});
test('restoring headway keeps stopped-car hold and never requests a negative speed',()=>{
 const front=lead(4);front.velocity={x:0,y:0,z:0};front.speed=front.kmh=0;
 const input=aiInput(route,state,20,0,1,[front],{...options,restoreFollowGap:true});
 assert.equal(input.targetKmh,0);assert.equal(input.throttle,0);assert.equal(input.brake,1);assert.equal(input.waitingForTraffic,true);
});
