import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import {initPhysics,createVehiclePhysics,STEP,stepVehicleWorld} from '../src/driving/physics.js';
import {RACE_TUNING} from '../src/rebuild/vehicleDynamics.js';
import {VEHICLES} from '../src/rebuild/fleet.js';
import {RIVAL_RACE_PROFILE,rivalPace} from '../src/rebuild/rivalSpeed.js';
import {DIFFICULTIES,DEFAULT_DIFFICULTY,PLAYER_GRID_SLOT,difficultyById,difficultyPace,gridSlot,loadDifficulty,saveDifficulty} from '../src/rebuild/raceDifficulty.js';
import {SURFACES,surfaceKind,createSurfaceMap,touchingWall} from '../src/rebuild/raceSurface.js';
import {aiInput} from '../src/rebuild/course.js';
import {createRivalPlanner} from '../src/rebuild/rivalPlanner.js';
import {loadTrack,runRace} from './race-sim.mjs';
await initPhysics();
const supra=VEHICLES.find(v=>v.id==='supra');

test('the player starts from the back of a full grid; rivals keep their order ahead',()=>{
 const slots=Array.from({length:6},(_,i)=>gridSlot(i));
 assert.equal(slots[0],PLAYER_GRID_SLOT);assert.equal(PLAYER_GRID_SLOT,5);
 assert.deepEqual([...slots].sort(),[0,1,2,3,4,5]);
 assert.deepEqual(slots.slice(1),[0,1,2,3,4]);
 // A different player slot still yields six distinct grid positions.
 assert.deepEqual(Array.from({length:6},(_,i)=>gridSlot(i,2)).sort(),[0,1,2,3,4,5]);
});

test('easy keeps the previous rival calibration; harder levels are strictly quicker',()=>{
 const easy=difficultyById('easy'),normal=difficultyById('normal'),hard=difficultyById('hard');
 assert.equal(easy.profile,RIVAL_RACE_PROFILE);assert.equal(easy.nitro,false);
 for(let i=0;i<5;i++){
  assert.equal(difficultyPace(easy,i),rivalPace(i));
  assert.ok(difficultyPace(easy,i)<difficultyPace(normal,i)&&difficultyPace(normal,i)<difficultyPace(hard,i));
 }
 assert.ok(easy.profile.maxSpeed<normal.profile.maxSpeed&&normal.profile.maxSpeed<hard.profile.maxSpeed);
 assert.ok(hard.nitro);
 assert.equal(difficultyById('nonsense').id,DEFAULT_DIFFICULTY);assert.equal(DIFFICULTIES.length,3);
});

test('difficulty preference survives reloads and blocked storage never breaks the garage',()=>{
 const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
 assert.equal(loadDifficulty(storage),DEFAULT_DIFFICULTY);
 saveDifficulty(storage,'hard');assert.equal(loadDifficulty(storage),'hard');
 saveDifficulty(storage,'bogus');assert.equal(loadDifficulty(storage),DEFAULT_DIFFICULTY);
 const blocked={getItem(){throw new Error('denied');},setItem(){throw new Error('denied');}};
 assert.equal(loadDifficulty(blocked),DEFAULT_DIFFICULTY);assert.doesNotThrow(()=>saveDifficulty(blocked,'easy'));
 assert.equal(loadDifficulty(null),DEFAULT_DIFFICULTY);
});

test('every exported racing road is asphalt and the open ground around it is slower',()=>{
 for(const id of ['coastal','namak']){
  const {parts}=loadTrack(id),kinds=new Set(parts.map(p=>surfaceKind(p.name)));
  assert.ok(parts.filter(p=>p.name.includes('Road_Asphalt')).every(p=>surfaceKind(p.name)==='asphalt'));
  assert.ok(kinds.has('asphalt')&&kinds.has('grass'),`${id}: ${[...kinds]}`);
 }
 assert.equal(surfaceKind('Harbor_Ground_Concrete'),'paved');assert.equal(surfaceKind('RaceBarrier_-1'),'solid');
 assert.ok(SURFACES.grass.grip<SURFACES.paved.grip&&SURFACES.paved.grip<SURFACES.asphalt.grip);
 assert.ok(SURFACES.grass.drag>SURFACES.paved.drag&&SURFACES.asphalt.drag===0);
});

function flatWorld(name){
 const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;world.numSolverIterations=8;
 const surfaces=createSurfaceMap(),ground=world.createCollider(RAPIER.ColliderDesc.cuboid(60,.5,900).setTranslation(0,-.5,0).setFriction(1));
 surfaces.add(ground.handle,name);
 return {world,surfaces};
}
function coast(name,{surface=true,scrape=0,kmh=100,seconds=3}={}){
 const {world,surfaces}=flatWorld(name);
 const sim=createVehiclePhysics({sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec:supra,raceTuning:RACE_TUNING.supra,surface:surface?surfaces.surface:null});
 try{
  sim.reset({x:0,y:.55,z:-500},0,{stepWorld:false});
  for(let i=0;i<120;i++){sim.step({brake:1},false);stepVehicleWorld(world);sim.finishStep();}
  sim.body.setLinvel({x:0,y:0,z:kmh/3.6},true);
  let state;for(let i=0;i<seconds/STEP;i++){sim.step({scrape},false);stepVehicleWorld(world);state=sim.finishStep();}
  return state;
 }finally{sim.dispose();world.free();}
}

test('grass and paving slow a coasting car; asphalt behaves exactly as before',()=>{
 const legacy=coast('Road_Asphalt',{surface:false}),asphalt=coast('Road_Asphalt'),paved=coast('City_Ground_Paving'),grass=coast('Terrain_Base');
 assert.equal(asphalt.position.z,legacy.position.z);assert.equal(asphalt.kmh,legacy.kmh);
 assert.ok(paved.kmh<asphalt.kmh-1,`paved ${paved.kmh} vs ${asphalt.kmh}`);
 assert.ok(grass.kmh<paved.kmh-10,`grass ${grass.kmh} vs ${paved.kmh}`);
 assert.ok(grass.surface.grip<.7&&asphalt.surface.grip===1);
 // Off-road cannot reverse the car or push it sideways.
 assert.ok(grass.velocity.z>0&&Math.abs(grass.position.x)<.2);
});

test('wall scraping costs speed, and a parked car pressed to a wall never creeps',()=>{
 const free=coast('Road_Asphalt'),scraping=coast('Road_Asphalt',{scrape:1});
 assert.ok(scraping.kmh<free.kmh-30,`${scraping.kmh} vs ${free.kmh}`);
 const parked=coast('Road_Asphalt',{scrape:1,kmh:0,seconds:2});
 assert.ok(parked.kmh<.2,`parked moved at ${parked.kmh}`);
});

test('wall contact is reported for barriers, not for the road a car is resting on',()=>{
 const {world,surfaces}=flatWorld('Road_Asphalt');
 const wall=world.createCollider(RAPIER.ColliderDesc.cuboid(.3,1,20).setTranslation(1.25,1,0));surfaces.add(wall.handle,'RaceBarrier');
 const sim=createVehiclePhysics({sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec:supra,raceTuning:RACE_TUNING.supra,surface:surfaces.surface});
 try{
  sim.reset({x:-3,y:.55,z:0},0,{stepWorld:false});
  for(let i=0;i<120;i++){sim.step({brake:1},false);stepVehicleWorld(world);sim.finishStep();}
  assert.equal(touchingWall(world,sim.colliders,surfaces.isWall),false);
  // Slide sideways into the barrier.
  let touched=false;
  for(let i=0;i<240&&!touched;i++){sim.body.setLinvel({x:3,y:sim.body.linvel().y,z:0},true);sim.step({},false);stepVehicleWorld(world);sim.finishStep();touched=touchingWall(world,sim.colliders,surfaces.isWall);}
  assert.ok(touched,'barrier contact not detected');
 }finally{sim.dispose();world.free();}
});

test('fast rivals see a hairpin early enough to brake; the previous profile is unchanged',()=>{
 const points=[];
 for(let i=0;i<120;i++)points.push({x:0,y:0,z:i*5,dx:0,dz:1,distance:i*5});
 for(let k=1;k<=40;k++){const a=k/40*Math.PI,r=12;points.push({x:r-r*Math.cos(a),y:0,z:595+r*Math.sin(a),dx:Math.sin(a),dz:Math.cos(a),distance:595+k*r*Math.PI/40});}
 const route={points,length:points.at(-1).distance+5};
 const state={position:{x:0,y:0,z:300},rotation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:64},speed:64,kmh:230,steeringLimit:.2};
 const hard=difficultyById('hard').profile;
 const before=aiInput(route,state,60,0,1,[],{speedProfile:RIVAL_RACE_PROFILE}),fast=aiInput(route,state,60,0,1,[],{speedProfile:hard});
 assert.ok(fast.brake>0&&fast.throttle===0,'230 km/h with a hairpin 300 m ahead must brake');
 // The same profile without the extended horizon would not see it yet.
 const blind=aiInput(route,state,60,0,1,[],{speedProfile:{...hard,fullBrakingHorizon:false}});
 assert.ok(Math.abs(blind.targetKmh-hard.maxSpeed)<1e-6);assert.ok(fast.targetKmh<blind.targetKmh-10);
 assert.equal(before.targetKmh,aiInput(route,state,60,0,1,[],{speedProfile:{...RIVAL_RACE_PROFILE}}).targetKmh);
});

test('only nitro-enabled rivals boost, and never while merging or held behind traffic',()=>{
 const straight={length:4000,points:Array.from({length:800},(_,i)=>({x:0,y:0,z:i*5,dx:0,dz:1,distance:i*5}))};
 const car=(z,v,player=false)=>({id:'supra',index:Math.round(z/5),lane:-2.2,pace:1,progress:z,player,finish:null,state:{position:{x:-2.2,y:.5,z},rotation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:v},speed:v,kmh:v*3.6,contacts:4,ride:{locked:true},steeringLimit:.3}});
 for(const [nitro,expected] of [[false,undefined],[true,true]]){
  const rival=car(100,20),planner=createRivalPlanner(straight,{roadClear:()=>true,speedProfile:difficultyById('hard').profile,nitro});
  assert.equal(planner.update([rival],STEP).get(rival).boost,expected);
 }
 const rival=car(100,20),blocker=car(112,0,true),planner=createRivalPlanner(straight,{roadClear:()=>false,speedProfile:difficultyById('hard').profile,nitro:true});
 assert.notEqual(planner.update([rival,blocker],STEP).get(rival).boost,true);
});

for(const trackId of ['coastal','namak']){
 test(`${trackId}: every difficulty finishes from a back-of-grid start without falls, and harder is faster`,{timeout:900000},async()=>{
  const data=loadTrack(trackId),results={};
  for(const d of DIFFICULTIES){
   const race=await runRace({trackId,difficultyId:d.id,data,playerProfile:difficultyById('hard').profile});
   const rivals=race.cars.filter(c=>!c.player);
   for(const c of race.cars){
    assert.ok(c.finish!=null,`${trackId}/${d.id}: ${c.id} stalled at ${c.metres}m ${JSON.stringify(c.plan)}`);
    assert.ok(c.lowest>-5,`${trackId}/${d.id}: ${c.id} fell ${c.lowest}m below the road`);
   }
   // Median: one contact incident must not decide the comparison.
   results[d.id]=rivals.map(c=>c.finish).sort((a,b)=>a-b)[2];
   console.log(trackId,d.id,'median rival finish',results[d.id].toFixed(2),race.cars.map(c=>`${c.player?'YOU':c.id}:${c.place}/${c.finish}s scrape ${c.scrapeSeconds}s off ${c.offroadSeconds}s nitro ${c.boostSeconds}s`).join(' | '));
  }
  assert.ok(results.hard<results.normal&&results.normal<results.easy,JSON.stringify(results));
 });
}
