import * as THREE from 'three';
export const GRAPHICS_QUALITIES=Object.freeze([
 Object.freeze({id:'high',label:'높음',pixelRatio:1.5,shadowSize:2048,shadows:true,decorationDistance:Infinity,ghost:true,rainParticles:220}),
 Object.freeze({id:'medium',label:'보통',pixelRatio:1.1,shadowSize:1024,shadows:true,decorationDistance:500,ghost:true,rainParticles:100}),
 Object.freeze({id:'low',label:'낮음',pixelRatio:.75,shadowSize:512,shadows:false,decorationDistance:140,ghost:false,rainParticles:36}),
]);
export const QUALITY_KEY='mumu.circuit.graphics.v1';
export const qualityById=id=>GRAPHICS_QUALITIES.find(q=>q.id===id)||GRAPHICS_QUALITIES[0];
export function loadQuality(storage){try{return qualityById(storage?.getItem(QUALITY_KEY)).id;}catch{return 'high';}}
export function saveQuality(storage,id){try{storage?.setItem(QUALITY_KEY,qualityById(id).id);return true;}catch{return false;}}

// Visibility only: preserve every geometry/collider and every road/terrain/
// barrier. Bounds intersecting the near area remain visible, not just centres.
export function createDecorationQuality(world){
 const entries=[];world.updateMatrixWorld(true);
 world.traverse(o=>{if(!o.isMesh||o.userData.unity_collider||o.userData.dynamic||/Road_Asphalt|Terrain|RaceBarrier|Water/.test(o.name))return;
  for(let p=o.parent;p&&p!==world;p=p.parent)if(p.userData.dynamic)return;
  o.geometry.computeBoundingSphere();const sphere=o.geometry.boundingSphere.clone().applyMatrix4(o.matrixWorld);entries.push({mesh:o,sphere,visible:o.visible});
 });
 let limit=Infinity,hidden=0;
 return {set(value){limit=value;},update(camera){hidden=0;for(const e of entries){const near=e.sphere.center.distanceTo(camera.position)-e.sphere.radius;e.mesh.visible=e.visible&&near<=limit;if(e.visible&&!e.mesh.visible)hidden++;}},status:()=>({objects:entries.length,hidden,distance:Number.isFinite(limit)?limit:null}),dispose(){for(const e of entries)e.mesh.visible=e.visible;}};
}
