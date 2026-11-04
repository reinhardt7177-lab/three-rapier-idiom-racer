import {recoveredCollider} from './worldCollision.js';

// The visible Blender ribbons have no volume. Keep their exact path/height,
// but give both sides a sealed 45cm collision shell without adding GPU meshes.
export function createNamakBarriers(world,route){
 const colliders=[],n=route.points.length,offset=route.width/2+.85,thickness=.45;
 for(const side of [-1,1])for(let begin=0;begin<n;begin+=128){
  const count=Math.min(128,n-begin),vertices=[],indices=[];
  for(let k=0;k<=count;k++){
   const p=route.points[(begin+k)%n];
   for(const off of [side*offset-thickness/2,side*offset+thickness/2]){
    const x=p.x+p.dz*off,z=p.z-p.dx*off;
    vertices.push(x,0,z,x,.8,z);
   }
  }
  function face(ids,center){
   const p=i=>vertices.slice(i*3,i*3+3),a=p(ids[0]),b=p(ids[1]),c=p(ids[2]);
   const u=b.map((v,i)=>v-a[i]),v=c.map((x,i)=>x-a[i]);
   const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
   const middle=[0,1,2].map(axis=>ids.reduce((sum,i)=>sum+p(i)[axis],0)/4);
   if(normal.reduce((sum,x,i)=>sum+x*(middle[i]-center[i]),0)<0)ids=[...ids].reverse();
   indices.push(ids[0],ids[1],ids[2],ids[0],ids[2],ids[3]);
  }
  const center=k=>[0,1,2].map(axis=>Array.from({length:8},(_,j)=>vertices[(k*4+j)*3+axis]).reduce((a,b)=>a+b,0)/8);
  for(let k=0;k<count;k++){
   const a=k*4,b=a+4,c=center(k);
   for(const ids of [[a,a+2,b+2,b],[a+1,b+1,b+3,a+3],[a,b,b+1,a+1],[a+2,a+3,b+3,b+2]])face(ids,c);
  }
  face([0,1,3,2],center(0));
  const end=count*4;face([end,end+2,end+3,end+1],center(count-1));
  const collider=world.createCollider(recoveredCollider(new Float32Array(vertices),new Uint32Array(indices)).setFriction(.15).setRestitution(0));
  colliders.push({collider,name:`RaceBarrier_Solid_${side}_${begin}`});
 }
 return colliders;
}
