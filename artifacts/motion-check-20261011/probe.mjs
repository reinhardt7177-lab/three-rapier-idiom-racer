// Read-only probe: how does the player's chassis actually move? (pitch/roll/yaw, lock pops, jitter)
import RAPIER from '@dimforge/rapier3d-compat';
import {initPhysics,createVehiclePhysics,STEP,stepVehicleWorld} from '../../src/driving/physics.js';
import {PLAYER_STEERING_SENSITIVITY} from '../../src/driving/steering.js';
import {playerRaceTuning} from '../../src/rebuild/vehicleDynamics.js';
import {VEHICLES} from '../../src/rebuild/fleet.js';
import {nearestRoute,aiInput,routePose} from '../../src/rebuild/course.js';
import {loadTrack,buildWorld} from '../../scripts/race-sim.mjs';
await initPhysics();
const deg=r=>r*180/Math.PI;
const att=q=>{const f={x:2*(q.x*q.z+q.w*q.y),y:2*(q.y*q.z-q.w*q.x),z:1-2*(q.x*q.x+q.y*q.y)},r={x:1-2*(q.y*q.y+q.z*q.z),y:2*(q.x*q.y+q.w*q.z),z:2*(q.x*q.z-q.w*q.y)};return {pitch:deg(Math.asin(f.y)),roll:deg(Math.asin(r.y)),yaw:Math.atan2(f.x,f.z)};};
const id=process.argv[2]||'supra',spec=VEHICLES.find(v=>v.id===id);
function flat(){const w=new RAPIER.World({x:0,y:-9.81,z:0});w.timestep=STEP;w.numSolverIterations=8;w.createCollider(RAPIER.ColliderDesc.cuboid(400,.5,1500).setTranslation(0,-.5,0).setFriction(1));return w;}
function car(world,start={x:0,y:.6,z:-1200},yaw=0){const sim=createVehiclePhysics({sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,start,spec,raceTuning:playerRaceTuning(id),steeringSensitivity:PLAYER_STEERING_SENSITIVITY});sim.reset(start,yaw,{stepWorld:false});for(let i=0;i<120;i++){sim.step({brake:1},false);stepVehicleWorld(world);sim.finishStep();}return sim;}
function run(name,inputAt,seconds,setup){
 const world=flat(),sim=car(world);setup?.(sim);
 let prev=null,maxPitch=-1e9,minPitch=1e9,maxRoll=0,maxYawRate=0,maxStepRot=0,maxLat=0,locked=0,out=[];
 for(let i=0;i<seconds/STEP;i++){const t=i*STEP;sim.step(inputAt(t,prev),false);stepVehicleWorld(world);const s=sim.finishStep();const a=att(s.rotation);
  maxPitch=Math.max(maxPitch,a.pitch);minPitch=Math.min(minPitch,a.pitch);maxRoll=Math.max(maxRoll,Math.abs(a.roll));maxYawRate=Math.max(maxYawRate,Math.abs(s.angularVelocity.y));
  if(prev){const pa=att(prev.rotation);maxStepRot=Math.max(maxStepRot,Math.abs(a.pitch-pa.pitch),Math.abs(a.roll-pa.roll));
   const v=s.velocity,f={x:Math.sin(a.yaw),z:Math.cos(a.yaw)},lat=((v.x-prev.velocity.x)*f.z-(v.z-prev.velocity.z)*f.x)/STEP;maxLat=Math.max(maxLat,Math.abs(lat));}
  if(s.ride?.locked)locked++;if(i%60===0)out.push(`${t.toFixed(1)}s ${Math.round(s.kmh)}kmh p${a.pitch.toFixed(2)} r${a.roll.toFixed(2)} yr${deg(s.angularVelocity.y).toFixed(1)} steer${(s.steer).toFixed(3)}`);prev=s;}
 sim.dispose();world.free();
 console.log(`\n## ${name}\n pitch ${minPitch.toFixed(2)}..${maxPitch.toFixed(2)}deg  |roll|max ${maxRoll.toFixed(2)}deg  yawRate max ${deg(maxYawRate).toFixed(1)}deg/s  latAcc max ${maxLat.toFixed(1)}m/s2  maxStepTilt ${maxStepRot.toFixed(3)}deg  locked ${(100*locked*STEP/seconds).toFixed(0)}%`);
 console.log(' '+out.join('\n '));
}
const speedUp=kmh=>sim=>sim.body.setLinvel({x:0,y:0,z:kmh/3.6},true);
run('full throttle 0-6s',()=>({throttle:1}),6);
run('hard brake from 120',()=>({brake:1}),4,speedUp(120));
run('steady right turn 80kmh (full steer)',(t,s)=>({steer:1,throttle:s&&s.kmh<80?1:0}),5,speedUp(80));
run('slalom 90kmh, 1s each way',(t,s)=>({steer:Math.floor(t)%2?1:-1,throttle:s&&s.kmh<90?1:0}),6,speedUp(90));
run('handbrake turn 90kmh',(t,s)=>({steer:t<2.5?1:0,handbrake:t>.3&&t<1.2,throttle:t>1.2?1:0}),4,speedUp(90));

// Real Namak lap section with the course AI driving the player car.
const {route,parts}=loadTrack('namak'),{world}=buildWorld(parts);
const pose=routePose(route,25,-2.2),sim=car(world,pose.position,pose.yaw);sim.reset(pose.position,pose.yaw,{stepWorld:false});
let s=sim.snapshot(),index=25,prev=null,unlockEvents=0,lockPops=[],maxStep=0,vyJitter=0,n=0,wasLocked=null,steerFlips=0,lastSteerSign=0,yawJerk=0;
for(let i=0;i<60/STEP;i++){const input=aiInput(route,s,index,-2.2,1,[],{speedProfile:{maxSpeed:200,lateralAcceleration:6.6,fullBrakingHorizon:true}});sim.step(input,false);stepVehicleWorld(world);const ns=sim.finishStep();index=nearestRoute(route,ns.position,index).index;
 const a=att(ns.rotation),pa=att(s.rotation),d=Math.max(Math.abs(a.pitch-pa.pitch),Math.abs(a.roll-pa.roll));maxStep=Math.max(maxStep,d);
 if(wasLocked!==null&&wasLocked!==!!ns.ride?.locked){unlockEvents++;}if(wasLocked===false&&ns.ride?.locked&&d>.3)lockPops.push({t:+(i*STEP).toFixed(2),deg:+d.toFixed(2),kmh:Math.round(ns.kmh)});wasLocked=!!ns.ride?.locked;
 vyJitter+=(ns.velocity.y-s.velocity.y)**2;n++;const sg=Math.sign(input.steer);if(sg&&lastSteerSign&&sg!==lastSteerSign)steerFlips++;if(sg)lastSteerSign=sg;
 yawJerk=Math.max(yawJerk,Math.abs(ns.angularVelocity.y-s.angularVelocity.y)/STEP);s=ns;}
console.log(`\n## Namak 60s AI-driven player car\n lock/unlock transitions ${unlockEvents}, re-lock pops >0.3deg: ${lockPops.length} ${JSON.stringify(lockPops.slice(0,6))}\n max per-step tilt change ${maxStep.toFixed(3)}deg, vertical accel RMS ${Math.sqrt(vyJitter/n)/STEP|0}m/s2, steer sign flips ${steerFlips}, max yaw-rate change ${(yawJerk*180/Math.PI).toFixed(0)}deg/s2`);
sim.dispose();world.free();
