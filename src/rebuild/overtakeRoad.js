import RAPIER from '@dimforge/rapier3d-compat';

// Broad-phase queries use the recovered asphalt colliders, not a guessed width
// or visible grass. A vehicle-sized volume also rejects walls on the crossing.
export function createOvertakeRoadCheck(world,route,asphalt){
  return ({index,fromLane,toLane,state,dimensions})=>{
    if(!asphalt.size)return false;
    const points=route.points,n=points.length,horizon=Math.max(30,Math.max(0,state.kmh/3.6)*3+12);
    for(const distance of [0,10,horizon/2,horizon]){
      let i=index;
      for(let k=0;k<n;k++){
        if((points[i].distance-points[index].distance+route.length)%route.length>=distance)break;
        i=(i+1)%n;
      }
      const p=points[i],q={x:0,y:Math.sin(Math.atan2(p.dx,p.dz)/2),z:0,w:Math.cos(Math.atan2(p.dx,p.dz)/2)};
      for(const lane of [fromLane,(fromLane+toLane)/2,toLane]){
        let height=null;
        for(const offset of [0,-dimensions.collisionWidth/2-.25,dimensions.collisionWidth/2+.25]){
          const x=p.x+p.dz*(lane+offset),z=p.z-p.dx*(lane+offset);
          const hit=world.castRayAndGetNormal(new RAPIER.Ray({x,y:p.y+6,z},{x:0,y:-1,z:0}),12,true,RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC);
          if(!hit||!asphalt.has(hit.collider.handle)||hit.normal.y<.8||Math.abs(6-hit.timeOfImpact)>2)return false;
          if(offset===0)height=p.y+6-hit.timeOfImpact;
        }
        let blocked=false;
        world.intersectionsWithShape({x:p.x+p.dz*lane,y:height+.75,z:p.z-p.dx*lane},q,new RAPIER.Cuboid(dimensions.collisionWidth/2+.25,.25,dimensions.length/2+.4),()=>{blocked=true;return false;},RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC,undefined,undefined,undefined,c=>!asphalt.has(c.handle));
        if(blocked)return false;
      }
    }
    return true;
  };
}
