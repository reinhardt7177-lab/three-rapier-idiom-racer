// Rendering only. +Z is forward; +X is driver-left. The physical chassis,
// suspension, steering and tyre transforms never receive these angles.
export const BODY_MOTION=Object.freeze({frequency:1.75,damping:.65,pitchLimit:1.8*Math.PI/180,rollLimit:3*Math.PI/180});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function createBodyMotion(){
 const omega=2*Math.PI*BODY_MOTION.frequency,decayRate=BODY_MOTION.damping*omega,wd=omega*Math.sqrt(1-BODY_MOTION.damping**2);
 let pitchRate=0,rollRate=0;
 const pose={pitch:0,roll:0,forwardAcceleration:0,lateralAcceleration:0};
 function reset(){pitchRate=rollRate=0;pose.pitch=pose.roll=pose.forwardAcceleration=pose.lateralAcceleration=0;return pose;}
 return {reset,snapshot:()=>({...pose}),update(previous,current,seconds,{sampleSeconds=1/120,reducedMotion=false,enabled=true}={}){
  if(!(seconds>0))return pose; // A paused frame must not decay or change targets.
  if(!enabled)return reset();
  const dt=Math.min(seconds,.05),q=current?.rotation,a=previous?.velocity,b=current?.velocity;
  let forward=0,lateral=0;
  if(q&&a&&b&&sampleSeconds>0){
   const x=(b.x-a.x)/sampleSeconds,y=(b.y-a.y)/sampleSeconds,z=(b.z-a.z)/sampleSeconds;
   forward=x*2*(q.x*q.z+q.w*q.y)+y*2*(q.y*q.z-q.w*q.x)+z*(1-2*(q.x*q.x+q.y*q.y));
   lateral=x*(1-2*(q.y*q.y+q.z*q.z))+y*2*(q.x*q.y+q.w*q.z)+z*2*(q.x*q.z-q.w*q.y);
  }
  if(!Number.isFinite(forward)||!Number.isFinite(lateral))forward=lateral=0;
  pose.forwardAcceleration=forward;pose.lateralAcceleration=lateral;
  const scale=reducedMotion?.25:1,pl=BODY_MOTION.pitchLimit*scale,rl=BODY_MOTION.rollLimit*scale;
  const pitchTarget=clamp(-forward/8,-1,1)*pl,rollTarget=clamp(lateral/16,-1,1)*rl;
  // Exact underdamped spring solution: frame-rate independent and stable even
  // when a render callback skips one or more 120Hz physics steps.
  const e=Math.exp(-decayRate*dt),c=Math.cos(wd*dt),s=Math.sin(wd*dt);
  let d=pose.pitch-pitchTarget;
  pose.pitch=pitchTarget+e*(d*c+(pitchRate+decayRate*d)/wd*s);
  pitchRate=e*(pitchRate*c-(decayRate*pitchRate+omega*omega*d)/wd*s);
  d=pose.roll-rollTarget;
  pose.roll=rollTarget+e*(d*c+(rollRate+decayRate*d)/wd*s);
  rollRate=e*(rollRate*c-(decayRate*rollRate+omega*omega*d)/wd*s);
  if(Math.abs(pose.pitch)>pl){pose.pitch=clamp(pose.pitch,-pl,pl);if(pose.pitch*pitchRate>0)pitchRate=0;}
  if(Math.abs(pose.roll)>rl){pose.roll=clamp(pose.roll,-rl,rl);if(pose.roll*rollRate>0)rollRate=0;}
  return pose;
 }};
}

export function applyBodyMotion(view,previous,current,seconds,options){
 const pose=view.motion.update(previous,current,seconds,options);
 view.body.rotation.x=pose.pitch;view.body.rotation.z=pose.roll;
 return pose;
}
