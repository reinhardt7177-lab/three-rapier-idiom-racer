import RAPIER from '@dimforge/rapier3d-compat';
import {recoveryGeometry,recoveryPath} from './rivalRecovery.js';

// A recovery needs proof at its actual position/yaw, unlike the normal
// route-offset overtaking proof. Check all four tyre supports and the full
// chassis arc; existing wall contact may only decrease, never deepen.
export function createRecoveryRoadCheck(world,asphalt){
  return ({car,cars,steer,distance})=>{
    if(!asphalt.size)return false;
    const {dimensions:a,spec}=recoveryGeometry(car),poses=recoveryPath(car,steer,distance);
    const shape=new RAPIER.Cuboid(a.collisionWidth/2+.05,.25,a.length/2+.05),initialDepth=new Map(),initialGap=new Map();
    for(let k=0;k<poses.length;k++){
      const p=poses[k],fx=Math.sin(p.yaw),fz=Math.cos(p.yaw),q={x:0,y:Math.sin(p.yaw/2),z:0,w:Math.cos(p.yaw/2)};
      let height=0;
      for(const side of [-1,1])for(const end of [-1,1]){
        const x=p.x+fz*side*(spec.track/2+.08)+fx*end*spec.wheelbase/2;
        const z=p.z-fx*side*(spec.track/2+.08)+fz*end*spec.wheelbase/2;
        const hit=world.castRayAndGetNormal(new RAPIER.Ray({x,y:p.y+3,z},{x:0,y:-1,z:0}),6,true,RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC);
        if(!hit||!asphalt.has(hit.collider.handle)||hit.normal.y<.8||Math.abs(hit.timeOfImpact-3.5)>1)return false;
        height+=p.y+3-hit.timeOfImpact;
      }
      const centre={x:p.x,y:height/4+.65,z:p.z};let blocked=false;
      world.intersectionsWithShape(centre,q,shape,c=>{
        const depth=Math.max(0,-(c.contactShape(shape,centre,q,0)?.distance??0));
        if(k===0)initialDepth.set(c.handle,depth);
        else if(depth>(initialDepth.get(c.handle)??0)+.005)blocked=true;
        return !blocked;
      },RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC,undefined,undefined,undefined,c=>!asphalt.has(c.handle));
      if(blocked)return false;
      // Other cars retain their real footprint and predicted velocity. Fast
      // rear traffic blocks reverse even when it is outside today's bumper gap.
      const time=k/(poses.length-1)*1.5;
      for(const other of cars){
        if(other===car||Math.abs(other.state.position.y-car.state.position.y)>3)continue;
        const b=recoveryGeometry(other).dimensions,os=other.state,oq=os.rotation;
        const oyaw=Math.atan2(2*(oq.w*oq.y+oq.x*oq.z),1-2*(oq.y*oq.y+oq.x*oq.x));
        const dx=os.position.x+(os.velocity?.x??0)*time-p.x,dz=os.position.z+(os.velocity?.z??0)*time-p.z;
        const along=Math.abs(dx*fx+dz*fz),side=Math.abs(dx*fz-dz*fx),relative=oyaw-p.yaw;
        const halfAlong=a.length/2+Math.abs(Math.cos(relative))*b.length/2+Math.abs(Math.sin(relative))*b.collisionWidth/2+.65;
        const halfSide=a.collisionWidth/2+Math.abs(Math.sin(relative))*b.length/2+Math.abs(Math.cos(relative))*b.collisionWidth/2+.35;
        const gap=Math.max(along-halfAlong,side-halfSide);
        if(k===0)initialGap.set(other,gap);
        // A collision may already have compressed the prediction buffer.
        // Leaving that buffer is safe; deepening it is not. Rejecting the
        // starting pose outright prevents both touching cars from backing out.
        if(gap<Math.min(0,initialGap.get(other)??0)-.005)return false;
      }
    }
    return true;
  };
}
