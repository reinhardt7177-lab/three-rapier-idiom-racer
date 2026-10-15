// Gameplay surfaces from the exported collider names. Grip multiplies tyre
// friction; drag is rolling resistance in m/s² when all four tyres are on it.
export const SURFACES=Object.freeze({
 asphalt:Object.freeze({grip:1,drag:0}),
 paved:Object.freeze({grip:.9,drag:.8}),
 grass:Object.freeze({grip:.62,drag:2.8}),
 solid:Object.freeze({grip:1,drag:0}),
});
export function surfaceKind(name=''){
 if(name.includes('Road_Asphalt'))return 'asphalt';
 if(name.includes('Terrain'))return 'grass';
 if(name.includes('Ground_'))return 'paved';
 return 'solid';
}

export function createSurfaceMap(){
 const kinds=new Map();
 return {
  add(handle,name){kinds.set(handle,surfaceKind(name));},
  kind:handle=>kinds.get(handle)??'solid',
  // A tyre on an unknown collider (another car's roof, a kerb object) is normal grip.
  surface:collider=>SURFACES[kinds.get(collider.handle)??'solid'],
  // Barriers, buildings and structures; never the ground a car drives on.
  isWall:handle=>kinds.get(handle)==='solid',
 };
}

// True while the chassis is actually pressed against a wall-like static
// collider. Ground contact and roof/bridge-deck tops are excluded by normal.
export function touchingWall(world,colliders,isWall){
 let touching=false;
 for(const collider of colliders){
  world.contactPairsWith(collider,other=>{
   if(touching||other.parent()||!isWall(other.handle))return;
   world.contactPair(collider,other,manifold=>{
    if(touching||Math.abs(manifold.normal().y)>.6)return;
    for(let i=0;i<manifold.numContacts();i++)if(manifold.contactDist(i)<.03){touching=true;return;}
   });
  });
  if(touching)break;
 }
 return touching;
}
