import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import RAPIER from '@dimforge/rapier3d-compat';
import {TRACKS,trackFromSearch,trackLink} from '../src/rebuild/tracks.js';
import {nearestRoute,routePose,forwardProgress,aiInput} from '../src/rebuild/course.js';
import {initPhysics,createVehiclePhysics,STEP,stepVehicleWorld} from '../src/driving/physics.js';
import {recoveredCollider} from '../src/rebuild/worldCollision.js';
import {RACE_TUNING,RACE_GRID_LANE} from '../src/rebuild/vehicleDynamics.js';
import {VEHICLES,rivalFleet} from '../src/rebuild/fleet.js';
import {RIVAL_RACE_PROFILE,rivalPace} from '../src/rebuild/rivalSpeed.js';
import {createRivalPlanner} from '../src/rebuild/rivalPlanner.js';
import {createOvertakeRoadCheck} from '../src/rebuild/overtakeRoad.js';
import {createSceneDisposer} from '../src/rendering/sceneResources.js';
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url));
const route=JSON.parse(read('public/assets/rebuild/namak-route.json'));
const report=JSON.parse(read('artifacts/namak-20261010/map-report.json'));

test('track selection pairs each world with its own route and rejects unknown locations',()=>{
 assert.equal(trackFromSearch('?track=namak'),TRACKS[1]);assert.equal(trackFromSearch('?track=other'),TRACKS[0]);
 assert.equal(trackFromSearch(''),TRACKS[0]);assert.equal(trackFromSearch(trackLink(TRACKS[1],'?v=5')),TRACKS[1]);
 for(const t of TRACKS){assert.ok(read(`public/assets/rebuild/${t.world}.glb`).length);assert.ok(read(`public/assets/rebuild/${t.route}`).length);}
});
test('Namak is a continuous 2.93km race circuit with usable city sectors and no occupied road frontage',()=>{
 assert.ok(route.length>2900&&route.length<2950);assert.equal(route.width,22);
 assert.ok(report.buildingFootprints.length>=40);for(const b of report.buildingFootprints)assert.ok(b.clearance>=25,b.name);
 const regions=new Set(route.points.map(p=>p.region));for(const r of ['도청대로','남악상가거리','영산강 수변','중앙공원 순환'])assert.ok(regions.has(r));
 for(let i=0;i<route.points.length;i++){
  const p=route.points[i],next=route.points[(i+1)%route.points.length];
  assert.ok(Math.abs(Math.hypot(p.dx,p.dz)-1)<1e-6);assert.ok(Math.hypot(p.x-next.x,p.z-next.z)<2.02);
  assert.ok(p.y===.025);if(i)assert.ok(p.distance>route.points[i-1].distance);
 }
});
test('actual Blender road faces up, every route sample has paved support, and both assets remain editable',async()=>{
 const b=read('public/assets/rebuild/namak.glb');assert.ok(b.length<20_000_000);
 const {scene}=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');scene.updateMatrixWorld(true);
 const roads=[],scenery=[];scene.traverse(o=>{if(!o.isMesh)return;if(o.name.includes('Road_Asphalt'))roads.push(o);else scenery.push(o);});assert.ok(roads.length>10);
 const ray=new THREE.Raycaster();
 for(let i=0;i<route.points.length;i+=7)for(const lane of [-7,-2.2,2.2,7]){
  const p=routePose(route,i,lane).position;ray.set(new THREE.Vector3(p.x,5,p.z),new THREE.Vector3(0,-1,0));
  const hit=ray.intersectObjects(roads,false)[0];assert.ok(hit,`road gap or inverted face at ${i}, lane ${lane}`);assert.ok(Math.abs(hit.point.y-.025)<1e-5);
  ray.near=0;ray.far=2;ray.set(new THREE.Vector3(p.x,.06,p.z),new THREE.Vector3(0,1,0));
  assert.equal(ray.intersectObjects(scenery,false).length,0,`scenery occupies car clearance at ${i}, lane ${lane}`);ray.far=Infinity;
 }
 assert.ok(read('assets-sources/namak/namak.blend').length>100000);assert.ok(read('assets-sources/rebuilt-unity/world.blend').length>100000);
 createSceneDisposer(scene)();
});
test('six real physical vehicles complete the new circuit on its exported road and barriers',async()=>{
 await initPhysics();const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;world.numSolverIterations=8;
 const bin=read('artifacts/namak-20261010/colliders.bin'),manifest=JSON.parse(read('artifacts/namak-20261010/colliders.json'));
 assert.equal(manifest.length,report.colliders);
 for(const part of manifest){
  const v=new Float32Array(part.vertices),indices=new Uint32Array(part.indices);
  for(let i=0;i<v.length;i++)v[i]=bin.readFloatLE(part.offset+i*4);
  for(let i=0;i<indices.length;i++)indices[i]=bin.readUInt32LE(part.offset+v.byteLength+i*4);
  world.createCollider(recoveredCollider(v,indices));
 }
 const cars=[];let steps=0;
 try{
  for(let i=0;i<6;i++){
   const id=i===0?'supra':rivalFleet('supra')[i-1],spec=VEHICLES.find(v=>v.id===id),index=25-Math.floor(i/2)*4,lane=i%2?-RACE_GRID_LANE:RACE_GRID_LANE;
   const pose=routePose(route,index,lane),sim=createVehiclePhysics({sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,start:pose.position,spec,raceTuning:RACE_TUNING[id]});
   sim.reset(pose.position,pose.yaw,{stepWorld:false});cars.push({id,sim,index,lane,pace:rivalPace(i%5),progress:0,distance:route.points[index].distance,state:sim.snapshot(),maxDeviation:0,minY:Infinity});
  }
  for(let i=0;i<120;i++){cars.forEach(c=>c.sim.step({brake:1},false));stepVehicleWorld(world);cars.forEach(c=>c.state=c.sim.finishStep());}
  for(const c of cars)assert.equal(c.state.contacts,4,`${c.id} grid grounding`);
  while(steps<120*240&&cars.some(c=>c.progress<route.length)){
   const traffic=cars.map(c=>c.state);
   cars.forEach(c=>c.sim.step(c.progress>=route.length?{brake:1}:aiInput(route,c.state,c.index,c.lane,c.pace,traffic.filter(s=>s!==c.state),{speedProfile:RIVAL_RACE_PROFILE}),false));
   stepVehicleWorld(world);steps++;
   for(const c of cars){
    c.state=c.sim.finishStep();const near=nearestRoute(route,c.state.position,c.index);c.index=near.index;
    if(c.progress<route.length)c.progress+=forwardProgress(c.distance,near.point.distance,route.length);
    c.distance=near.point.distance;c.maxDeviation=Math.max(c.maxDeviation,near.distance);c.minY=Math.min(c.minY,c.state.position.y);
    assert.ok(c.state.position.y>-.3,`${c.id} fell through road`);
   }
  }
  const result=cars.map(c=>({id:c.id,progress:c.progress,maxDeviation:c.maxDeviation,minY:c.minY,contacts:c.state.contacts}));
  fs.writeFileSync(new URL('../artifacts/namak-20261010/physical-laps.json',import.meta.url),JSON.stringify({seconds:steps/120,cars:result},null,2));console.log('Namak physical laps',result);
  for(const c of cars){assert.ok(c.progress>=route.length,`${c.id} stalled at ${c.progress.toFixed(1)}m`);assert.ok(c.maxDeviation<11,`${c.id} left usable road`);}
 }finally{cars.forEach(c=>c.sim.dispose());world.free();}
});

test('five planned rivals finish Namak while the player stays stopped on the starting grid',async()=>{
 await initPhysics();const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;world.numSolverIterations=8;
 const asphalt=new Set();const bin=read('artifacts/namak-20261010/colliders.bin'),manifest=JSON.parse(read('artifacts/namak-20261010/colliders.json'));
 assert.equal(manifest.length,report.colliders);
 for(const part of manifest){
  const v=new Float32Array(part.vertices),indices=new Uint32Array(part.indices);
  for(let i=0;i<v.length;i++)v[i]=bin.readFloatLE(part.offset+i*4);
  for(let i=0;i<indices.length;i++)indices[i]=bin.readUInt32LE(part.offset+v.byteLength+i*4);
  const collider=world.createCollider(recoveredCollider(v,indices));if(part.name.includes('Road_Asphalt'))asphalt.add(collider.handle);
 }
 const cars=[];let steps=0;const planner=createRivalPlanner(route,{roadClear:createOvertakeRoadCheck(world,route,asphalt),speedProfile:RIVAL_RACE_PROFILE});
 try{
  for(let i=0;i<6;i++){
   const id=i===0?'supra':rivalFleet('supra')[i-1],spec=VEHICLES.find(v=>v.id===id),index=25-Math.floor(i/2)*TRACKS[1].gridRowStep,lane=i%2?RACE_GRID_LANE:-RACE_GRID_LANE;
   const pose=routePose(route,index,lane),sim=createVehiclePhysics({sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,start:pose.position,spec,raceTuning:RACE_TUNING[id]});
   sim.reset(pose.position,pose.yaw,{stepWorld:false});cars.push({id,sim,index,lane,player:i===0,finish:null,pace:rivalPace(i-1),progress:route.points[index].distance-route.points[25].distance,distance:route.points[index].distance,state:sim.snapshot(),maxDeviation:0,minY:Infinity});
  }
  for(let i=0;i<120;i++){cars.forEach(c=>c.sim.step({brake:1},false));stepVehicleWorld(world);cars.forEach(c=>c.state=c.sim.finishStep());}
  for(const c of cars)assert.equal(c.state.contacts,4,`${c.id} grid grounding`);
  while(steps<120*240&&cars.slice(1).some(c=>c.finish===null)){
   const inputs=planner.update(cars,STEP);
   cars.forEach(c=>c.sim.step(c.player?{brake:1}:c.finish!==null?(c.finishRunout<50?aiInput(route,c.state,c.index,c.finishLane,c.pace,cars.filter(o=>o!==c).map(o=>o.state),{speedProfile:RIVAL_RACE_PROFILE,speedLimit:55}):{brake:1}):inputs.get(c),false));
   stepVehicleWorld(world);steps++;
   for(const c of cars){
    c.state=c.sim.finishStep();const near=nearestRoute(route,c.state.position,c.index);c.index=near.index;
    if(!c.player&&c.finish===null){c.progress+=forwardProgress(c.distance,near.point.distance,route.length);if(c.progress>=route.length){c.finish=steps*STEP;c.finishRunout=0;c.finishLane=(c.state.position.x-near.point.x)*near.point.dz-(c.state.position.z-near.point.z)*near.point.dx;planner.reset(c,c.finishLane);}}
    if(c.finish!==null)c.finishRunout+=Math.max(0,forwardProgress(c.distance,near.point.distance,route.length));
    c.distance=near.point.distance;c.maxDeviation=Math.max(c.maxDeviation,near.distance);c.minY=Math.min(c.minY,c.state.position.y);
    assert.ok(c.state.position.y>-.3,`${c.id} fell through road`);
   }
  }
  const result=cars.map(c=>({id:c.id,progress:c.progress,maxDeviation:c.maxDeviation,minY:c.minY,contacts:c.state.contacts,position:c.state.position,finish:c.finish,plan:planner.snapshot(c)}));
  fs.writeFileSync(new URL('../artifacts/namak-20261010/stationary-grid-rivals.json',import.meta.url),JSON.stringify({seconds:steps/120,cars:result},null,2));console.log('Namak stationary-grid rivals',result);
  const spawn=routePose(route,25,-RACE_GRID_LANE).position;assert.ok(Math.hypot(cars[0].state.position.x-spawn.x,cars[0].state.position.z-spawn.z)<.05,'AI pushed the parked player');
  for(const c of cars.slice(1)){assert.ok(c.progress>=route.length,`${c.id} stalled at ${c.progress.toFixed(1)}m`);assert.ok(c.maxDeviation<11,`${c.id} left usable road`);}
 }finally{cars.forEach(c=>c.sim.dispose());world.free();}
});
