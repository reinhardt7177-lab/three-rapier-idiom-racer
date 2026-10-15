// Where does the Namak racing line touch Terrain_Base instead of asphalt?
import fs from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {recoveredCollider} from '../../src/rebuild/worldCollision.js';
await RAPIER.init();
const world=new RAPIER.World({x:0,y:-9.81,z:0}),names=new Map();
const bin=fs.readFileSync(new URL('../namak-20261010/colliders.bin',import.meta.url)),manifest=JSON.parse(fs.readFileSync(new URL('../namak-20261010/colliders.json',import.meta.url)));
for(const part of manifest){const v=new Float32Array(part.vertices),ix=new Uint32Array(part.indices);for(let i=0;i<v.length;i++)v[i]=bin.readFloatLE(part.offset+i*4);for(let i=0;i<ix.length;i++)ix[i]=bin.readUInt32LE(part.offset+v.byteLength+i*4);names.set(world.createCollider(recoveredCollider(v,ix)).handle,part.name);}
world.step();
const route=JSON.parse(fs.readFileSync(new URL('../../public/assets/rebuild/namak-route.json',import.meta.url)));
const hits=[];
route.points.forEach((p,i)=>{for(const lane of [0,-2.2,2.2,-3.5,3.5]){const x=p.x+p.dz*lane,z=p.z-p.dx*lane;const h=world.castRay(new RAPIER.Ray({x,y:p.y+6,z},{x:0,y:-1,z:0}),20,true);const n=h?names.get(h.collider.handle):'none';if(!/Road_Asphalt/.test(n))hits.push({i,lane,d:Math.round(p.distance),n,toi:h&&+h.timeOfImpact.toFixed(2)});}});
console.log(hits);
