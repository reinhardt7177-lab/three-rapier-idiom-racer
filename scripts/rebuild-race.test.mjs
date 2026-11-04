import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Matrix4,Vector3,Quaternion} from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {initPhysics,createVehiclePhysics,STEP,stepVehicleWorld} from '../src/driving/physics.js';
import {nearestRoute,routePose,forwardProgress,aiInput} from '../src/rebuild/course.js';
import {RACE_TUNING,RACE_GRID_LANE} from '../src/rebuild/vehicleDynamics.js';
import {recoveredCollider} from '../src/rebuild/worldCollision.js';
import {VEHICLES,rivalFleet} from '../src/rebuild/fleet.js';
const route=JSON.parse(fs.readFileSync(new URL('../public/assets/rebuild/world-route.json',import.meta.url)));
function vehicleSpec(id){
 const b=fs.readFileSync(new URL(`../public/assets/rebuild/${id}.glb`,import.meta.url));
 const j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString()),wheels={};
 function visit(i,parent){
  const n=j.nodes[i],m=n.matrix?new Matrix4().fromArray(n.matrix):new Matrix4().compose(new Vector3(...(n.translation||[0,0,0])),new Quaternion(...(n.rotation||[0,0,0,1])),new Vector3(...(n.scale||[1,1,1])));m.premultiply(parent);
  if(/^Wheel_[FR][LR]$/.test(n.name))wheels[n.name]=new Vector3().setFromMatrixPosition(m);
  for(const c of n.children||[])visit(c,m);
 }
 for(const n of j.scenes[j.scene||0].nodes)visit(n,new Matrix4());
 assert.equal(Object.keys(wheels).length,4);
 const rig=j.nodes.find(n=>n.extras?.vehicle_rig_version===2);
 return {track:Math.abs(wheels.Wheel_RR.x-wheels.Wheel_RL.x),wheelbase:Math.abs(wheels.Wheel_FR.z-wheels.Wheel_RR.z),...(rig?{wheelRadius:rig.extras.wheel_radius}:{})};
}
test('recovered route is a continuous 6.8 km loop covering the original districts',()=>{
 assert.ok(route.length>6800&&route.length<6900);
 const regions=new Set(route.points.map(p=>p.region));
 for(const region of ['Harbor','Beach','City','Mountain','Lighthouse','Bridge'])assert.ok(regions.has(region),region);
 for(let i=1;i<route.points.length;i++)assert.ok(route.points[i].distance>=route.points[i-1].distance);
 const a=route.points[0],b=route.points.at(-1);assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<4);
});
test('finish crossing advances progress; recovery jumps cannot award a lap',()=>{
 assert.equal(forwardProgress(route.length-2,3,route.length),5);
 assert.equal(forwardProgress(100,1000,route.length),0);
 assert.equal(forwardProgress(3,route.length-2,route.length),-5);
 const p=routePose(route,25,3);assert.ok(nearestRoute(route,p.position,25).distance<3.1);
});
test('six shared-world vehicles remain grounded and drive along recovered geometry',async()=>{
 await initPhysics();
 const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;
 const binary=fs.readFileSync(new URL('../artifacts/unity-recovery/colliders.bin',import.meta.url));
 const manifest=JSON.parse(fs.readFileSync(new URL('../artifacts/unity-recovery/colliders.json',import.meta.url)));
 assert.equal(manifest.length,160);
 for(const part of manifest){
  const v=new Float32Array(part.vertices),indices=new Uint32Array(part.indices);
  for(let i=0;i<v.length;i++)v[i]=binary.readFloatLE(part.offset+i*4);
  for(let i=0;i<indices.length;i++)indices[i]=binary.readUInt32LE(part.offset+v.byteLength+i*4);
  world.createCollider(recoveredCollider(v,indices));
 }
 const cars=[];
 try{
  for(let i=0;i<6;i++){
   const index=25-Math.floor(i/2)*4,lane=i%2===0?-RACE_GRID_LANE:RACE_GRID_LANE,pose=routePose(route,index,lane);
   const id=i===0?'supra':rivalFleet('supra')[i-1];
   const sim=createVehiclePhysics({sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,start:pose.position,spec:vehicleSpec(id),raceTuning:RACE_TUNING[id]});
   sim.reset(pose.position,pose.yaw,{stepWorld:false});cars.push({sim,index,lane,pace:i===0?1:.93+i*.02,progress:0,distance:route.points[index].distance,state:sim.snapshot()});
  }
  for(let i=0;i<120;i++){cars.forEach(c=>c.sim.step({brake:1},false));stepVehicleWorld(world);cars.forEach(c=>c.state=c.sim.finishStep());}
  for(const car of cars)assert.equal(car.state.contacts,4);
  for(let i=0;i<120*450&&cars.some(c=>c.progress<route.length);i++){
   const traffic=cars.map(c=>c.state);
   cars.forEach(c=>c.sim.step(c.progress>=route.length?{brake:1}:aiInput(route,c.state,c.index,c.lane,c.pace,traffic.filter(s=>s!==c.state)),false));
   stepVehicleWorld(world);
   cars.forEach(c=>{
    c.state=c.sim.finishStep();const near=nearestRoute(route,c.state.position,c.index);c.index=near.index;
    c.progress+=forwardProgress(c.distance,near.point.distance,route.length);c.distance=near.point.distance;
    assert.ok(Number.isFinite(c.state.position.y));assert.ok(c.state.position.y>near.point.y-5,'fell through the original road');
   });
  }
  console.log('Recovered-map traffic:',cars.map(c=>({metres:Math.round(c.progress),kmh:Math.round(c.state.kmh),contacts:c.state.contacts,index:c.index,position:c.state.position,rotation:c.state.rotation,region:route.points[c.index].region})));
  for(const c of cars){assert.ok(c.progress>=route.length,`AI stalled at ${c.progress}m near index ${c.index}`);}
 }finally{cars.forEach(c=>c.sim.dispose());world.free();}
});

test('M3 and Huracán complete the recovered full course with physical road support',async()=>{
 await initPhysics();
 const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;
 const binary=fs.readFileSync(new URL('../artifacts/unity-recovery/colliders.bin',import.meta.url));
 const manifest=JSON.parse(fs.readFileSync(new URL('../artifacts/unity-recovery/colliders.json',import.meta.url)));
 for(const part of manifest){
  const v=new Float32Array(part.vertices),indices=new Uint32Array(part.indices);
  for(let i=0;i<v.length;i++)v[i]=binary.readFloatLE(part.offset+i*4);
  for(let i=0;i<indices.length;i++)indices[i]=binary.readUInt32LE(part.offset+v.byteLength+i*4);
  world.createCollider(recoveredCollider(v,indices));
 }
 const cars=[];
 try{
  for(const [i,id] of ['m3','huracan'].entries()){
   const index=25-i*10,lane=i===0?-RACE_GRID_LANE:RACE_GRID_LANE,pose=routePose(route,index,lane);
   const sim=createVehiclePhysics({sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,start:pose.position,spec:vehicleSpec(id),raceTuning:RACE_TUNING[id]});
   sim.reset(pose.position,pose.yaw,{stepWorld:false});cars.push({id,sim,index,lane,progress:0,distance:route.points[index].distance,state:sim.snapshot()});
  }
  for(let i=0;i<120;i++){cars.forEach(c=>c.sim.step({brake:1},false));stepVehicleWorld(world);cars.forEach(c=>c.state=c.sim.finishStep());}
  for(let i=0;i<120*450&&cars.some(c=>c.progress<route.length);i++){
   cars.forEach(c=>c.sim.step(c.progress>=route.length?{brake:1}:aiInput(route,c.state,c.index,c.lane,1,cars.filter(o=>o!==c).map(o=>o.state)),false));stepVehicleWorld(world);
   cars.forEach(c=>{c.state=c.sim.finishStep();const near=nearestRoute(route,c.state.position,c.index);c.index=near.index;c.progress+=forwardProgress(c.distance,near.point.distance,route.length);c.distance=near.point.distance;assert.ok(c.state.position.y>near.point.y-5);});
  }
  for(const c of cars)assert.ok(c.progress>=route.length,`${c.id} stalled at ${c.progress}m`);
  console.log('Additional full-course cars',cars.map(c=>({id:c.id,progress:c.progress,contacts:c.state.contacts})));
 }finally{cars.forEach(c=>c.sim.dispose());world.free();}
});
