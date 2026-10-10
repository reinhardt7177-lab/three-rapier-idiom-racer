import {Vector3} from 'three';

// Driver eye with exact horizontal tracking. Filter only heave and road pitch;
// no speed-dependent world-position lag, fake bob, or chassis roll.
export function createFirstPersonCamera(camera){
 const forward=new Vector3(),right=new Vector3(),target=new Vector3();
 let height=null,pitch=null;
 return {update(modelPosition,rotation,dt,{snap=false,roof=1.3,width=1.9,compact=false}={}){
  forward.set(0,0,1).applyQuaternion(rotation);
  const yaw=Math.atan2(forward.x,forward.z),roadPitch=Math.max(-.38,Math.min(.38,Math.atan2(forward.y,Math.hypot(forward.x,forward.z))));
  const eye=modelPosition.y+Math.max(1.03,roof-.1),seconds=Math.max(0,dt);
  if(height===null||snap){height=eye;pitch=roadPitch;}
  else{height+=(eye-height)*(1-Math.exp(-seconds/.12));height=Math.max(eye-.12,Math.min(eye+.12,height));pitch+=(roadPitch-pitch)*(1-Math.exp(-seconds/.18));}
  right.set(Math.cos(yaw),0,-Math.sin(yaw));forward.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
  camera.position.copy(modelPosition).addScaledVector(right,-width*.19);
  camera.position.y=height;camera.position.addScaledVector(new Vector3(Math.sin(yaw),0,Math.cos(yaw)),.12);
  camera.up.set(0,1,0);target.copy(camera.position).addScaledVector(forward,30);camera.lookAt(target);
  camera.fov=compact?78:72;camera.near=.04;camera.updateProjectionMatrix();
  return {eyeHeight:height-modelPosition.y,pitch};
 }};
}
