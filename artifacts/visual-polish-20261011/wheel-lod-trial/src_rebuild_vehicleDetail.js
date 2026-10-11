import * as THREE from 'three';

// Screen-space LOD affects only raised tread accents. The continuous tyre,
// rim, brake and mechanical pivots remain authored geometry at every distance.
export function createVehicleDetail(root){
 root.updateMatrixWorld(true);
 const inverse=root.matrixWorld.clone().invert(),sphere=new THREE.Sphere(),point=new THREE.Vector3();
 const details=[];
 root.traverse(o=>{
  if(!o.isMesh||Array.isArray(o.material)||o.material.name!=='Tread grooves')return;
  o.geometry.computeBoundingSphere();
  const local=o.geometry.boundingSphere.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
  details.push({mesh:o,local,visible:o.visible,hidden:false,pixels:null,triangles:(o.geometry.index?.count??o.geometry.attributes.position.count)/3});
 });
 return {update(camera,height,{full=false}={}){
  root.updateWorldMatrix(true,false);camera.updateWorldMatrix(true,false);
  const focal=height*camera.projectionMatrix.elements[5]/2;
  for(const d of details){
   sphere.copy(d.local).applyMatrix4(root.matrixWorld);point.copy(sphere.center).applyMatrix4(camera.matrixWorldInverse);
   const nearest=-point.z-sphere.radius;
   // The nearest point is conservative: detail cannot disappear while any
   // part of this tyre is close to the camera. Hysteresis avoids edge flicker.
   const pixels=nearest>0?2*sphere.radius*focal/nearest:Infinity;
   d.pixels=Number.isFinite(pixels)?pixels:null;
   if(full||!Number.isFinite(pixels))d.hidden=false;
   else if(!d.hidden&&pixels<16)d.hidden=true;
   else if(d.hidden&&pixels>20)d.hidden=false;
   d.mesh.visible=d.visible&&!d.hidden;
  }
 },snapshot(){return {details:details.length,hidden:details.filter(d=>d.hidden&&d.visible).length,trianglesHidden:details.reduce((s,d)=>s+(d.hidden&&d.visible?d.triangles:0),0),pixels:details.map(d=>d.pixels)};},restore(){for(const d of details){d.hidden=false;d.mesh.visible=d.visible;}}};
}
