import * as THREE from 'three';
import {polishVehicleMaterial} from './surfacePolish.js';

export const NAMAK_PARKING=Object.freeze([
  {id:'mustang',x:80,z:23,yaw:Math.PI/2},
  {id:'supra',x:315,z:23,yaw:Math.PI/2},
  {id:'mustang',x:922,z:205,yaw:0},
  {id:'supra',x:-122,z:340,yaw:Math.PI},
].map(Object.freeze));

export function outdoorLighting(namak=false){
  return namak?{ambient:.25,sun:2.2,exposure:.60,environment:.28,fogNear:900,fogFar:2400}
    :{ambient:.45,sun:2,exposure:.85,environment:.32,fogNear:800,fogFar:2600};
}

// Reuse authored car buffers. Dynamic marks keep shared geometry out of static
// scenery merging/disposal; these display cars never enter the physics world.
export function createNamakPresentation(world,cars){
  const parked=NAMAK_PARKING.map(p=>{
    const root=cars[p.id].clone(true);root.visible=true;root.name=`Namak_Parked_${p.id}_${p.x}`;
    root.userData={dynamic:true};root.updateMatrixWorld(true);
    const floor=new THREE.Box3().setFromObject(root).min.y;
    root.traverse(o=>{
      delete o.userData.unity_collider;
      if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])polishVehicleMaterial(m,{vivid:true});
    });
    root.position.set(p.x,.14-floor,p.z);root.rotation.y=p.yaw;world.add(root);return root;
  });
  return {stats:{parkedCars:parked.length,visibleParkedCars:0},update(camera,distance=160){
    let visible=0;
    for(const root of parked){root.visible=world.visible&&root.position.distanceToSquared(camera.position)<Math.min(160,distance)**2;if(root.visible)visible++;}
    this.stats.visibleParkedCars=visible;
  }};
}
