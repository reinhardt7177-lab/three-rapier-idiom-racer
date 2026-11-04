import test from 'node:test';import assert from 'node:assert/strict';
import {RIVAL_PERSONALITIES,personalityByName,personalitySpeedProfile} from '../../../src/rebuild/rivalPersonalities.js';
import {createRivalPlanner} from './rivalPlanner.js';
const route={length:4000,points:Array.from({length:800},(_,i)=>({x:0,y:0,z:i*5,dx:0,dz:1,distance:i*5}))};
const profile={maxSpeed:225,lateralAcceleration:6.2,fullBrakingHorizon:true};
function car(name,speed=55){return {name,id:'supra',index:20,lane:-2.2,pace:1,progress:100,player:false,finish:null,state:{position:{x:-2.2,y:.53,z:100},rotation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:speed},speed,kmh:speed*3.6,contacts:4,ride:{locked:true},steeringLimit:.52}};}
test('five fixed personalities differ in corner, passing and nitro decisions without modifying snapshots',()=>{
 assert.equal(RIVAL_PERSONALITIES.length,5);assert.ok(personalitySpeedProfile(profile,personalityByName('NOVA')).lateralAcceleration>profile.lateralAcceleration);
 const inputs=[];
 for(const name of ['BLAZE','MIST']){const c=car(name),before=JSON.stringify(c),planner=createRivalPlanner(route,{roadClear:()=>true,speedProfile:profile,nitro:true,personalities:true});
  const input=planner.update([c],1/60).get(c);inputs.push(input);assert.equal(JSON.stringify(c),before);assert.equal(planner.snapshot(c).personality,name);}
 assert.equal(inputs[0].boost,true);assert.equal(!!inputs[1].boost,false);assert.ok(inputs[0].targetKmh>inputs[1].targetKmh);
});
test('aggressive rival accepts a smaller speed advantage; defensive rival keeps following',()=>{
 const modes=[];
 for(const name of ['RAVEN','MIST']){const c=car(name,55),lead=car('YOU',60);lead.player=true;lead.state.position.z=125;
  const planner=createRivalPlanner(route,{roadClear:()=>true,speedProfile:profile,personalities:true});planner.update([c,lead],1/60);modes.push(planner.snapshot(c).mode);}
 assert.deepEqual(modes,['changing','follow']);
});
