import fs from 'node:fs';
import path from 'node:path';
import {initPhysics,createVehiclePhysics,STEP,forwardOf} from '../src/driving/physics.js';
import {steeringLimit,updateSteering,PLAYER_STEERING_SENSITIVITY} from '../src/driving/steering.js';
import {VEHICLES} from '../src/rebuild/fleet.js';
import {playerRaceTuning} from '../src/rebuild/vehicleDynamics.js';

await initPhysics();
const degrees=x=>x*180/Math.PI;
const yaw=q=>Math.atan2(2*(q.x*q.z+q.w*q.y),1-2*(q.x*q.x+q.y*q.y));
function measure(spec,kmh,side,handbrake=false){
 const sim=createVehiclePhysics({barriers:false,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec,raceTuning:playerRaceTuning(spec.id),steeringSensitivity:PLAYER_STEERING_SENSITIVITY,start:{x:0,y:1,z:-600}});
 try{
  let s;for(let i=0;i<180;i++)s=sim.step({brake:1});
  for(let i=0;i<2400&&s.kmh<kmh;i++)s=sim.step({throttle:1});
  if(s.kmh<kmh)return {id:spec.id,kmh,side,handbrake,reached:false,actualKmh:s.kmh};
  let distance=0,turn=0,minUp=1,minContacts=4,peakSlip=0,speedSum=0,samples=0;
  const timeline=[];
  for(let i=0;i<180;i++){
   const prev=s;s=sim.step({steer:side,handbrake,throttle:s.kmh<kmh?1:0,brake:s.kmh>kmh+1?.2:0});
   minUp=Math.min(minUp,1-2*(s.rotation.x**2+s.rotation.z**2));minContacts=Math.min(minContacts,s.contacts);
   const f=forwardOf(s.rotation),slip=Math.atan2(Math.abs(s.velocity.x*f.z-s.velocity.z*f.x),Math.max(1,Math.abs(s.speed)));
   peakSlip=Math.max(peakSlip,slip);
   if(i>30&&Math.abs(s.kmh-kmh)<3&&Math.abs(prev.kmh-kmh)<3){
    const delta=yaw(s.rotation)-yaw(prev.rotation);turn+=Math.atan2(Math.sin(delta),Math.cos(delta));
    distance+=Math.hypot(s.position.x-prev.position.x,s.position.z-prev.position.z);speedSum+=s.kmh;samples++;
   }
   if([5,11,29,59,119,179].includes(i))timeline.push({time:(i+1)*STEP,rackDeg:degrees(s.steer),frontDeg:[degrees(s.wheels[1].steering),degrees(s.wheels[3].steering)],yawDeg:degrees(yaw(s.rotation)),kmh:s.kmh});
  }
  const turnEnd=yaw(s.rotation);let release;for(let i=0;i<60;i++)release=sim.step({throttle:.3});
  return {id:spec.id,kmh,side,handbrake,reached:true,radius:samples?Math.abs(distance/turn):null,samples,measuredKmh:samples?speedSum/samples:null,minUp,minContacts,peakSlipDeg:degrees(peakSlip),yawEndDeg:degrees(turnEnd),releasedRackDeg:degrees(release.steer),timeline};
 }finally{sim.dispose();}
}
const rack=VEHICLES.map(spec=>({id:spec.id,angles:[0,30,60,90,140,180,230].map(kmh=>({kmh,degrees:degrees(steeringLimit(kmh/3.6,true,{...spec,...playerRaceTuning(spec.id)},PLAYER_STEERING_SENSITIVITY))}))}));
const response=[];let value=0;
for(let i=0;i<30;i++){value=updateSteering(value,1,STEP,true,PLAYER_STEERING_SENSITIVITY);if([5,11,17,29].includes(i))response.push({time:(i+1)*STEP,input:value});}
const turns=[];for(const spec of VEHICLES)for(const speed of [30,60,90,140,180])for(const side of [-1,1])turns.push(measure(spec,speed,side));
const drifts=[];for(const spec of VEHICLES)for(const side of [-1,1])drifts.push(measure(spec,90,side,true));
const output=process.argv[2];if(!output)throw new Error('Pass an output JSON path');
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({rack,response,turns,drifts},null,2));
console.log(JSON.stringify({output,measurements:turns.length+drifts.length,supraAngles:rack[0],response,unsupported:turns.filter(r=>r.minContacts<4).map(r=>({id:r.id,kmh:r.kmh,side:r.side,minContacts:r.minContacts})),unreached:turns.filter(r=>!r.reached)},null,2));
