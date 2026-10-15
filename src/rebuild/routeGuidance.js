const cache=new WeakMap();
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const forward=(a,b,length)=>(b-a+length)%length;

// Derive bends from heading changes over metres, rather than export point count.
// The same route drives the HUD and the race; this never changes AI or physics.
export function routeBends(route){
  if(cache.has(route))return cache.get(route);
  const p=route.points,n=p.length;
  const flags=p.map((point,i)=>{
    let a=i,b=i;
    for(let k=1;k<n;k++){a=(i-k+n)%n;if(forward(p[a].distance,point.distance,route.length)>=15)break;}
    for(let k=1;k<n;k++){b=(i+k)%n;if(forward(point.distance,p[b].distance,route.length)>=15)break;}
    const span=Math.max(1,forward(p[a].distance,p[b].distance,route.length));
    const angle=wrap(Math.atan2(p[b].dx,p[b].dz)-Math.atan2(p[a].dx,p[a].dz))*30/span;
    return Math.abs(angle)<.06?null:{direction:angle>0?'right':'left',sharp:Math.abs(angle)>.38};
  });
  // Suppress isolated heading glitches. Join runs across the route seam.
  const visited=new Set();
  for(let i=0;i<n;i++){
    if(!flags[i]||visited.has(i))continue;
    const run=[i];visited.add(i);const direction=flags[i].direction;
    for(const step of [-1,1])for(let k=1;k<n;k++){
      const j=(i+step*k+n*n)%n;
      if(visited.has(j)||flags[j]?.direction!==direction)break;
      visited.add(j);step<0?run.unshift(j):run.push(j);
    }
    const distance=forward(p[run[0]].distance,p[run.at(-1)].distance,route.length);
    if(distance<10)run.forEach(j=>flags[j]=null);
    else {const sharp=run.some(j=>flags[j].sharp);run.forEach(j=>flags[j]={direction,sharp});}
  }
  cache.set(route,flags);return flags;
}

// total: whole race distance (route length × laps); the finish only appears near its end.
export function routeGuidance(route,index,progress=0,total=route.length){
  const remaining=Math.max(0,Math.min(total,total-progress));
  // In the final 50m, prioritise the finish over an ongoing gentle bend.
  if(remaining<=50)return {direction:'finish',distance:Math.ceil(remaining),remaining,sharp:false};
  const flags=routeBends(route),p=route.points,n=p.length,origin=p[index].distance;
  const horizon=Math.min(250,remaining);
  for(let k=0;k<n;k++){
    const i=(index+k)%n,distance=forward(origin,p[i].distance,route.length);
    if(distance>horizon)break;
    if(flags[i])return {...flags[i],distance:distance<3?0:Math.max(5,Math.round(distance/5)*5),remaining};
  }
  return {direction:remaining<=250?'finish':'straight',distance:Math.round(horizon/5)*5,remaining,sharp:false};
}
