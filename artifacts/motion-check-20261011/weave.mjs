// Do AI-driven cars visibly weave on straights? Heading wobble vs the road direction.
import {initPhysics,createVehiclePhysics,STEP,stepVehicleWorld} from '../../src/driving/physics.js';
import {RACE_TUNING} from '../../src/rebuild/vehicleDynamics.js';
import {VEHICLES} from '../../src/rebuild/fleet.js';
import {nearestRoute,aiInput,routePose,curveSpeeds} from '../../src/rebuild/course.js';
import {difficultyById} from '../../src/rebuild/raceDifficulty.js';
import {loadTrack,buildWorld} from '../../scripts/race-sim.mjs';
await initPhysics();
for(const trackId of ['namak','coastal']){
 const {route,parts}=loadTrack(trackId),{world}=buildWorld(parts),limits=curveSpeeds(route);
 const pose=routePose(route,25,-2.2),sim=createVehiclePhysics({sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,start:pose.position,spec:VEHICLES[0],raceTuning:RACE_TUNING.supra});
 sim.reset(pose.position,pose.yaw,{stepWorld:false});let s=sim.snapshot(),index=25,straight=0,headErr2=0,yr2=0,maxHead=0,lat=[],flips=0,last=0;
 for(let i=0;i<50/STEP;i++){const input=aiInput(route,s,index,-2.2,1,[],{speedProfile:difficultyById('normal').profile});sim.step(input,false);stepVehicleWorld(world);s=sim.finishStep();index=nearestRoute(route,s.position,index).index;
  if(limits[index]>=137&&s.kmh>80){const p=route.points[index],q=s.rotation,yaw=Math.atan2(2*(q.x*q.z+q.w*q.y),1-2*(q.x*q.x+q.y*q.y));let e=yaw-Math.atan2(p.dx,p.dz);e=Math.atan2(Math.sin(e),Math.cos(e));headErr2+=e*e;yr2+=s.angularVelocity.y**2;maxHead=Math.max(maxHead,Math.abs(e));straight++;
   const sg=Math.sign(s.angularVelocity.y);if(Math.abs(s.angularVelocity.y)>.02&&sg!==last){if(last)flips++;last=sg;}}}
 const sec=straight*STEP;console.log(trackId,`straight time ${sec.toFixed(1)}s  heading wobble RMS ${(Math.sqrt(headErr2/straight)*180/Math.PI).toFixed(2)}deg max ${(maxHead*180/Math.PI).toFixed(2)}deg  yaw-rate RMS ${(Math.sqrt(yr2/straight)*180/Math.PI).toFixed(2)}deg/s  yaw direction changes ${(flips/sec).toFixed(1)}/s`);
 sim.dispose();world.free();
}
