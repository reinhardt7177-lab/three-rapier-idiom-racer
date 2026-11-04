import test from 'node:test';
import assert from 'node:assert/strict';
import {createRivalPlanner} from './planner-obstacle.mjs';
const route={length:4000,points:Array.from({length:800},(_,i)=>({x:0,y:0,z:i*5,dx:0,dz:1,distance:i*5}))};
const fake=(z,lane,v,player=false)=>({id:'supra',index:Math.round(z/5),lane,pace:1,progress:z,player,finish:null,state:{position:{x:lane,y:.53,z},rotation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:v},speed:v,kmh:v*3.6,contacts:4,ride:{locked:true},steeringLimit:.52}});
const advance=(p,c)=>{for(let i=0;i<30;i++)p.update(c,1/120);};
test('after a partial crossing yield, the next pass points away from the new lead',()=>{
 const car=fake(100,-2.2,25),original=fake(130,-2.2,10,true),rear=fake(90,2.2,45,true);
 const planner=createRivalPlanner(route,{roadClear:()=>true,speedProfile:{maxSpeed:245,lateralAcceleration:7.3}});
 planner.update([car,original],1/120);
 car.state.position.x=.3;car.state.position.z=115;car.index=23;
 advance(planner,[car,original,rear]);assert.equal(planner.snapshot(car).reason,'yield-rear');
 rear.state.position.z=180;const lead=fake(140,-1.5,16.5,true),cars=[car,original,rear,lead],before=JSON.stringify(cars);
 advance(planner,cars);
 assert.equal(planner.snapshot(car).mode,'changing');assert.equal(planner.snapshot(car).targetLane,2.2);
 assert.equal(JSON.stringify(cars),before);
});
