import * as THREE from 'three';

// Static image-based lighting, baked once by PMREM. Long softbox reflections
// reveal curved bodywork without adding any lights/draws to the racing scene.
export function createVehicleStudio(){
 const scene=new THREE.Scene();scene.name='Vehicle_Reflection_Studio';scene.background=new THREE.Color('#28313b');
 const geometry=new THREE.PlaneGeometry(),owned=new Set([geometry]);
 function panel(name,position,size,color,intensity,target=[0,1,0]){
  const material=new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide});material.color.multiplyScalar(intensity);owned.add(material);
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.fromArray(position);mesh.scale.set(size[0],size[1],1);mesh.lookAt(...target);scene.add(mesh);
 }
 panel('dark-ground',[0,-1,0],[50,50],'#111923',1);
 panel('left-softbox',[-6,4.5,0],[8,1.1],'#e8f0ff',3.2);
 panel('right-rim',[6,2.8,-1],[9,.7],'#d2e4ff',2.7);
 panel('ceiling-strip',[0,7,0],[2.1,11],'#f7f3eb',2.6);
 panel('rear-strip',[0,3,-7],[10,.7],'#b6d2f0',2.4);
 panel('front-bounce',[0,2,8],[9,4],'#7f8b95',.6);
 scene.dispose=()=>{for(const resource of owned)resource.dispose();owned.clear();};
 return scene;
}

// A dark ground hemisphere gives outdoor paint/window reflections a readable
// horizon. Only the small baking scene contains this plane; no new world mesh.
export function addVehicleReflectionGround(scene){
 const geometry=new THREE.PlaneGeometry(3000,3000),material=new THREE.MeshBasicMaterial({color:'#27313c'}),mesh=new THREE.Mesh(geometry,material);
 mesh.name='Vehicle_Reflection_Ground';mesh.rotation.x=-Math.PI/2;mesh.position.y=-2;scene.add(mesh);
 return ()=>{mesh.removeFromParent();geometry.dispose();material.dispose();};
}
