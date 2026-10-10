import {Vector3,Quaternion,Matrix4} from 'three';

// Blender's origin is below the physics origin, in the car's LOCAL frame.
export function modelPosition(position,rotation,offset=.6){
 return new Vector3(0,-offset,0).applyQuaternion(rotation).add(position);
}

export function roadRecoveryPose(point,normal,yaw,spec){
 const up=new Vector3(normal.x,normal.y,normal.z).normalize();
 const forward=new Vector3(Math.sin(yaw),0,Math.cos(yaw)).projectOnPlane(up).normalize();
 const right=new Vector3().crossVectors(up,forward).normalize();
 const rotation=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right,up,forward));
 // Four springs carry the mass: F = mass * stiffness * compression.
 // Use the real rest length / connection / stiffness, plus 2 cm clearance.
 const height=(spec.wheelRadius??.35)+.34-.1-9.81/(2*(38+34))+.02;
 return {position:new Vector3(point.x,point.y,point.z).addScaledVector(up,height),rotation};
}

export function createRecoveryWatch(){
 let overturned=0,fallen=0;
 return {reset(){overturned=fallen=0;},update(state,roadY,dt){
  if(!(dt>0&&dt<=.1))return null;
  const q=state.rotation,up=1-2*(q.x*q.x+q.z*q.z);
  overturned=up<.25?overturned+dt:0;
  fallen=state.position.y<roadY-6?fallen+dt:0;
  if(overturned>=1.5||fallen>=.5){overturned=fallen=0;return up<.25?'overturned':'fallen';}
  return null;
 }};
}

export function recoverySpaceClear(position,traffic){
 return traffic.every(s=>{
  const dx=position.x-s.position.x,dz=position.z-s.position.z;
  const vx=s.velocity?.x??0,vz=s.velocity?.z??0,speed2=vx*vx+vz*vz;
  // Keep clear of the next second of traffic, not just its present location.
  const time=speed2>1e-6?Math.max(0,Math.min(1,(dx*vx+dz*vz)/speed2)):0;
  return Math.hypot(dx-vx*time,dz-vz*time)>=6;
 });
}

export function recoveryProgressChange(from,to,length){
 let delta=to-from;
 if(delta>length/2)delta-=length;
 if(delta<-length/2)delta+=length;
 return Math.min(0,delta);
}
