import RAPIER from '@dimforge/rapier3d-compat';

const guards=new WeakMap();
export function registerRideSupport(world,colliders,ride){
 let guardsForWorld=guards.get(world);
 if(!guardsForWorld){guardsForWorld={rides:new Map(),queue:null};guards.set(world,guardsForWorld);}
 for(const collider of colliders)guardsForWorld.rides.set(collider.handle,ride);
 return ()=>{
  for(const collider of colliders)guardsForWorld.rides.delete(collider.handle);
  if(!guardsForWorld.rides.size){guardsForWorld.queue?.free();guards.delete(world);}
 };
}

// Tyres/aggregate ride support own contact with the current supporting floor.
// The chassis still hits walls, other cars, roofs and any unsupported ground.
// Keeping both support and a full-width chassis-floor solver contact made road
// creases kick the body upward after the support controller had already run.
export function stepVehicleWorld(world,eventQueue){
 const registered=guards.get(world);
 if(!registered?.rides.size){world.step(eventQueue);return;}
 // Rapier 0.20 only forwards PhysicsHooks through its event-queue pipeline.
 // A private auto-draining queue also makes standalone simulations equivalent.
 const queue=eventQueue??(registered.queue??=new RAPIER.EventQueue(true));
 world.step(queue,{
  filterContactPair(a,b){
   if(registered.rides.get(a)?.supportsCollider(b)||registered.rides.get(b)?.supportsCollider(a))return null;
   return RAPIER.SolverFlags.COMPUTE_IMPULSE;
  },filterIntersectionPair:()=>true,
 });
}
