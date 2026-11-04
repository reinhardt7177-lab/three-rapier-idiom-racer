// Rendering only. +Z is forward; +X is driver-left. The physical chassis,
// suspension, steering and tyre transforms never receive these angles.
export const BODY_MOTION=Object.freeze({frequency:1.75,damping:.65,pitchLimit:1.8*Math.PI/180,rollLimit:3*Math.PI/180});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function createBodyMotion(){
 const omega=2*Math.PI*BODY_MOTION.frequency,decayRate=BODY_MOTION.damping*omega,wd=omega*Math.sqrt(1-BODY_MOTION.damping**2);
 let pitchRate=0,rollRate=0;
 const pose={pitch:0,roll:0,forwardAcceleration:0,lateralAcceleration:0};
 const sampledBefore={pitch:0,roll:0},presented={...pose};
 function reset(){
  pitchRate=rollRate=0;pose.pitch=pose.roll=pose.forwardAcceleration=pose.lateralAcceleration=0;
  sampledBefore.pitch=sampledBefore.roll=0;Object.assign(presented,pose);return pose;
 }
 function advance(previous,current,seconds,{sampleSeconds=1/120,reducedMotion=false,enabled=true}={}){
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
  // Exact underdamped spring solution. The fixed-step sampling API below must
  // receive every physical state pair; a render callback can skip an impulse.
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
 }
 return {
  reset,snapshot:()=>({...pose}),
  // Keep the original render-driven API for existing ghost callers. It does
  // not leave stale interpolation history if a view later starts fixed sampling.
  update(previous,current,seconds,options){
   if(!(seconds>0))return pose;
   advance(previous,current,seconds,options);
   sampledBefore.pitch=pose.pitch;sampledBefore.roll=pose.roll;return pose;
  },
  sample(previous,current,seconds,options={}){
   if(!Number.isFinite(seconds)||!(seconds>0))return pose;
   if(options.enabled===false)return reset();
   sampledBefore.pitch=pose.pitch;sampledBefore.roll=pose.roll;
   // A remote state interval can exceed the legacy 50ms render cap. Integrate
   // its whole interval, but measure acceleration over that interval only once.
   const parts=Math.ceil(seconds/.05),dt=seconds/parts;
   const settings={...options,sampleSeconds:options.sampleSeconds??seconds};
   for(let i=0;i<parts;i++)advance(previous,current,dt,settings);
   return pose;
  },
  pose(alpha=1){
   const mix=Number.isFinite(alpha)?clamp(alpha,0,1):1;
   presented.pitch=sampledBefore.pitch+(pose.pitch-sampledBefore.pitch)*mix;
   presented.roll=sampledBefore.roll+(pose.roll-sampledBefore.roll)*mix;
   presented.forwardAcceleration=pose.forwardAcceleration;presented.lateralAcceleration=pose.lateralAcceleration;
   return presented;
  },
 };
}

// Sampling stores scalar visual state only. Presenting writes only the static
// body pivot; neither operation touches physics, wheel or suspension transforms.
export function sampleBodyMotion(view,previous,current,seconds,options){
 return view.motion.sample(previous,current,seconds,options);
}

export function presentBodyMotion(view,alpha=1,{enabled=true,paused=false}={}){
 if(!enabled)return resetBodyMotion(view);
 const pose=view.motion.pose(alpha);
 if(paused){pose.pitch=view.body.rotation.x;pose.roll=view.body.rotation.z;return pose;}
 view.body.rotation.x=pose.pitch;view.body.rotation.z=pose.roll;return pose;
}

export function resetBodyMotion(view){
 const pose=view.motion.reset();view.body.rotation.x=view.body.rotation.z=0;return pose;
}

export function applyBodyMotion(view,previous,current,seconds,options){
 const pose=view.motion.update(previous,current,seconds,options);
 view.body.rotation.x=pose.pitch;view.body.rotation.z=pose.roll;
 return pose;
}
