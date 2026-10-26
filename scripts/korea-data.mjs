import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url));
export function koreaData(id){
 const route=JSON.parse(read(`public/assets/rebuild/${id}-route.json`));
 const bin=read(`artifacts/korea-circuits-20261011/${id}/colliders.bin`),manifest=JSON.parse(read(`artifacts/korea-circuits-20261011/${id}/colliders.json`));
 const parts=manifest.map(p=>{
  const vertices=new Float32Array(p.vertices),indices=new Uint32Array(p.indices);
  for(let i=0;i<vertices.length;i++)vertices[i]=bin.readFloatLE(p.offset+i*4);
  for(let i=0;i<indices.length;i++)indices[i]=bin.readUInt32LE(p.offset+vertices.byteLength+i*4);
  return {name:p.name,vertices,indices};
 });
 return {route,track:{id,gridRowStep:6},parts};
}
