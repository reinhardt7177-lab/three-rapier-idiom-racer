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

export function createRecoveryWatch({roadHalfWidth=Infinity}={}){
 let overturned=0,fallen=0,offtrack=0;
 return {reset(){overturned=fallen=offtrack=0;},update(state,roadY,dt,roadDistance=0){
  if(!(dt>0&&dt<=.1))return null;
  const q=state.rotation,up=1-2*(q.x*q.x+q.z*q.z);
  overturned=up<.25?overturned+dt:0;
  fallen=state.position.y<roadY-6?fallen+dt:0;
  offtrack=roadDistance>roadHalfWidth+1?offtrack+dt:0;
  if(overturned>=1.5||fallen>=.5||offtrack>=1){const reason=up<.25?'overturned':fallen>=.5?'fallen':'offtrack';overturned=fallen=offtrack=0;return reason;}
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

export function findRecoveryPose(route,index,lanes,traffic,spawn){
 const steps=Math.min(route.points.length-1,Math.max(32,Math.ceil(180*route.points.length/route.length)));
 for(let back=0;back<=steps;back+=2){
  const candidateIndex=(index-back+route.points.length)%route.points.length;
  for(const lane of lanes){
   const pose=spawn(candidateIndex,lane);
   if(recoverySpaceClear(pose.position,traffic))return {pose,index:candidateIndex,lane};
  }
 }
 return null;
}
