import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

export async function loadRoadscape(track){
  if(!track.roadscape)return null;
  const gltf=await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/rebuild/${track.roadscape}`);
  gltf.scene.name='Roadscape_Extension';
  gltf.scene.userData.visualOnly=true;
  gltf.scene.traverse(mesh=>{if(mesh.isMesh){mesh.castShadow=mesh.receiveShadow=false;}});
  return gltf.scene;
}

export const ROADSCAPE_QUALITY=Object.freeze({
  high:Object.freeze({distance:300,tier:3,foundationDistance:900}),
  medium:Object.freeze({distance:180,tier:2,foundationDistance:900}),
  low:Object.freeze({distance:0,tier:0,foundationDistance:200}),
});

// The Blender extension is visual only. Its owner retains all GPU resources;
// this controller owns visibility and restores it before scene disposal.
export function createRoadscape(root,{quality='high'}={}){
  if(!root)return null;
  const originalVisible=root.visible,entries=[];
  root.updateMatrixWorld(true);
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    mesh.geometry.computeBoundingSphere();
    let tier=mesh.userData.roadscapeTier??mesh.userData.qualityTier;
    for(let p=mesh.parent;p&&tier===undefined;p=p.parent)tier=p.userData.roadscapeTier??p.userData.qualityTier;
    entries.push({mesh,visible:mesh.visible,tier:Number(tier)||1,foundation:mesh.userData.roadscapeFoundation===true,
      sphere:mesh.geometry.boundingSphere.clone().applyMatrix4(mesh.matrixWorld),
      calls:Array.isArray(mesh.material)?Math.max(1,mesh.geometry.groups.length):1});
  });
  const foundations=entries.some(entry=>entry.foundation);
  const stats={meshes:entries.length,visible:0,calls:0,foundations:0,quality:null,distance:0};
  let budget,active=false,disposed=false;
  function setQuality(value){
    if(disposed)return;
    const id=typeof value==='string'?value:value?.id;
    budget=ROADSCAPE_QUALITY[id]||ROADSCAPE_QUALITY.high;
    stats.quality=ROADSCAPE_QUALITY[id]?id:'high';stats.distance=budget.distance;
    root.visible=originalVisible&&active&&(budget.tier>0||foundations);
    if(!root.visible){stats.visible=stats.calls=stats.foundations=0;}
  }
  function update(camera,_dt,_elapsed,racing=true){
    if(disposed)return;
    active=racing;root.visible=originalVisible&&active&&(budget.tier>0||foundations);
    stats.visible=stats.calls=stats.foundations=0;
    if(!root.visible)return;
    for(const entry of entries){
      entry.mesh.visible=entry.visible&&(entry.foundation||entry.tier<=budget.tier)&&
        entry.sphere.center.distanceTo(camera.position)-entry.sphere.radius<=(entry.foundation?budget.foundationDistance:budget.distance);
      if(entry.mesh.visible){stats.visible++;stats.calls+=entry.calls;if(entry.foundation)stats.foundations++;}
    }
  }
  setQuality(quality);
  return {stats,setQuality,update,dispose(){if(disposed)return;disposed=true;root.visible=originalVisible;for(const entry of entries)entry.mesh.visible=entry.visible;}};
}
