// Presentation events only: no physics writes, no peer-provided impulses.
const finite=(v,max=1e6)=>Number.isFinite(v)&&Math.abs(v)<=max;
const vector=(v,keys)=>v&&keys.every(k=>finite(v[k]));
// Direction is read from the real contact point in this car's frame. A shared
// manifold normal alone has opposite meanings for the two colliding cars.
export function impactDirectionForCar(hit,state){
 const p=hit?.point,q=state?.rotation,center=state?.position;
 if(!p||!q||!center)return {side:0,forward:0};
 const x=p.x-center.x,z=p.z-center.z,length=Math.hypot(x,z);
 if(!Number.isFinite(length)||length<1e-4)return {side:0,forward:0};
 const limit=v=>Number.isFinite(v)?Math.max(-1,Math.min(1,v)):0;
 return {side:limit((x*(1-2*(q.y*q.y+q.z*q.z))+z*2*(q.x*q.z-q.w*q.y))/length),forward:limit((x*2*(q.x*q.z+q.w*q.y)+z*(1-2*(q.x*q.x+q.y*q.y)))/length)};
}

export function validImpactState(hit){
 if(hit==null)return true; // Older peers may omit optional presentation data.
 if(!Number.isSafeInteger(hit.count)||hit.count<0||!finite(hit.age)||hit.age<0||!finite(hit.intensity,1)||hit.intensity<0||!finite(hit.deltaV,1000)||hit.deltaV<0)return false;
 if(hit.count===0)return hit.intensity===0;
 if(!['impact','scrape'].includes(hit.kind)||typeof hit.otherVehicle!=='boolean')return false;
 if(!vector(hit.normal,['x','y','z'])||!vector(hit.velocity,['x','z'])||hit.point!=null&&!vector(hit.point,['x','y','z']))return false;
 const normalLength=Math.hypot(hit.normal.x,hit.normal.y,hit.normal.z);
 return normalLength>.5&&normalLength<1.5;
}

export function createImpactPresentation(){
 let count=0,recovery=0;
 return {
  reset({recoveryCount=0}={}){count=0;recovery=recoveryCount;},
  consume(hit,{recoveryCount=0,active=true}={}){
   if(!validImpactState(hit)||!hit)return null;
   const recovered=Number.isSafeInteger(recoveryCount)&&recoveryCount>recovery;
   if(recovered){recovery=recoveryCount;count=0;}
   // A smaller counter alone is an old packet. A real recovery has its own
   // monotonic counter; a new race creates/resets this consumer explicitly.
   if(hit.count<=count)return null;
   count=hit.count;
   if(!active||hit.age>.25||hit.intensity<=0)return null;
   return {kind:hit.kind,intensity:hit.intensity,deltaV:hit.deltaV,age:hit.age,count:hit.count,otherVehicle:hit.otherVehicle,point:hit.point?{...hit.point}:null,normal:{...hit.normal},velocity:{x:hit.velocity.x,z:hit.velocity.z},pointSource:hit.pointSource};
  },
 };
}
