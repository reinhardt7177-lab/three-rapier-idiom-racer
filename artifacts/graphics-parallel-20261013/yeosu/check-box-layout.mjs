import fs from 'node:fs';
const b=fs.readFileSync(new URL('../../../public/assets/rebuild/yeosu.glb',import.meta.url));
const j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString()),binaryStart=20+b.readUInt32LE(12)+8;
let meshes=0,boxes=0,failures=0;
for(const mesh of j.meshes)for(const primitive of mesh.primitives){
 if(!['Pink','Cyan','Window'].includes(j.materials[primitive.material].name))continue;
 const a=j.accessors[primitive.indices],v=j.bufferViews[a.bufferView],offset=binaryStart+(v.byteOffset??0)+(a.byteOffset??0),size={5121:1,5123:2,5125:4}[a.componentType];
 const read=i=>size===4?b.readUInt32LE(offset+i*size):size===2?b.readUInt16LE(offset+i*size):b.readUInt8(offset+i*size);
 let ok=a.count%36===0;
 for(let start=0;ok&&start<a.count;start+=36){const base=Math.floor(read(start)/24)*24;for(let k=1;k<36;k++)if(Math.floor(read(start+k)/24)*24!==base){ok=false;break;}}
 meshes++;boxes+=a.count/36;if(!ok)failures++;
}
console.log({meshes,boxes,failures});
