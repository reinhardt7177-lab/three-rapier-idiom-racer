import RAPIER from '@dimforge/rapier3d-compat';
import {initPhysics,createVehiclePhysics,STEP,stepVehicleWorld} from '../../src/driving/physics.js';
import {PLAYER_STEERING_SENSITIVITY} from '../../src/driving/steering.js';
import {RACE_TUNING} from '../../src/rebuild/vehicleDynamics.js';
import {VEHICLES} from '../../src/rebuild/fleet.js';
await initPhysics();
for(const grip of [2.99,2.3,2,1.85,1.7,1.55]){
 const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;world.numSolverIterations=8;world.createCollider(RAPIER.ColliderDesc.cuboid(1000,.5,1000).setTranslation(0,-.5,0));
 const sim=createVehiclePhysics({sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec:VEHICLES[0],raceTuning:{...RACE_TUNING.supra,grip},steeringSensitivity:PLAYER_STEERING_SENSITIVITY,start:{x:0,y:.6,z:0}});
 sim.reset({x:0,y:.6,z:0},0,{stepWorld:false});
 for(let k=0;k<120;k++){sim.step({brake:1},false);stepVehicleWorld(world);sim.finishStep();}
 sim.body.setLinvel({x:0,y:0,z:80/3.6},true);let previous=sim.snapshot(),peak=0,total=0,n=0,minSpeed=80;
 for(let k=0;k<600;k++){
  sim.step({steer:1,throttle:previous.kmh<80?1:0},false);stepVehicleWorld(world);const s=sim.finishStep(),q=s.rotation;
  const fx=2*(q.x*q.z+q.w*q.y),fz=1-2*(q.x*q.x+q.y*q.y),lat=Math.abs(((s.velocity.x-previous.velocity.x)*fz-(s.velocity.z-previous.velocity.z)*fx)/STEP);
  peak=Math.max(peak,lat);if(k>=120&&k<360){total+=lat;n++;}minSpeed=Math.min(minSpeed,s.kmh);previous=s;
 }
 console.log(JSON.stringify({grip,peakLateral:peak,steadyLateral:total/n,minSpeed,endSpeed:previous.kmh}));sim.dispose();world.free();
}
