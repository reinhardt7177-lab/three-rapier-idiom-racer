import * as THREE from 'three';

export const NIGHT_LIGHTING=Object.freeze({ambient:.55,sun:.12,exposure:.88,environment:.34,fogNear:500,fogFar:1800});
export const NIGHT_ATMOSPHERE=Object.freeze({fog:'#09182d',turbidity:2.4,rayleigh:2.2,mieCoefficient:.003});

// Fixed six-light budget: four nearby road lamps and two player headlights.
// No shadow maps or reflection render pass; bridge emission comes from Blender.
export function createNightPresentation(scene,route){
 const group=new THREE.Group();group.name='Night_Road_Lights';group.visible=false;scene.add(group);
 const lamps=Array.from({length:4},()=>{const light=new THREE.PointLight('#b6dcff',55,46,2);group.add(light);return light;});
 const heads=Array.from({length:2},()=>{const light=new THREE.SpotLight('#d5eaff',34,70,.38,.6,1.6);group.add(light,light.target);return light;});
 const forward=new THREE.Vector3(),offset=new THREE.Vector3();
 return {stats:{lights:6,shadowMaps:0,reflectionPasses:0},update(state,index,visible){
  group.visible=visible;if(!visible||!state)return;
  for(let i=0;i<lamps.length;i++){
   const p=route.points[(Math.floor(index/30)*30+(i<2?0:30))%route.points.length],side=i%2?1:-1;
   lamps[i].position.set(p.x+p.dz*side*13.5,p.y+5.8,p.z-p.dx*side*13.5);
  }
  forward.set(0,0,1).applyQuaternion(state.rotation);
  for(let i=0;i<heads.length;i++){
   offset.set(i===0?-.68:.68,-.12,1.95).applyQuaternion(state.rotation);
   heads[i].position.copy(state.position).add(offset);
   heads[i].target.position.copy(heads[i].position).addScaledVector(forward,35).add(new THREE.Vector3(0,-1.8,0));
  }
 },dispose(){group.removeFromParent();for(const light of [...lamps,...heads])light.dispose();}};
}
