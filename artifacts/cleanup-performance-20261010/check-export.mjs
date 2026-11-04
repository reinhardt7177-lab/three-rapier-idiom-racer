import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {Vector3,Matrix3,Box3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const root=path.resolve(import.meta.dirname,'../..');
const read=(dir,id)=>fs.readFileSync(path.join(dir,`${id}.glb`));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const publicDir=path.join(root,'public/assets/rebuild'),smokeDir=path.join(import.meta.dirname,'export-smoke');
const results=[];
for(const id of ['supra','garage']){
 const a=read(publicDir,id),b=read(smokeDir,id),identical=hash(a)===hash(b);
 const result={id,identical};
 if(id==='supra'){assert.ok(identical,'independent vehicle exporter must preserve the existing GLB');result.renderEquivalent=true;}
 else{
  const load=async bytes=>(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'' )).scene;
  const scenes=await Promise.all([load(a),load(b)]);
  function data(scene){
   const triangles=[];scene.updateMatrixWorld(true);
   scene.traverse(obj=>{
    if(!obj.isMesh)return;
    const g=obj.geometry,p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,idx=g.index,normalMatrix=new Matrix3().getNormalMatrix(obj.matrixWorld);
    const m=obj.material,material=JSON.stringify([m.color?.toArray(),m.emissive?.toArray(),m.metalness,m.roughness,m.opacity,m.side,m.transparent]);
    for(let i=0;i<(idx?.count??p.count);i+=3){
     const vertices=[];
     for(let k=0;k<3;k++){
      const v=idx?idx.getX(i+k):i+k,pos=new Vector3().fromBufferAttribute(p,v).applyMatrix4(obj.matrixWorld),normal=new Vector3().fromBufferAttribute(n,v).applyNormalMatrix(normalMatrix);
      vertices.push([...pos.toArray(),...normal.toArray(),uv?.getX(v)??0,uv?.getY(v)??0].map(x=>x.toFixed(4)).join(','));
     }
     triangles.push(`${material}|${vertices.sort().join('|')}`);
    }
   });
   return triangles.sort();
  }
  const original=data(scenes[0]),exported=data(scenes[1]);
  result.originalTriangles=original.length;result.exportedTriangles=exported.length;
  result.renderEquivalent=original.length===exported.length&&original.every((v,i)=>v===exported[i]);
  result.bounds=scenes.map(s=>new Box3().setFromObject(s).getSize(new Vector3()).toArray());
  // Avoid a giant diagnostic dump of every triangle on failure.
  assert.ok(result.renderEquivalent,'garage export changed transformed vertices/normals/UVs/materials');
 }
 results.push(result);
}
fs.writeFileSync(path.join(import.meta.dirname,'export-roundtrip.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
