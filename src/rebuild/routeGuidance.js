const cache=new WeakMap();
const lookupCache=new WeakMap();
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const forward=(a,b,length)=>(b-a+length)%length;

// Explicit screen-space paths avoid a negative SVG transform/compositing layer.
export function routeArrowPath(direction){
  return direction==='left'?'M30 32V16Q30 8 22 8H8M16 1L8 8L16 15':
    direction==='right'?'M10 32V16Q10 8 18 8H32M24 1L32 8L24 15':'M20 32V4M10 14L20 4L30 14';
}

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
    // With +Y up and a driver looking along +Z, +X lies to screen-left.
    // An increasing atan2(dx,dz) is therefore a LEFT turn, not a right turn.
    return Math.abs(angle)<.06?null:{direction:angle>0?'left':'right',sharp:Math.abs(angle)>.38};
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

// Static route data is indexed once. Both arrays include seam-wrapping without
// treating successive samples of one sustained bend as separate corners.
function cornerLookup(route){
  if(lookupCache.has(route))return lookupCache.get(route);
  const flags=routeBends(route),n=flags.length,upcoming=new Int32Array(n),following=new Int32Array(n);
  upcoming.fill(-1);following.fill(-1);let next=-1,nextStart=-1;
  for(let i=2*n-1;i>=0;i--){
    const j=i%n;
    if(flags[j])next=j;
    if(i<n){upcoming[j]=next;following[j]=nextStart;}
    if(flags[j]&&flags[(j-1+n)%n]?.direction!==flags[j].direction)nextStart=j;
  }
  const value={flags,upcoming,following};lookupCache.set(route,value);return value;
}

// total: whole race distance (route length × laps); speed only affects the HUD.
export function routeGuidance(route,index,progress=0,total=route.length,{speedKmh=0}={}){
  const remaining=Math.max(0,Math.min(total,total-progress));
  // In the final 50m, prioritise the finish over an ongoing gentle bend.
  if(remaining<=50)return {direction:'finish',distance:Math.ceil(remaining),remaining,sharp:false,next:null,urgent:false};
  const {flags,upcoming,following}=cornerLookup(route),p=route.points,origin=p[index].distance;
  const speed=Number.isFinite(speedKmh)?Math.max(0,speedKmh)/3.6:0;
  const horizon=Math.min(420,Math.max(250,speed*4.5),remaining),i=upcoming[index];
  if(i!==-1){
    const distance=forward(origin,p[i].distance,route.length);
    if(distance<=horizon){
      let next=null;const j=following[i];
      if(j!==-1){const ahead=forward(origin,p[j].distance,route.length);
        if(ahead>distance&&ahead<=horizon)next={...flags[j],distance:Math.max(5,Math.round(ahead/5)*5)};
      }
      return {...flags[i],distance:distance<3?0:Math.max(5,Math.round(distance/5)*5),remaining,next,
        urgent:flags[i].sharp&&distance<=Math.max(120,speed*2.5)};
    }
  }
  return {direction:remaining<=250?'finish':'straight',distance:Math.round(horizon/5)*5,remaining,sharp:false,next:null,urgent:false};
}
