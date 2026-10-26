import {Vector3} from 'three';

// Driver eye with exact horizontal tracking. Filter only heave and road pitch;
// no speed-dependent world-position lag, fake bob, or chassis roll.
export function createFirstPersonCamera(camera){
 const forward=new Vector3(),right=new Vector3(),target=new Vector3();
 let height=null,pitch=null,pedalCue=0,hit=0,hitTime=0,hitSide=0,hitForward=0,directional=false;
 return {update(modelPosition,rotation,dt,{snap=false,roof=1.3,width=1.9,compact=false,pedalResponse=false,motion=true,push=0,braking=0,drive=0,grounded=true,kmh=0,impact=0,impactDirection=null}={}){
  forward.set(0,0,1).applyQuaternion(rotation);
  const yaw=Math.atan2(forward.x,forward.z),roadPitch=Math.max(-.38,Math.min(.38,Math.atan2(forward.y,Math.hypot(forward.x,forward.z))));
  const eye=modelPosition.y+Math.max(1.03,roof-.1),seconds=Math.max(0,dt);
  if(height===null||snap){height=eye;pitch=roadPitch;}
  else{height+=(eye-height)*(1-Math.exp(-seconds/.12));height=Math.max(eye-.12,Math.min(eye+.12,height));pitch+=(roadPitch-pitch)*(1-Math.exp(-seconds/.18));}
  right.set(Math.cos(yaw),0,-Math.sin(yaw));forward.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
  camera.position.copy(modelPosition).addScaledVector(right,-width*.19);
  camera.position.y=height;camera.position.addScaledVector(new Vector3(Math.sin(yaw),0,Math.cos(yaw)),.12);
  camera.up.set(0,1,0);target.copy(camera.position).addScaledVector(forward,30);camera.lookAt(target);
  if(snap||!motion){hit=hitTime=hitSide=hitForward=0;directional=false;}
  if(seconds>0&&motion&&impact>0){hit=Math.max(hit,Math.min(1,impact));hitTime=0;directional=!!impactDirection;hitSide=Math.max(-1,Math.min(1,Number(impactDirection?.side)||0));hitForward=Math.max(-1,Math.min(1,Number(impactDirection?.forward)||0));}
  hitTime+=seconds;hit*=Math.exp(-seconds*12);
  // A contact-only lens kick stays below half a degree; driver eye never moves.
  if(motion){camera.rotateZ((directional?hitSide:Math.sin(hitTime*45))*hit*.008);camera.rotateX(-hitForward*hit*.006);}
  const demand=pedalResponse&&motion&&grounded?Math.max(-1,Math.min(1,braking>0?-braking:drive>0?.35+.65*push:0)):0;
  if(snap||!motion||!pedalResponse)pedalCue=0;
  else pedalCue+=(demand-pedalCue)*(1-Math.exp(-seconds/(demand<0?.16:.42)));
  // Keep eyes/steering wheel fixed in the cabin: only a bounded lens cue.
  const fov=(compact?78:72)+(pedalResponse&&motion?Math.min(1,Math.max(0,kmh)/240)*1.5+pedalCue*.8-hit*1.5:0);
  camera.fov=snap||!motion||!pedalResponse?fov:camera.fov+(fov-camera.fov)*(1-Math.exp(-seconds*4));
  camera.near=.04;camera.updateProjectionMatrix();
  return {eyeHeight:height-modelPosition.y,pitch,pedalCue};
 }};
}
