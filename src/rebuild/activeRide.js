import {Vector3,Quaternion,Matrix4} from 'three';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// Estimate the support plane across the tyre footprint, not the normal of the
// particular triangle a ray hit. Local coordinates also avoid large-world loss.
function supportPlane(points,position,fallback){
 let x=0,y=0,z=0;
 for(const p of points){x+=p.x-position.x;y+=p.y;z+=p.z-position.z;}
 x/=points.length;y/=points.length;z/=points.length;
 let xx=0,zz=0,xz=0,xy=0,zy=0;
 for(const p of points){const dx=p.x-position.x-x,dz=p.z-position.z-z,dy=p.y-y;xx+=dx*dx;zz+=dz*dz;xz+=dx*dz;xy+=dx*dy;zy+=dz*dy;}
 const determinant=xx*zz-xz*xz;
 let sx=-fallback.x/fallback.y,sz=-fallback.z/fallback.y;
 if(points.length>=3&&determinant>1e-5){sx=(xy*zz-zy*xz)/determinant;sz=(zy*xx-xy*xz)/determinant;}
 const normal=new Vector3(-sx,1,-sz).normalize();
 const height=y-sx*x-sz*z;
 const residual=Math.sqrt(points.reduce((sum,p)=>sum+(p.y-height-sx*(p.x-position.x)-sz*(p.z-position.z))**2,0)/points.length);
 return {normal,height,residual};
}

// Rapier still computes tyre contact, travel, load and horizontal impulses.
// This controller owns the grounded chassis's vertical support. Its correction
// is bounded, including on landing; it never acts without current wheel support.
export function createActiveRide(body,controller,radius,{restHeight=radius+.34-.1-9.81/144,normalTime=.10,heightTime=.025,frequency=18,maxAcceleration=24}={}){
 const up=new Vector3(0,1,0),normal=new Vector3(),forward=new Vector3(),right=new Vector3(),q=new Quaternion(),basis=new Matrix4();
 let locked=false,ground=null,lastPosition=null,transitions=0;
 const grounds=new Set();
 let telemetry={locked:false,contacts:0,reason:'reset',transitions:0};
 const release=reason=>{
  if(locked){body.setEnabledRotations(true,true,true,true);transitions++;}
  locked=false;ground=null;lastPosition=null;grounds.clear();
  telemetry={...telemetry,locked:false,reason,transitions};return false;
 };
 return {supportsCollider:handle=>locked&&grounds.has(handle),snapshot:()=>({...telemetry,normal:telemetry.normal?{...telemetry.normal}:null}),reset(){release('reset');up.set(0,1,0);transitions=0;telemetry={locked:false,contacts:0,reason:'reset',transitions:0};},update(dt,beforeVelocity){
  const points=[];normal.set(0,0,0);grounds.clear();
  for(let i=0;i<4;i++){
   if(!controller.wheelIsInContact(i))continue;
   const n=controller.wheelContactNormal(i),p=controller.wheelContactPoint(i);
   if(!n||!p||n.y<.6)continue;
   normal.add(new Vector3(n.x,n.y,n.z));points.push(p);
   const collider=controller.wheelGroundObject(i);if(collider)grounds.add(collider.handle);
  }
  telemetry.contacts=points.length;
  const rotation=body.rotation(),bodyUp=1-2*(rotation.x**2+rotation.z**2);
  // A supported pair can maintain an existing constraint through a seam. One
  // tyre, no tyres, steep side contact and genuine jumps release immediately.
  if(points.length<(locked?2:3)||bodyUp<.6)return release('unsupported');
  normal.normalize();
  const position=body.translation(),plane=supportPlane(points,position,points.length>=3?normal:up);
  // One raised tyre does not define a new road bank. When contacts disagree
  // with one plane, use their surface normals for attitude and leave the
  // independent wheel travel to absorb the kerb.
  const uneven=clamp((plane.residual-.005)/.025,0,1);
  plane.normal.lerp(normal,uneven).normalize();
  if(plane.normal.y<.6)return release('steep');
  if(!locked)up.set(0,1,0).applyQuaternion(q.copy(rotation));
  up.lerp(plane.normal,1-Math.exp(-dt/normalTime)).normalize();
  const velocity=body.linvel(),roadRate=-(up.x*velocity.x+up.z*velocity.z)/up.y;
  if(beforeVelocity.y-roadRate>4)return release('jump');
  if(ground===null)ground=plane.height;
  else {
   // Predict the height of the same plane at the moved chassis, then correct
   // the residual. Constant hills are followed without accumulating filter lag.
   const dx=position.x-lastPosition.x,dz=position.z-lastPosition.z;
   ground-= (up.x*dx+up.z*dz)/up.y;
   const responseTime=heightTime+(.10-heightTime)*uneven;
   ground+=(plane.height-ground)*(1-Math.exp(-dt/responseTime));
  }
  lastPosition={x:position.x,z:position.z};
  forward.set(0,0,1).applyQuaternion(q.copy(rotation));forward.addScaledVector(up,-forward.dot(up)).normalize();
  right.crossVectors(up,forward).normalize();forward.crossVectors(right,up).normalize();
  q.setFromRotationMatrix(basis.makeBasis(right,up,forward));
  if(!locked)transitions++;
  body.setEnabledRotations(false,true,false,true);locked=true;body.setRotation(q,true);
  body.setAngvel({x:0,y:body.angvel().y,z:0},true);
  const target=ground+restHeight/up.y,error=position.y-target,relative=beforeVelocity.y-roadRate;
  const decay=Math.exp(-frequency*dt),nextRelative=(relative-frequency*(relative+frequency*error)*dt)*decay;
  const desired=roadRate+nextRelative+9.81*dt;
  const correction=clamp(desired-beforeVelocity.y,-maxAcceleration*dt,maxAcceleration*dt);
  // One vertical owner: replace the wheel controller's vertical contribution
  // with a bounded aggregate support impulse; keep its XZ impulses unchanged.
  body.applyImpulse({x:0,y:body.mass()*(beforeVelocity.y+correction-velocity.y),z:0},true);
  telemetry={locked,contacts:points.length,reason:'supported',transitions,ground:plane.height,planeResidual:plane.residual,uneven,filteredGround:ground,target,error,roadRate,supportAcceleration:correction/dt,beforeVertical:beforeVelocity.y,wheelVertical:velocity.y,commandVertical:beforeVelocity.y+correction,controlledVertical:body.linvel().y,normal:{x:up.x,y:up.y,z:up.z}};
  return true;
 }};
}
