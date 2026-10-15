// Gameplay calibration in SI units, not a claim of manufacturer simulation data.
const common={activeRide:true,ratios:[3.8,2.4,1.65,1.25,1,.82],finalDrive:3.15,redline:6500,grip:2.3,frontDriveBias:0,frontBrakeBias:.64,steeringAcceleration:12.8,suspensionCompression:7,suspensionRelaxation:8};
// Clear the recovered city's kerbs while retaining two separated grid lanes.
export const RACE_GRID_LANE=2.2;
export const RACE_TUNING=Object.freeze({
 // Preserve the Supra calibration already verified over the mountain seams.
 supra:{...common,mass:1480,torque:470,length:4.38,width:1.89,collisionWidth:1.96,roof:1.30,throttleTime:.09,shiftDuration:.18,torquePeak:4200,torqueSpread:4200,engineBrake:38},
 slk:{...common,mass:1450,torque:380,length:4.14,width:1.80,collisionWidth:1.90,roof:1.27,openTop:true,finalDrive:3.35,grip:2.2,frontBrakeBias:.66,steeringAcceleration:12.3,throttleTime:.13,shiftDuration:.22,torquePeak:4200,torqueSpread:4200,engineBrake:32},
 mustang:{...common,mass:1680,torque:530,length:4.8,width:1.94,collisionWidth:2.04,roof:1.39,ratios:[3.4,2.2,1.55,1.16,.89,.72],finalDrive:3.55,suspensionCompression:4.4,suspensionRelaxation:5.2,frontBrakeBias:.68,steeringAcceleration:12.3,throttleTime:.14,shiftDuration:.24,torquePeak:4500,torqueSpread:4700,engineBrake:46},
 porsche911:{...common,mass:1450,torque:460,length:4.52,width:1.86,collisionWidth:2.04,roof:1.30,finalDrive:3.3,grip:2.5,frontBrakeBias:.62,steeringAcceleration:13.1,throttleTime:.085,shiftDuration:.16,torquePeak:4800,torqueSpread:5000,engineBrake:42},
 gtr:{...common,mass:1730,torque:560,length:4.71,width:1.90,collisionWidth:2.05,roof:1.36,finalDrive:3.1,grip:2.45,frontDriveBias:.40,steeringAcceleration:13.1,throttleTime:.10,shiftDuration:.15,torquePeak:4400,torqueSpread:5000,engineBrake:40},
 rx7:{...common,mass:1280,torque:380,length:4.28,width:1.77,collisionWidth:2.02,roof:1.22,redline:7500,finalDrive:3.65,grip:2.2,steeringAcceleration:12.5,throttleTime:.075,shiftDuration:.20,torquePeak:5500,torqueSpread:5600,engineBrake:28},
 m3:{...common,mass:1600,torque:460,length:4.67,width:1.84,collisionWidth:2.04,roof:1.43,finalDrive:3.3,grip:2.4,frontBrakeBias:.66,steeringAcceleration:13,throttleTime:.095,shiftDuration:.18,torquePeak:4500,torqueSpread:4800,engineBrake:39},
 huracan:{...common,mass:1440,torque:540,length:4.46,width:1.93,collisionWidth:2.04,roof:1.16,redline:8000,finalDrive:3.25,grip:2.6,frontDriveBias:.35,steeringAcceleration:13.5,throttleTime:.065,shiftDuration:.13,torquePeak:6200,torqueSpread:6000,engineBrake:44},
});
// The wider rack envelope needs tyre capacity too; angle alone saturates grip.
// Return a copy so the five AI cars retain their existing calibration.
export function playerRaceTuning(id){
 const tuning=RACE_TUNING[id];
 return {...tuning,grip:tuning.grip*1.3};
}
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export function createRaceDrivetrain(tuning,radius){
 let gear=1,shiftTime=0,cooldown=0,pedal=0,last={rpm:850,gear:'N',force:0,shifting:false,load:0};
 const roadRpm=(speed,ratio)=>Math.abs(speed)/radius*60/(2*Math.PI)*ratio*tuning.finalDrive;
 function reset(){gear=1;shiftTime=cooldown=pedal=0;last={rpm:850,gear:'N',force:0,shifting:false,load:0};}
 return {reset,snapshot:()=>({...last}),update({speed,drive,brake=0},dt){
  cooldown=Math.max(0,cooldown-dt);shiftTime=Math.max(0,shiftTime-dt);
  pedal+=(Math.abs(drive)-pedal)*(1-Math.exp(-dt/(tuning.throttleTime??.09)));
  const reverse=drive<0||speed<-.5;
  let ratio=reverse?3.1:tuning.ratios[gear-1];let rpm=roadRpm(speed,ratio);
  if(!reverse&&!cooldown){
   let next=gear;
   if(rpm>tuning.redline-400&&gear<tuning.ratios.length)next++;
   else if(gear>1&&rpm<2500&&roadRpm(speed,tuning.ratios[gear-2])<tuning.redline-600)next--;
   if(next!==gear){gear=next;shiftTime=tuning.shiftDuration??.18;cooldown=.55;ratio=tuning.ratios[gear-1];rpm=roadRpm(speed,ratio);}
  }
  rpm=clamp(Math.max(rpm,850+pedal*650),850,tuning.redline);
  const torque=tuning.torque*clamp(1-.30*((rpm-(tuning.torquePeak??4200))/(tuning.torqueSpread??4200))**2,.60,1);
  const limiter=rpm>=tuning.redline-20?.12:1;
  let force=drive===0?0:Math.sign(drive)*pedal*torque*ratio*tuning.finalDrive*.86/radius*(shiftTime>0?.20:1)*limiter;
  if(brake>0)force=0;
  else if(!drive&&Math.abs(speed)>2.5)force=-Math.sign(speed)*(tuning.engineBrake??38)*ratio*tuning.finalDrive/radius;
  last={rpm,gear:reverse?'R':Math.abs(speed)<.3&&!drive?'N':String(gear),force,shifting:shiftTime>0,load:pedal};return {...last};
 }};
}
