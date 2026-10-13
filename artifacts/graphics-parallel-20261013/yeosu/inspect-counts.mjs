import fs from 'node:fs';
const b=fs.readFileSync(new URL('../../../public/assets/rebuild/yeosu.glb',import.meta.url));
const json=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
const out={};
for(const mesh of json.meshes)for(const primitive of mesh.primitives){const name=json.materials[primitive.material].name;const target=out[name]??={meshes:0,vertices:0,indices:0};target.meshes++;target.vertices+=json.accessors[primitive.attributes.POSITION].count;target.indices+=json.accessors[primitive.indices]?.count??0;}
console.log(out);
