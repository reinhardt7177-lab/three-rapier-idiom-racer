// Which collider surface does each racing line actually sit on?
import fs from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {recoveredCollider} from '../../src/rebuild/worldCollision.js';
await RAPIER.init();
for(const [track,dir,routeFile] of [['coastal','unity-recovery','world-route.json'],['namak','namak-20261010','namak-route.json']]){
 const world=new RAPIER.World({x:0,y:-9.81,z:0}),names=new Map();
 const bin=fs.readFileSync(new URL(`../${dir}/colliders.bin`,import.meta.url)),manifest=JSON.parse(fs.readFileSync(new URL(`../${dir}/colliders.json`,import.meta.url)));
 for(const part of manifest){
  const v=new Float32Array(part.vertices),ix=new Uint32Array(part.indices);
  for(let i=0;i<v.length;i++)v[i]=bin.readFloatLE(part.offset+i*4);
  for(let i=0;i<ix.length;i++)ix[i]=bin.readUInt32LE(part.offset+v.byteLength+i*4);
  names.set(world.createCollider(recoveredCollider(v,ix)).handle,part.name);
 }
 world.step();
 const route=JSON.parse(fs.readFileSync(new URL(`../../public/assets/rebuild/${routeFile}`,import.meta.url)));
 for(const lane of [0,2.2,3.5,5,7]){
  const tally={};
  for(const p of route.points)for(const side of lane?[-1,1]:[1]){
   const x=p.x+p.dz*lane*side,z=p.z-p.dx*lane*side;
   const hit=world.castRay(new RAPIER.Ray({x,y:p.y+6,z},{x:0,y:-1,z:0}),20,true);
   const name=hit?names.get(hit.collider.handle).replace(/^[A-Za-z]+_(?=Road|Ground|Terrain|Building|Structure|Barrier)/,'').replace(/[-_\d]+/g,'_'):'none';
   tally[name]=(tally[name]||0)+1;
  }
  console.log(track,'lane',lane,Object.entries(tally).sort((a,b)=>b[1]-a[1]).slice(0,6));
 }
 world.free();
}
