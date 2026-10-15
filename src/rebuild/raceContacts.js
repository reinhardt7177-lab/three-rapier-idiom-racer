import RAPIER from '@dimforge/rapier3d-compat';
// Own exactly one queue for the shared world. No extra impulses or body teleports.
export function createRaceContacts(world){
 const queue=new RAPIER.EventQueue(true),cooldowns=new Map();let clock=0;
 function clear(){queue.clear();cooldowns.clear();clock=0;}
 function finish(cars,dt,onImpact=()=>{}){
  clock+=dt;const owners=new Map(cars.map(c=>[c.sim.body.handle,c]));
  for(const car of cars){car.impact??={count:0,intensity:0,deltaV:0,age:100};car.impact.age+=dt;car.impact.intensity*=Math.exp(-dt*8);}
  for(const [key,until] of cooldowns)if(until<clock)cooldowns.delete(key);
  queue.drainContactForceEvents(event=>{
   const a=world.getCollider(event.collider1()),b=world.getCollider(event.collider2());if(!a||!b)return;
   const ca=owners.get(a.parent()?.handle),cb=owners.get(b.parent()?.handle);if(!ca&&!cb)return;
   const impulse=event.totalForceMagnitude()*dt;
   const key=[a.parent()?.handle??`fixed-${a.handle}`,b.parent()?.handle??`fixed-${b.handle}`].map(String).sort().join(':');
   if(cooldowns.has(key))return;
   const deltaV=Math.max(ca?impulse/ca.sim.body.mass():0,cb?impulse/cb.sim.body.mass():0);
   // Static support and gentle touches are not crash effects.
   if(deltaV<.6)return;
   let point=null;world.contactPair(a,b,manifold=>{if(!point&&manifold.numSolverContacts())point={...manifold.solverContactPoint(0)};});
   const hit={deltaV,intensity:Math.min(1,deltaV/7),point,normal:{...event.maxForceDirection()},otherVehicle:!!(ca&&cb)};
   cooldowns.set(key,clock+.16);
   for(const car of new Set([ca,cb].filter(Boolean))){car.impact={...hit,count:car.impact.count+1,age:0};onImpact(car,hit);}
  });
 }
 return {queue,finish,clear,dispose:()=>queue.free()};
}
