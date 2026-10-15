import fs from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {initPhysics,createVehiclePhysics,STEP,stepVehicleWorld} from '../../src/driving/physics.js';
import {PLAYER_STEERING_SENSITIVITY} from '../../src/driving/steering.js';
import {playerRaceTuning} from '../../src/rebuild/vehicleDynamics.js';
import {VEHICLES} from '../../src/rebuild/fleet.js';
import {createBodyMotion} from '../../src/rebuild/bodyMotion.js';
await initPhysics();const rows=[],deg=x=>x*180/Math.PI;
for(const [name,initial,seconds,inputAt] of [
 ['acceleration',0,6,()=>({throttle:1})],['braking',120,4,()=>({brake:1})],
 ['corner-right',80,5,(t,s)=>({steer:1,throttle:s.kmh<80?1:0})],
 ['slalom',90,6,(t,s)=>({steer:Math.floor(t)%2?1:-1,throttle:s.kmh<90?1:0})],
]){
 const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;world.numSolverIterations=8;world.createCollider(RAPIER.ColliderDesc.cuboid(1000,.5,1000).setTranslation(0,-.5,0));
 const sim=createVehiclePhysics({sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec:VEHICLES[0],raceTuning:playerRaceTuning('supra'),steeringSensitivity:PLAYER_STEERING_SENSITIVITY,start:{x:0,y:.6,z:0}});
 sim.reset({x:0,y:.6,z:0},0,{stepWorld:false});for(let i=0;i<120;i++){sim.step({brake:1},false);stepVehicleWorld(world);sim.finishStep();}
 sim.body.setLinvel({x:0,y:0,z:initial/3.6},true);
 const motion=createBodyMotion();let previous=sim.snapshot(),minPitch=0,maxPitch=0,maxRoll=0,physicalTilt=0;
 for(let i=0;i<seconds/STEP;i++){
  sim.step(inputAt(i*STEP,previous),false);stepVehicleWorld(world);const state=sim.finishStep();
  if(i%2===0){const p=motion.update(previous,state,2*STEP,{sampleSeconds:STEP});minPitch=Math.min(minPitch,deg(p.pitch));maxPitch=Math.max(maxPitch,deg(p.pitch));maxRoll=Math.max(maxRoll,Math.abs(deg(p.roll)));}
  physicalTilt=Math.max(physicalTilt,Math.abs(deg(Math.asin(2*(state.rotation.x*state.rotation.y+state.rotation.w*state.rotation.z)))));previous=state;
 }
 rows.push({name,renderHz:60,reducedMotion:false,visualPitchDeg:[minPitch,maxPitch],visualRollMaxDeg:maxRoll,physicalRollMaxDeg:physicalTilt});sim.dispose();world.free();
}
fs.writeFileSync(new URL('visual-probe.json',import.meta.url),JSON.stringify(rows,null,2));console.log(JSON.stringify(rows,null,2));
