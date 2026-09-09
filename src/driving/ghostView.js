import { MeshBasicMaterial } from 'three';
import { applyWheelPose } from './steering.js';

// Shared player geometry, one unlit translucent material. No Rapier body,
// collider, lights, tire marks or audio are created for the recorded vehicle.
export function createGhostView(player,modelOffset) {
  const root=player.root.clone(true), pairs=new Map();
  const pair=(a,b)=>{pairs.set(a,b);a.children.forEach((child,i)=>pair(child,b.children[i]));};
  pair(player.root,root);
  const wheels=player.wheels.map(w=>({pivot:pairs.get(w.pivot),spin:pairs.get(w.spin)}));
  const material=new MeshBasicMaterial({color:'#60e1e5',transparent:true,opacity:.24,depthWrite:false});
  root.name='personal-record-ghost';root.visible=false;
  root.traverse(o=>{if(o.isMesh){o.material=material;o.castShadow=false;o.receiveShadow=false;}});
  return {root,update(pose,playerPosition,enabled){
    if(!pose||!enabled){root.visible=false;return false;}
    const p=pose.position,q=pose.rotation;
    const distance=Math.hypot(p.x-playerPosition.x,p.z-playerPosition.z);
    // Fade out near the player's body so a matching start never obscures it.
    material.opacity=.3*Math.max(0,Math.min(1,(distance-2)/4));
    root.visible=material.opacity>.01;
    root.position.set(p.x,p.y,p.z);root.quaternion.set(q.x,q.y,q.z,q.w);root.translateY(-modelOffset);
    applyWheelPose(wheels,pose.wheels,pose.wheels,1);
    return root.visible;
  }};
}
