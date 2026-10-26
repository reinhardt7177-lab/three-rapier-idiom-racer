import * as THREE from 'three';

export const NAMAK_ARCHITECTURE_BUDGETS=Object.freeze({high:340,medium:200,low:0});
// This layer is already batched by district/material in Blender. It supplies
// no collision geometry and owns no resources outside the world asset.
export function createNamakArchitecture(world,quality='high'){
 const root=world.getObjectByName('Namak_Architecture'),entries=[];
 let distance=NAMAK_ARCHITECTURE_BUDGETS[typeof quality==='string'?quality:quality.id]??340;
 if(root){root.updateWorldMatrix(true,true);root.traverse(o=>{
  if(!o.isMesh)return;o.castShadow=false;o.receiveShadow=true;
  entries.push({mesh:o,sphere:new THREE.Box3().setFromObject(o).getBoundingSphere(new THREE.Sphere()),visible:o.visible});
 });}
 return {stats:{objects:entries.length,visible:0,distance},setQuality(q){distance=NAMAK_ARCHITECTURE_BUDGETS[typeof q==='string'?q:q.id]??340;this.stats.distance=distance;},
 update(camera,visible=true){
  let n=0;if(root)root.visible=Boolean(visible&&world.visible&&distance>0);
  for(const e of entries){e.mesh.visible=Boolean(root?.visible&&camera?.position&&camera.position.distanceTo(e.sphere.center)-e.sphere.radius<=distance);if(e.mesh.visible)n++;}
  this.stats.visible=n;
 },dispose(){if(root)root.visible=true;for(const e of entries)e.mesh.visible=e.visible;}
 };
}
