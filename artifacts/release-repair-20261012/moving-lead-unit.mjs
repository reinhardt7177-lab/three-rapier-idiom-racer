import test from 'node:test';
import assert from 'node:assert/strict';
import {createRivalPlanner} from './planner-moving-lead.mjs';
const route={length:4000,points:Array.from({length:800},(_,i)=>({x:0,y:0,z:i*5,dx:0,dz:1,distance:i*5}))};
const profile={maxSpeed:245,lateralAcceleration:7.3,fullBrakingHorizon:true};
const fake=(z,lane,v,player=false)=>({id:'supra',index:Math.round(z/5),lane,pace:1,progress:z,player,finish:null,state:{position:{x:lane,y:.53,z},rotation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:v},speed:v,kmh:v*3.6,contacts:4,ride:{locked:true},steeringLimit:.52}});
const advance=(planner,cars)=>{for(let i=0;i<30;i++)planner.update(cars,1/120);};
function passing(){
 const car=fake(100,-2.2,25),original=fake(130,-2.2,10,true);
 let road=true;
 const planner=createRivalPlanner(route,{roadClear:()=>road,speedProfile:profile});
 planner.update([car,original],1/120);
 assert.equal(planner.snapshot(car).mode,'changing');
 car.state.position.x=2.2;original.state.position.z=250;
 advance(planner,[car,original]);
 assert.equal(planner.snapshot(car).mode,'passing');
 return {planner,car,original,setRoad:v=>road=v};
}
test('a new moving lead can be passed before the original lead is behind',()=>{
 const {planner,car,original}=passing(),lead=fake(125,2.2,16.5,true),cars=[car,original,lead];
 const before=JSON.stringify(cars);advance(planner,cars);
 assert.equal(planner.snapshot(car).mode,'changing');
 assert.equal(planner.snapshot(car).targetLane,-2.2);
 assert.equal(planner.snapshot(car).attempts,2);
 assert.equal(JSON.stringify(cars),before);
});
test('re-planning a moving lead still respects road proof and closing rear traffic',()=>{
 for(const blocked of ['road','rear']){
  const {planner,car,original,setRoad}=passing(),lead=fake(125,2.2,16.5,true),cars=[car,original,lead];
  if(blocked==='road')setRoad(false);else cars.push(fake(80,-2.2,45,true));
  const before=JSON.stringify(cars);advance(planner,cars);
  assert.equal(planner.snapshot(car).mode,'passing');
  assert.equal(planner.snapshot(car).reason,'slow-ahead');
  assert.equal(planner.snapshot(car).targetLane,2.2);
  assert.equal(planner.snapshot(car).attempts,1);
  assert.equal(JSON.stringify(cars),before);
 }
});
test('a lead with no passing speed advantage does not start another crossing',()=>{
 const {planner,car,original}=passing(),lead=fake(125,2.2,68,true);
 advance(planner,[car,original,lead]);
 assert.equal(planner.snapshot(car).mode,'passing');
 assert.equal(planner.snapshot(car).attempts,1);
});
