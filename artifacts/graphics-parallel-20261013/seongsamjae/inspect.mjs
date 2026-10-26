import fs from 'node:fs';
import crypto from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
const base=new URL('../../../',import.meta.url),out=new URL('./',import.meta.url);
const input=new URL('public/assets/rebuild/seongsamjae.glb',base);
const data=fs.readFileSync(input),gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
gltf.scene.updateMatrixWorld(true);
const materials=new Map(),meshes=[];
gltf.scene.traverse(o=>{if(!o.isMesh)return;const g=o.geometry,b=new THREE.Box3().setFromObject(o),ts=(g.index?.count??g.attributes.position.count)/3;
 meshes.push({name:o.name,triangles:ts,attributes:Object.keys(g.attributes),bounds:{min:b.min.toArray(),max:b.max.toArray()},collider:!!o.userData.unity_collider});
 for(const m of Array.isArray(o.material)?o.material:[o.material]){const old=materials.get(m.name)??{name:m.name,objects:0,triangles:0,color:m.color?.getHexString(),map:!!m.map,roughness:m.roughness,side:m.side};old.objects++;old.triangles+=ts;materials.set(m.name,old);}
});
const routeInput=new URL('public/assets/rebuild/seongsamjae-route.json',base),route=JSON.parse(fs.readFileSync(routeInput));
const record={at:new Date().toISOString(),glb:{bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex'),meshes:meshes.length,triangles:meshes.reduce((n,m)=>n+m.triangles,0)},materials:[...materials.values()],meshes,route:{points:route.points.length,width:route.width,length:route.length,minY:Math.min(...route.points.map(p=>p.y)),maxY:Math.max(...route.points.map(p=>p.y)),sha256:crypto.createHash('sha256').update(fs.readFileSync(routeInput)).digest('hex')}};
fs.writeFileSync(new URL('structure.json',out),JSON.stringify(record,null,2));
console.log(JSON.stringify({glb:record.glb,materials:record.materials,route:record.route},null,2));
