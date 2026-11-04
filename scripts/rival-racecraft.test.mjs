import test from 'node:test';
import assert from 'node:assert/strict';
import {aiInput} from '../src/rebuild/course.js';
import {createRivalPlanner} from '../src/rebuild/rivalPlanner.js';
import {difficultyById} from '../src/rebuild/raceDifficulty.js';
import {personalityByName,personalitySpeedProfile} from '../src/rebuild/rivalPersonalities.js';

const route={length:4000,points:Array.from({length:800},(_,i)=>({x:0,y:0,z:i*5,dx:0,dz:1,distance:i*5}))};
const profile={maxSpeed:245,lateralAcceleration:7.3,fullBrakingHorizon:true};
function car(name='RAVEN',z=100,lane=-2.2,v=30){return {id:'supra',name,index:Math.round(z/5),lane,pace:1,progress:z,finish:null,player:false,state:{position:{x:lane,y:.53,z},rotation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:v},speed:v,kmh:v*3.6,steeringLimit:.4,contacts:4,ride:{locked:true},surface:{grip:1},action:{charge:70}}};}

test('wet braking sees a corner earlier and lowers approach speed without changing car snapshots',()=>{
 const points=route.points.map(p=>({...p}));
 for(let i=110;i<130;i++){const a=(i-110)/20*Math.PI;points[i].dx=Math.sin(a);points[i].dz=Math.cos(a);}
 const bend={...route,points},dry=car('NOVA',300,-2.2,64).state,wet={...dry,surface:{grip:.86}};
 const before=JSON.stringify([dry,wet]);
 const options={speedProfile:profile,adaptiveBraking:true};
 const a=aiInput(bend,dry,60,-2.2,1,[],options),b=aiInput(bend,wet,60,-2.2,1,[],options);
 assert.ok(b.targetKmh<a.targetKmh-5);assert.ok(b.brake>0);assert.equal(b.throttle,0);
 assert.equal(JSON.stringify([dry,wet]),before);
});

test('oncoming speed and lateral cut-ins are predicted before the old forward guard',()=>{
 const own=car().state,options={speedProfile:profile,predictiveTraffic:true,adaptiveBraking:true,trafficGap:12};
 const incoming=car('YOU',260,-2.2,-30).state;
 assert.ok(aiInput(route,own,20,-2.2,1,[incoming],options).targetKmh<aiInput(route,own,20,-2.2,1,[incoming],{...options,predictiveTraffic:false}).targetKmh);
 const cut=car('YOU',125,2.2,10).state;cut.velocity.x=-4;
 const predicted=aiInput(route,own,20,-2.2,1,[cut],options);
 assert.ok(predicted.brake>0);assert.equal(predicted.throttle,0);
 cut.velocity.x=4;
 assert.equal(aiInput(route,own,20,-2.2,1,[cut],options).brake,0);
});

const advance=(p,cars,seconds)=>{let input;for(let i=0;i<Math.ceil(seconds*120);i++)input=p.update(cars,1/120);return input;};
const planner=(options={})=>createRivalPlanner(route,{roadClear:()=>true,speedProfile:profile,nitro:true,personalities:true,racecraft:difficultyById('normal').racecraft,...options});

test('a low-charge rival builds a draft briefly, then commits instead of following forever',()=>{
 const c=car('RAVEN',100,-2.2,50),lead=car('YOU',125,-2.2,48);lead.player=true;c.state.action.charge=5;
 const p=planner(),before=JSON.stringify([c,lead]);p.update([c,lead],1/120);
 assert.equal(p.snapshot(c).reason,'drafting');assert.equal(p.snapshot(c).tactic,'build-draft');
 advance(p,[c,lead],1);assert.equal(p.snapshot(c).mode,'changing');assert.equal(p.snapshot(c).draftSetups,1);
 assert.equal(JSON.stringify([c,lead]),before);
 const charging=car('RAVEN',100,-2.2,50);charging.state.action.charge=20;
 assert.notEqual(planner().update([charging,lead],1/120).get(charging).boost,true);
});

test('a stopped or rapidly closing lead never triggers draft waiting',()=>{
 for(const velocity of [0,10,30]){
  const c=car('RAVEN',100,-2.2,50),lead=car('YOU',125,-2.2,velocity);lead.player=true;c.state.action.charge=5;
  const p=planner();p.update([c,lead],1/120);assert.notEqual(p.snapshot(c).reason,'drafting');
 }
});

test('boost has bounded bursts, cooldown and a charge reserve; pausing freezes each timer',()=>{
 const c=car(),p=planner();assert.equal(p.update([c],1/120).get(c).boost,true);
 advance(p,[c],1.4);assert.notEqual(p.update([c],1/120).get(c).boost,true);
 const paused=p.snapshot(c);advance(p,[c],0);p.update([c],0);assert.deepEqual(p.snapshot(c),paused);
 advance(p,[c],1.6);assert.equal(p.update([c],1/120).get(c).boost,true);
 const empty=car();empty.state.action.charge=2;assert.notEqual(planner().update([empty],1/120).get(empty).boost,true);
});

test('boost yields to airborne, off-road, wall, merging, braking and a steering correction',()=>{
 const unsafe=[c=>{c.state.contacts=0;},c=>{c.state.surface.grip=.6;},c=>{c.scrape=true;},c=>{c.state.rotation={x:0,y:Math.sin(.4),z:0,w:Math.cos(.4)};}];
 for(const change of unsafe){const c=car();change(c);assert.notEqual(planner().update([c],1/120).get(c).boost,true);}
 const c=car('RAVEN',100,-2.2,10),lead=car('YOU',125,-2.2,5);lead.player=true;
 const p=planner();assert.notEqual(p.update([c,lead],1/120).get(c).boost,true);assert.equal(p.snapshot(c).mode,'changing');
});

test('final attack uses total race distance and skips draft patience without inventing speed or charge',()=>{
 const c=car('RAVEN',100,-2.2,50),lead=car('YOU',125,-2.2,48);lead.player=true;c.state.action.charge=5;c.progress=3700;
 const early=planner({raceDistance:12000});early.update([c,lead],1/120);assert.equal(early.snapshot(c).reason,'drafting');
 const final=planner({raceDistance:4000}),before=JSON.stringify(c);final.update([c,lead],1/120);
 assert.equal(final.snapshot(c).mode,'changing');assert.equal(final.snapshot(c).tactic,'finish-attack');assert.equal(JSON.stringify(c),before);
});

test('difficulty and personality change patience and resource timing with fixed speed ceilings',()=>{
 const normal=difficultyById('normal'),hard=difficultyById('hard');
 assert.ok(hard.racecraft.boostBurst>normal.racecraft.boostBurst);assert.ok(hard.racecraft.boostCooldown<normal.racecraft.boostCooldown);
 assert.ok(personalityByName('MIST').draftPatience>personalityByName('RAVEN').draftPatience);
 const c=car(),p=planner();p.update([c],1/120);p.reset(c);assert.equal(p.snapshot(c).boosts,0);assert.equal(p.snapshot(c).draftSetups,0);
 p.reset();assert.equal(p.snapshot(c),null);
});

test('a moving second lead cannot trigger immediate lane weaving; a stopped blocker remains urgent',()=>{
 for(const moving of [true,false]){
  const c=car('RAVEN',100,-2.2,10),first=car('YOU',125,-2.2,0);first.player=true;
  const p=planner();p.update([c,first],1/120);assert.equal(p.snapshot(c).attempts,1);
  c.state.position.x=2.2;advance(p,[c,first],.25);assert.equal(p.snapshot(c).mode,'passing');
  first.state.position.z=80;
  const second=car('LUNA',140,2.2,moving?5:0);second.player=true;
  advance(p,[c,first,second],.25);
  assert.equal(p.snapshot(c).attempts,moving?1:2);
  if(moving){advance(p,[c,first,second],2.5);assert.equal(p.snapshot(c).attempts,2);}
 }
});

test('a lead on the lane edge never creates fake repeat passes toward the current lane',()=>{
 const c=car('RAVEN',100,-2.2,10),first=car('YOU',125,-2.2,0);first.player=true;
 const p=planner();p.update([c,first],1/120);c.state.position.x=2.2;advance(p,[c,first],.25);
 first.state.position.z=80;const edge=car('YOU',140,-.05,5);edge.player=true;
 advance(p,[c,first,edge],3);assert.equal(p.snapshot(c).attempts,1);
});

test('easy can retain the proven brake envelope while advanced profiles predict cut-ins',()=>{
 const c=car(),cut=car('YOU',125,2.2,10);cut.player=true;cut.state.velocity.x=-4;
 const easy=planner({racecraft:false}),advanced=planner();
 const old=aiInput(route,c.state,c.index,c.lane,1,[cut.state],{speedProfile:personalitySpeedProfile(profile,personalityByName(c.name)),trafficGap:12});
 const legacy=easy.update([c,cut],1/120).get(c),newInput=advanced.update([c,cut],1/120).get(c);
 assert.equal(legacy.targetKmh,old.targetKmh);assert.equal(legacy.brake,old.brake);
 assert.ok(newInput.targetKmh<legacy.targetKmh);assert.ok(newInput.brake>0);
 const classic=planner({racecraft:null}).update([c,cut],1/120).get(c);
 assert.equal(classic.targetKmh,legacy.targetKmh);assert.equal(classic.brake,legacy.brake);
});
