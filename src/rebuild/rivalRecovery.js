import {RACE_TUNING} from './vehicleDynamics.js';
import {VEHICLES} from './fleet.js';

const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
export const recoveryState=()=>({phase:'idle',stalled:0,elapsed:0,checkIn:0,cooldown:0,attempts:0});
export function recoveryGeometry(car){
  return {dimensions:RACE_TUNING[car.id]??RACE_TUNING.supra,spec:VEHICLES.find(v=>v.id===car.id)??VEHICLES[0]};
}
export function recoveryHeading(route,car){
  const q=car.state.rotation,p=route.points[car.index];
  const yaw=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.y*q.y+q.x*q.x));
  return {yaw,error:angle(yaw-Math.atan2(p.dx,p.dz))};
}

// A bicycle arc is a query envelope only. These samples are never written to a
// car. Rapier alone integrates the reverse pedal and the steering rack.
export function recoveryPath(car,steer,distance=2){
  const {spec}=recoveryGeometry(car),q=car.state.rotation;
  let yaw=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.y*q.y+q.x*q.x));
  let {x,y,z}=car.state.position;
  const count=Math.ceil(distance/.2),step=distance/count,curvature=Math.tan(-steer*Math.min(.52,car.state.steeringLimit??.52))/spec.wheelbase;
  const poses=[{x,y,z,yaw}];
  for(let i=0;i<count;i++){
    const next=yaw-step*curvature,mid=(yaw+next)/2;
    x-=step*Math.sin(mid);z-=step*Math.cos(mid);yaw=next;poses.push({x,y,z,yaw});
  }
  return poses;
}

const hold={targetKmh:0,throttle:0,reverse:0,brake:1,steer:0,waitingForTraffic:true};
export function updateRivalRecovery(state,{route,car,cars,dt,pathClear}){
  if(!(dt>0&&dt<=.1)||!pathClear||car.player||car.finish!=null)return null;
  const s=car.state,grounded=s.contacts>=3&&s.ride?.locked!==false;
  const groundSpeed=s.velocity?Math.hypot(s.velocity.x,s.velocity.z):s.kmh/3.6;
  state.cooldown=Math.max(0,state.cooldown-dt);
  if(state.phase==='idle'&&(!grounded||groundSpeed>=.55)){state.stalled=0;return null;}
  const {yaw,error}=recoveryHeading(route,car),fx=Math.sin(yaw),fz=Math.cos(yaw);
  let gap=Infinity;
  for(const c of cars){
    if(c===car||Math.abs(c.state.position.y-s.position.y)>=3)continue;
    const dx=c.state.position.x-s.position.x,dz=c.state.position.z-s.position.z;
    const along=dx*fx+dz*fz;
    if(along>0&&along<9&&Math.abs(dx*fz-dz*fx)<2.3&&c.state.kmh<3)gap=Math.min(gap,along);
  }
  const closeLead=gap<9;
  if(!grounded){state.stalled=0;return state.phase==='idle'?null:hold;}
  if(state.phase==='idle'){
    // Ordinary braking, a red light, and a moving queue do not trigger a
    // manoeuvre. Require sustained standstill plus a bad heading/short gap.
    state.stalled=groundSpeed<.55&&(Math.abs(error)>.6||closeLead)?state.stalled+dt:0;
    if(state.stalled<2.5||state.cooldown)return null;
    const options=Math.abs(error)>.6?[-Math.sign(error),0]:[0];
    const steer=options.find(value=>pathClear({car,cars,steer:value,distance:2}));
    if(steer===undefined)return null;
    Object.assign(state,{phase:'reverse',steer,start:{...s.position},elapsed:0,checkIn:0,attempts:state.attempts+1,queue:Math.abs(error)<=.6,backout:Math.max(3,Math.min(5,10-gap))});
  }
  state.elapsed+=dt;
  if(state.phase==='reverse'){
    const moved=Math.hypot(s.position.x-state.start.x,s.position.z-state.start.z);
    state.checkIn-=dt;
    if(state.checkIn<=0){state.checkIn=.1;state.clear=pathClear({car,cars,steer:state.steer,distance:2});}
    if(!state.clear||state.elapsed>=5||moved>=6||(state.queue?moved>=state.backout:Math.abs(error)<.45)){
      state.phase='braking';state.elapsed=0;
    }else return {targetKmh:7,throttle:0,reverse:groundSpeed<7/3.6?.45:0,brake:groundSpeed>8/3.6?.35:0,steer:state.steer,waitingForTraffic:true};
  }
  if(state.phase==='braking'){
    if(groundSpeed>.2)return hold;
    Object.assign(state,{phase:'idle',stalled:0,cooldown:2,rejoined:true});
    return hold;
  }
  return null;
}
