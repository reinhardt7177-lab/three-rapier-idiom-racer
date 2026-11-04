import * as THREE from 'three';
import {createNightSky} from './koreaPresentation.js';

export const NIGHT_LIGHTING=Object.freeze({ambient:.62,sun:.24,exposure:1.02,environment:.55,fogNear:900,fogFar:2500});
export const NIGHT_ATMOSPHERE=Object.freeze({fog:'#09182d',turbidity:2.4,rayleigh:2.2,mieCoefficient:.003});

// Fixed six-light budget: four nearby road lamps and two player headlights.
// No shadow maps or reflection render pass; bridge emission comes from Blender.
export function createNightPresentation(scene,route){
 const group=new THREE.Group();group.name='Night_Road_Lights';group.visible=false;scene.add(group);
 const sky=createNightSky();group.add(sky);
 const lamps=Array.from({length:4},()=>{const light=new THREE.PointLight('#c6dcff',120,46,2);group.add(light);return light;});
 const heads=Array.from({length:2},()=>{const light=new THREE.SpotLight('#d5eaff',180,90,.40,.6,1.6);group.add(light,light.target);return light;});
 const forward=new THREE.Vector3(),offset=new THREE.Vector3(),beamDrop=new THREE.Vector3(0,-1.8,0);
 return {stats:{lights:6,shadowMaps:0,reflectionPasses:0,skyDraws:1,skyTriangles:sky.geometry.index.count/3},update(state,index,visible,cameraPosition){
  group.visible=visible;if(!visible||!state)return;
  sky.position.copy(cameraPosition??state.position);
  for(let i=0;i<lamps.length;i++){
   const p=route.points[(Math.floor(index/30)*30+(i<2?0:30))%route.points.length],side=i%2?1:-1;
   lamps[i].position.set(p.x+p.dz*side*13.5,p.y+5.8,p.z-p.dx*side*13.5);
  }
  forward.set(0,0,1).applyQuaternion(state.rotation);
  for(let i=0;i<heads.length;i++){
   offset.set(i===0?-.68:.68,-.12,1.95).applyQuaternion(state.rotation);
   heads[i].position.copy(state.position).add(offset);
   heads[i].target.position.copy(heads[i].position).addScaledVector(forward,35).add(beamDrop);
  }
 },dispose(){group.removeFromParent();sky.geometry.dispose();sky.material.dispose();for(const light of [...lamps,...heads])light.dispose();}};
}
