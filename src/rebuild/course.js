const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const curveCache=new WeakMap();
export function curveSpeeds(route,profile=null){
  if(!curveCache.has(route))curveCache.set(route,new Map());
  const cache=curveCache.get(route);if(cache.has(profile))return cache.get(profile);
  const n=route.points.length;
  const speeds=route.points.map((p,i)=>{
    const a=route.points[(i-4+n)%n],b=route.points[(i+4)%n];
    let angle=Math.atan2(b.dx,b.dz)-Math.atan2(a.dx,a.dz);angle=Math.atan2(Math.sin(angle),Math.cos(angle));
    let distance=b.distance-a.distance;if(distance<0)distance+=route.length;
    const curvature=Math.abs(angle)/Math.max(1,distance);
    // Leave lateral grip in reserve for acceleration, slope and nearby traffic.
    const baseline=Math.sqrt(4.2/Math.max(.0001,curvature))*3.6;
    // Preserve the proven hairpin envelope; extra pace belongs on open bends.
    return clamp(profile&&baseline>=80?Math.sqrt((profile.lateralAcceleration??4.2)/Math.max(.0001,curvature))*3.6:baseline,28,profile?.maxSpeed??138);
  });
  cache.set(profile,speeds);return speeds;
}
export function nearestRoute(route,position,hint=null) {
  const points=route.points,n=points.length;
  let best={index:0,distance:Infinity};
  const visit=i=>{i=(i+n)%n;const p=points[i],d=Math.hypot(p.x-position.x,p.z-position.z);if(d<best.distance)best={index:i,distance:d};};
  if(hint===null)for(let i=0;i<n;i++)visit(i);
  else {for(let i=hint-65;i<=hint+65;i++)visit(i);if(best.distance>35)for(let i=0;i<n;i++)visit(i);}
  return {...best,point:points[best.index]};
}
export function routePose(route,index,lane=0) {
  const p=route.points[(index+route.points.length)%route.points.length];
  return {position:{x:p.x+p.dz*lane,y:p.y+1.3,z:p.z-p.dx*lane},yaw:Math.atan2(p.dx,p.dz)};
}
export function forwardProgress(previousDistance,nextDistance,length) {
  let delta=nextDistance-previousDistance;
  if(delta<-length/2)delta+=length;
  if(delta>length/2)delta-=length;
  // Recovery or a route branch must never award hundreds of metres of progress.
  return Math.abs(delta)>25?0:delta;
}
export function aiInput(route,state,index,lane,pace=1,traffic=[],options={}) {
  const points=route.points,n=points.length;
  const lookDistance=(options.lookAheadMinimum??12)+state.kmh/3.6*.55;
  let target=index,travel=0;
  while(travel<lookDistance){
    const a=points[target],b=points[(target+1)%n];travel+=Math.hypot(b.x-a.x,b.z-a.z);target=(target+1)%n;
    if(target===index)break;
  }
  const t=routePose(route,target,lane).position;
  if(options.preciseAim&&travel>lookDistance){
    const before=routePose(route,(target-1+n)%n,lane).position;
    const span=Math.hypot(t.x-before.x,t.z-before.z),alpha=1-(travel-lookDistance)/Math.max(.001,span);
    t.x=before.x+(t.x-before.x)*alpha;t.z=before.z+(t.z-before.z)*alpha;
  }
  const q=state.rotation,yaw=Math.atan2(2*(q.x*q.z+q.w*q.y),1-2*(q.x*q.x+q.y*q.y));
  let angle=Math.atan2(t.x-state.position.x,t.z-state.position.z)-yaw;
  angle=Math.atan2(Math.sin(angle),Math.cos(angle));
  const limits=curveSpeeds(route,options.speedProfile);
  let speed=Math.min((options.speedProfile?.maxSpeed??138)*pace,options.speedLimit??Infinity),probe=index,ahead=0;
  // Brake before the bend: suspension grip cannot repair a late 138 km/h turn.
  // Faster profiles look as far ahead as a full stop from the current speed.
  const v=state.kmh/3.6,horizon=Math.max(30+v*1.5,options.speedProfile?.fullBrakingHorizon?30+v*v/12:0);
  while(ahead<horizon){
    const limit=limits[probe]*pace;
    const safe=Math.sqrt((limit/3.6)**2+2*6*Math.max(0,ahead-12))*3.6;
    speed=Math.min(speed,safe);
    const next=(probe+1)%n;ahead+=Math.hypot(points[next].x-points[probe].x,points[next].z-points[probe].z);probe=next;
    if(probe===index)break;
  }
  if(Math.abs(angle)>.65)speed=Math.min(speed,42);
  const f={x:Math.sin(yaw),z:Math.cos(yaw)};
  let trafficLimited=false,hold=false;
  const followGap=Math.max(6,options.trafficGap??6);
  for(const other of traffic){
    if(Math.abs(other.position.y-state.position.y)>3)continue;
    const dx=other.position.x-state.position.x,dz=other.position.z-state.position.z;
    const along=dx*f.x+dz*f.z,lateral=Math.abs(dx*f.z-dz*f.x);
    const ownSpeed=Math.max(0,state.speed??state.kmh/3.6);
    const leadSpeed=Math.max(0,other.velocity?other.velocity.x*f.x+other.velocity.z*f.z:other.kmh/3.6);
    const closing=Math.max(0,ownSpeed-leadSpeed),lookAhead=Math.max(followGap+10,6+closing*.5+closing*closing/12);
    if(along>0&&along<lookAhead&&lateral<2.2){
      const gap=Math.max(0,along-followGap);
      // A moving lead cannot restore a short gap if we only match its speed.
      // Civilian-traffic planning opts into recovering the existing clearance.
      const followSpeed=Math.max(0,leadSpeed+(options.restoreFollowGap?along-followGap:gap)/.9);
      const safe=Math.min(Math.sqrt(leadSpeed*leadSpeed+12*gap),followSpeed)*3.6;
      if(safe<speed){speed=safe;trafficLimited=true;}
      if(along<=followGap+.2&&leadSpeed<.5){speed=0;hold=true;trafficLimited=true;}
    }
  }
  return {targetKmh:speed,steer:clamp(-angle*1.5/Math.max(.08,state.steeringLimit),-1,1),throttle:!hold&&state.kmh<speed?1:0,brake:hold||options.stop?1:state.kmh>speed+(trafficLimited?1:5)?.65:0,waitingForTraffic:(trafficLimited||options.waitingForTraffic)&&speed<8};
}
