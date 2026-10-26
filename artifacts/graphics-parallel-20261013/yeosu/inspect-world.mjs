import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const bytes=fs.readFileSync(new URL('../../../public/assets/rebuild/yeosu.glb',import.meta.url));
// This helper is inside artifacts/graphics-parallel-20261013/yeosu.
const data=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
data.scene.updateMatrixWorld(true);
const groups={};
data.scene.traverse(o=>{if(!o.isMesh)return;const kind=o.name.replace(/[_\.]\d+$/,'');(groups[kind]??=[]).push(o);});
const summary={bytes:bytes.length,counts:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.length]))};
const names=['돌산대교_TowerLight','거북선대교_TowerLight','MappedQuay','WarmHarborWindow','BridgeReflection'];
summary.anchors=Object.fromEntries(names.map(name=>[name,(groups[name]??[]).slice(0,name==='WarmHarborWindow'?8:12).map(o=>{const box=new THREE.Box3().setFromObject(o);return {name:o.name,center:box.getCenter(new THREE.Vector3()).toArray(),size:box.getSize(new THREE.Vector3()).toArray(),material:o.material.name};})]));
fs.writeFileSync(new URL('./world-inspection.json',import.meta.url),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
