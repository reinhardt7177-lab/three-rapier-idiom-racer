import fs from 'node:fs';
import {initPhysics,createVehiclePhysics,STEP} from '../src/driving/physics.js';
import {VEHICLES} from '../src/rebuild/fleet.js';
import {playerRaceTuning} from '../src/rebuild/vehicleDynamics.js';
import {PLAYER_STEERING_SENSITIVITY} from '../src/driving/steering.js';
await initPhysics();
const rows=[];
for(const spec of VEHICLES){
 const sim=createVehiclePhysics({barriers:false,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec,raceTuning:playerRaceTuning(spec.id),steeringSensitivity:PLAYER_STEERING_SENSITIVITY,start:{x:0,y:.85,z:-600}});
 try{
  for(let i=0;i<120;i++)sim.step({brake:1});
  let s=sim.snapshot(),seconds=0,shifts=0,gear=s.gear;
  while(s.kmh<100&&seconds<15){s=sim.step({throttle:1});seconds+=STEP;if(s.gear!==gear){shifts++;gear=s.gear;}}
  const start={...s.position},speed=s.kmh;let brakeSeconds=0;
  while(s.kmh>.2&&brakeSeconds<10){s=sim.step({brake:1});brakeSeconds+=STEP;}
  rows.push({id:spec.id,time100:seconds,speedAtBrake:speed,brakeSeconds,brakeMetres:Math.hypot(s.position.x-start.x,s.position.z-start.z),shifts,contacts:s.contacts});
 }finally{sim.dispose();}
}
const output=process.argv[2];if(output)fs.writeFileSync(output,JSON.stringify(rows,null,2));
console.log(JSON.stringify(rows,null,2));
