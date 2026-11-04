import RAPIER from '@dimforge/rapier3d-compat';
export function raceContactPoint(world,a,b,anchor){
 let point=null;world.contactPair(a,b,manifold=>{if(!point&&manifold.numSolverContacts())point={...manifold.solverContactPoint(0)};});
 if(point)return {point,pointSource:'solver'};
 // CCD can separate a pair before the queued force event is drained. Project
 // onto the actual other collider only after that genuine force event exists.
 const projected=b.projectPoint(anchor,false);
 return {point:projected?{...projected.point}:null,pointSource:'collider-projection'};
}
export function contactFeedback(deltaV,normal,relativeVelocity,otherVehicle=false){
 if(Math.abs(normal.y)>.6)return null;
 const normalSpeed=Math.abs(relativeVelocity.x*normal.x+relativeVelocity.z*normal.z);
 const tangent=Math.sqrt(Math.max(0,relativeVelocity.x**2+relativeVelocity.z**2-normalSpeed**2));
 const scrape=!otherVehicle&&deltaV<.6&&tangent>6;
 if(deltaV<.6&&!scrape)return null;
 return {kind:scrape?'scrape':'impact',intensity:scrape?Math.min(.4,tangent/80):Math.min(1,deltaV/7),tangentSpeed:tangent};
}
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
   const deltaV=Math.max(ca?impulse/ca.sim.body.mass():0,cb?impulse/cb.sim.body.mass():0);
   const va=ca?.state?.velocity??{x:0,z:0},vb=cb?.state?.velocity??{x:0,z:0};
   const velocity={x:va.x-vb.x,z:va.z-vb.z},normal={...event.maxForceDirection()};
   const feedback=contactFeedback(deltaV,normal,velocity,!!(ca&&cb));if(!feedback)return;
   const key=[a.parent()?.handle??`fixed-${a.handle}`,b.parent()?.handle??`fixed-${b.handle}`].map(String).sort().join(':')+':'+feedback.kind;
   if(cooldowns.has(key))return;
   const contact=ca?raceContactPoint(world,a,b,ca.sim.body.translation()):raceContactPoint(world,b,a,cb.sim.body.translation());
   const hit={deltaV,...feedback,...contact,normal,velocity,otherVehicle:!!(ca&&cb)};
   cooldowns.set(key,clock+.16);
   for(const car of new Set([ca,cb].filter(Boolean))){car.impact={...hit,count:car.impact.count+1,age:0};onImpact(car,hit);}
  });
 }
 return {queue,finish,clear,dispose:()=>queue.free()};
}
