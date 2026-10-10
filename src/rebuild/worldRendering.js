import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

function eligible(o){
 if(o.isInstancedMesh||o.isSkinnedMesh||o.isReflector||o.children.length||Array.isArray(o.material)||o.material.transparent||!o.visible||!o.frustumCulled)return false;
 const g=o.geometry;
 if(o.userData.unity_collider||o.name.includes('Road_Asphalt')||Object.keys(g.morphAttributes).length||g.drawRange.start!==0||g.drawRange.count!==Infinity)return false;
 for(let p=o;p;p=p.parent)if(p.userData.dynamic||!p.visible)return false;
 return !!g.attributes.position&&!!g.attributes.normal;
}

function appearance(source,target){
 target.castShadow=source.castShadow;target.receiveShadow=source.receiveShadow;target.layers.mask=source.layers.mask;
 target.renderOrder=source.renderOrder;target.customDepthMaterial=source.customDepthMaterial;target.customDistanceMaterial=source.customDistanceMaterial;
}

function retireUnused(root,retired){
 root.traverse(o=>{if(o.geometry)retired.delete(o.geometry);});retired.forEach(g=>g.dispose());
}

// Forest exports contain whole-district trees in one geometry. Partition triangle
// ownership by cell without deleting/decimating anything or altering colliders.
function splitLargeScenery(root,meshes,inverse,cellSize,maxVertices,report){
 const retired=new Set(),center=new THREE.Vector3(),bounds=new THREE.Vector3();
 for(const o of meshes){
  if(!eligible(o)||/Terrain|Water/i.test(o.material.name))continue;
  const g=o.geometry,p=g.attributes.position,index=g.index,count=index?.count??p.count;
  if(count<15000)continue;
  const transform=new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld);if(transform.determinant()<=0)continue;
  g.computeBoundingBox();g.boundingBox.clone().applyMatrix4(transform).getSize(bounds);
  if(Math.max(bounds.x,bounds.z)<=cellSize)continue;
  const cells=new Map();
  for(let i=0;i<count;i+=3){
   const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;
   center.set((p.getX(a)+p.getX(b)+p.getX(c))/3,(p.getY(a)+p.getY(b)+p.getY(c))/3,(p.getZ(a)+p.getZ(b)+p.getZ(c))/3).applyMatrix4(transform);
   const key=`${Math.floor(center.x/cellSize)},${Math.floor(center.z/cellSize)}`;
   if(!cells.has(key))cells.set(key,[]);cells.get(key).push(a,b,c);
  }
  if(cells.size<2)continue;
  for(const [cell,triangles] of cells){
   let ids=[],mapping=new Map(),indices=[];
   const flush=()=>{
    if(!indices.length)return;
    const part=new THREE.BufferGeometry();
    for(const [name,a] of Object.entries(g.attributes)){
     const original=a.isInterleavedBufferAttribute?a.data.array:a.array,raw=new original.constructor(ids.length*a.itemSize);
     const stride=a.isInterleavedBufferAttribute?a.data.stride:a.itemSize,offset=a.isInterleavedBufferAttribute?a.offset:0;
     ids.forEach((id,i)=>{for(let k=0;k<a.itemSize;k++)raw[i*a.itemSize+k]=original[id*stride+offset+k];});
     const attribute=new THREE.BufferAttribute(raw,a.itemSize,a.normalized);attribute.gpuType=a.gpuType;part.setAttribute(name,attribute);
    }
    part.setIndex(indices);part.applyMatrix4(transform);part.computeBoundingBox();part.computeBoundingSphere();
    const mesh=new THREE.Mesh(part,o.material);appearance(o,mesh);mesh.name='Coastal_Scenery_Part';
    mesh.userData={sceneryCell:cell,sourceNames:[o.name]};root.add(mesh);mesh.updateMatrixWorld(true);
    report.partsCreated++;report.after++;ids=[];mapping=new Map();indices=[];
   };
   const append=id=>{if(!mapping.has(id)){mapping.set(id,ids.length);ids.push(id);}indices.push(mapping.get(id));};
   for(let i=0;i<triangles.length;i+=3){
    const a=triangles[i],b=triangles[i+1],c=triangles[i+2];
    const needed=Number(!mapping.has(a))+Number(b!==a&&!mapping.has(b))+Number(c!==a&&c!==b&&!mapping.has(c));
    if(ids.length+needed>maxVertices)flush();
    append(a);append(b);append(c);
   }
   flush();
  }
  report.splitObjects++;report.after--;o.removeFromParent();retired.add(g);
 }
 retireUnused(root,retired);
}

// Keep spatial culling: never turn the entire 6.84km coast into one big mesh.
// Preserve collision/spawn geometry and every attribute used by the material.
export function batchWorldScenery(root,{cellSize=128,maxVertices=60000}={}){
 const meshes=[],buckets=new Map(),inverse=new THREE.Matrix4();
 root.updateMatrixWorld(true);inverse.copy(root.matrixWorld).invert();
 root.traverse(o=>{if(o.isMesh)meshes.push(o);});
 const report={before:meshes.length,after:meshes.length,mergedObjects:0,batches:0,splitObjects:0,partsCreated:0,cellSize};
 splitLargeScenery(root,meshes,inverse,cellSize,maxVertices,report);
 meshes.length=0;root.traverse(o=>{if(o.isMesh)meshes.push(o);});
 for(const o of meshes){
  const g=o.geometry,m=o.material;
  if(!eligible(o)||g.attributes.position.count>maxVertices)continue;
  const transform=new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld);
  // A mirrored transform changes front-face winding. Leave it independently drawn.
  if(transform.determinant()<=0)continue;
  g.computeBoundingBox();const bounds=g.boundingBox.clone().applyMatrix4(transform),size=bounds.getSize(new THREE.Vector3());
  if(Math.max(size.x,size.y,size.z)>cellSize)continue;
  const center=bounds.getCenter(new THREE.Vector3());
  const attributes=Object.entries(g.attributes).sort(([a],[b])=>a.localeCompare(b)).map(([name,a])=>`${name}:${a.itemSize}:${a.normalized}:${(a.isInterleavedBufferAttribute?a.data.array:a.array).constructor.name}:${a.gpuType}`).join('|');
  const key=`${Math.floor(center.x/cellSize)},${Math.floor(center.z/cellSize)}:${m.uuid}:${o.castShadow}:${o.receiveShadow}:${o.layers.mask}:${o.renderOrder}:${o.customDepthMaterial?.uuid??''}:${o.customDistanceMaterial?.uuid??''}:${!!g.index}:${attributes}`;
  if(!buckets.has(key))buckets.set(key,[]);
  buckets.get(key).push({object:o,transform});
 }
 const retired=new Set();
 for(const objects of buckets.values()){
  // Cap each allocation; retain indices instead of expanding all triangles.
  let chunk=[],vertices=0;
  const flush=()=>{
   if(chunk.length<2){chunk=[];vertices=0;return;}
   const geometries=chunk.map(({object,transform})=>object.geometry.clone().applyMatrix4(transform));
   const merged=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
   if(merged){
    merged.computeBoundingBox();merged.computeBoundingSphere();
    const source=chunk[0].object,batch=new THREE.Mesh(merged,source.material);
    batch.name='Coastal_Scenery_Batch';appearance(source,batch);batch.userData.sceneryBatch=true;
    batch.userData.sourceNames=chunk.flatMap(({object})=>object.userData.sourceNames??[object.name]);
    root.add(batch);batch.updateMatrixWorld(true);
    for(const {object} of chunk){retired.add(object.geometry);object.removeFromParent();}
    report.batches++;report.mergedObjects+=chunk.length;report.after-=chunk.length-1;
   }
   chunk=[];vertices=0;
  };
  for(const entry of objects){const count=entry.object.geometry.attributes.position.count;if(vertices+count>maxVertices)flush();chunk.push(entry);vertices+=count;}
  flush();
 }
 // A geometry retained by a collider/road or another surviving mesh stays alive.
 retireUnused(root,retired);
 return report;
}

export function createFrameMetrics(capacity=240){
 const samples=[];let previous=null;
 return {reset(){samples.length=0;previous=null;},record(now,info){
  if(previous!==null&&now>previous){samples.push({ms:now-previous,calls:info.calls,triangles:info.triangles});if(samples.length>capacity)samples.shift();}
  previous=now;
 },snapshot(){
  if(!samples.length)return {samples:0};
  const times=samples.map(s=>s.ms).sort((a,b)=>a-b),mean=samples.reduce((n,s)=>n+s.ms,0)/samples.length;
  return {samples:samples.length,meanMs:mean,p95Ms:times[Math.ceil(times.length*.95)-1],maxMs:times.at(-1),over50Ms:samples.filter(s=>s.ms>50).length,calls:samples.at(-1).calls,triangles:samples.at(-1).triangles};
 }};
}
