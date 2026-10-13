import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const repo=new URL('../../../',import.meta.url);
const bytes=fs.readFileSync(new URL('public/assets/rebuild/namak.glb',repo));
const scene=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
scene.scene.updateMatrixWorld(true);
const materials=new Map();let triangles=0,meshes=0,colliderMeshes=0;
scene.scene.traverse(o=>{
 if(!o.isMesh)return;meshes++;if(o.userData.unity_collider)colliderMeshes++;
 const tris=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;triangles+=tris;
 const b=new THREE.Box3().setFromObject(o),size=b.getSize(new THREE.Vector3());
 for(const m of Array.isArray(o.material)?o.material:[o.material]){
  if(!materials.has(m.name))materials.set(m.name,{name:m.name,meshes:0,triangles:0,color:'#'+m.color.getHexString(THREE.SRGBColorSpace),roughness:m.roughness,metalness:m.metalness,side:m.side,examples:[]});
  const entry=materials.get(m.name);entry.meshes++;entry.triangles+=tris;
  if(entry.examples.length<2)entry.examples.push({name:o.name,collider:!!o.userData.unity_collider,size:size.toArray(),bounds:[b.min.toArray(),b.max.toArray()]});
 }
});
const report={bytes:bytes.length,meshes,triangles,colliderMeshes,materials:[...materials.values()]};
fs.writeFileSync(new URL('./inventory.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({bytes:report.bytes,meshes,triangles,colliderMeshes,materials:report.materials.map(({name,meshes,triangles,color,roughness,side})=>({name,meshes,triangles,color,roughness,side}))},null,2));
