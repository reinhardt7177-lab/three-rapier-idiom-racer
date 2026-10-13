import * as THREE from 'three';
import {YEOSU_VISUAL_LAYOUT} from './yeosuVisualLayout.js';

export const YEOSU_VISUAL_BUDGETS=Object.freeze({
 high:Object.freeze({reflections:12,roadHalos:96,bridgeHalos:8,distance:1500}),
 medium:Object.freeze({reflections:8,roadHalos:48,bridgeHalos:8,distance:800}),
 low:Object.freeze({reflections:4,roadHalos:0,bridgeHalos:8,distance:180}),
});
const WATER_SOURCE_LIMIT=12;
const colour={Pink:new THREE.Color('#f75dcc'),Cyan:new THREE.Color('#44caff'),Window:new THREE.Color('#ffd29a')};

function authoredBoxes(mesh){
 const position=mesh.geometry.getAttribute('position'),index=mesh.geometry.index;
 if(!index||index.count%36||position.count%24)return null;
 const indices=index.array;
 // Most Blender props use 24 flat-normal vertices / 36 indices per box.
 // Validate every block before the fast path; unusual/merged topology falls
 // back to connected surfaces below, without guessing light positions.
 for(let i=0;i<indices.length;i+=36){const base=Math.floor(indices[i]/24)*24;for(let k=1;k<36;k++)if(Math.floor(indices[i+k]/24)*24!==base)return null;}
 const boxes=[],seen=new Set(),point=new THREE.Vector3();
 for(let i=0;i<indices.length;i+=36){const base=Math.floor(indices[i]/24)*24;if(seen.has(base))continue;seen.add(base);const box=new THREE.Box3();
  for(let k=0;k<24;k++){point.fromBufferAttribute(position,base+k).applyMatrix4(mesh.matrixWorld);box.expandByPoint(point);}boxes.push(box);
 }
 return boxes;
}

function connectedSurfaces(mesh){
 const fast=authoredBoxes(mesh);if(fast)return fast;
 const position=mesh.geometry.getAttribute('position'),index=mesh.geometry.index;
 const parent=[],coordinates=[],keys=new Map(),ids=new Uint32Array(position.count),point=new THREE.Vector3();
 function root(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
 function join(a,b){a=root(a);b=root(b);if(a!==b)parent[b]=a;}
 for(let i=0;i<position.count;i++){
  point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
  const key=`${Math.round(point.x*100)},${Math.round(point.y*100)},${Math.round(point.z*100)}`;
  let id=keys.get(key);
  if(id===undefined){id=parent.length;keys.set(key,id);parent.push(id);coordinates.push(point.clone());}ids[i]=id;
 }
 const count=index?.count??position.count;
 for(let i=0;i+2<count;i+=3){const a=ids[index?index.getX(i):i],b=ids[index?index.getX(i+1):i+1],c=ids[index?index.getX(i+2):i+2];join(a,b);join(a,c);}
 const boxes=new Map();
 for(let i=0;i<coordinates.length;i++){const id=root(i);let box=boxes.get(id);if(!box){box=new THREE.Box3();boxes.set(id,box);}box.expandByPoint(coordinates[i]);}
 return boxes.values();
}

// Blender batches props into material/cell meshes. Recover light locations
// from their connected surfaces, rather than inventing new landmark positions.
// This read-only construction work is never repeated in the render loop.
export function extractYeosuLightSources(world){
 const result={bridge:[],road:[],water:[]};
 world.updateMatrixWorld(true);
 world.traverse(mesh=>{
  if(!mesh.isMesh||Array.isArray(mesh.material)||!colour[mesh.material.name])return;
  const name=mesh.material.name,position=mesh.geometry.getAttribute('position');
  if(!position)return;
  for(const box of connectedSurfaces(mesh)){
   const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
   if(name!=='Window'&&size.y>20&&Math.max(size.x,size.z)<6){
    result.bridge.push({position:center.clone().add(new THREE.Vector3(0,size.y*.48,0)),colour:colour[name].clone(),size:5,kind:name});
    result.water.push({position:center,colour:colour[name].clone(),strength:1,kind:name});
   }else if(name==='Window'&&size.y>=.05&&size.y<.4&&Math.max(size.x,size.z)<4&&center.y>6){
    result.road.push({position:center,colour:colour.Window.clone(),size:.9,kind:'road'});
   }else if(name==='Window'&&size.y>.7&&size.y<3.5&&Math.max(size.x,size.z)<5&&center.y<13){
    result.water.push({position:center,colour:colour.Window.clone(),strength:.45,kind:'harbor'});
   }
  }
 });
 // One facade can contain dozens of nearby windows. Keep a few independently
 // visible shore sources, while retaining all bridge pylons for reflections.
 const cells=new Set();
 result.water=result.water.filter(light=>{
  if(light.kind!=='harbor')return true;
  const key=`${Math.floor(light.position.x/65)},${Math.floor(light.position.z/65)}`;
  if(cells.has(key))return false;cells.add(key);return true;
 });
 // Interleave cells so a reduced halo budget samples the whole route instead
 // of taking only the first exported Blender cell.
 const order=(a,b)=>Math.sin(a.position.x*.17+a.position.z*.31)-Math.sin(b.position.x*.17+b.position.z*.31);
 result.road.sort(order);result.bridge.sort((a,b)=>a.position.x-b.position.x||a.position.z-b.position.z);
 return result;
}

// Layout identity survives material/cell batching but changes when emitted
// geometry moves or its topology changes. The exact GLB SHA is also enforced
// by the asset-consistency test; a changed asset must regenerate the layout.
export function yeosuLayoutIdentity(world){
 world.updateMatrixWorld(true);
 const inverse=world.matrixWorld.clone().invert(),relative=new THREE.Matrix4(),identity={};
 world.traverse(mesh=>{
  if(!mesh.isMesh||Array.isArray(mesh.material)||!colour[mesh.material.name])return;
  const position=mesh.geometry.getAttribute('position'),index=mesh.geometry.index,count=index?.count??position.count;
  const entry=identity[mesh.material.name]??={triangleVertices:0,moments:[0,0,0,0,0,0]};
  entry.triangleVertices+=count;relative.multiplyMatrices(inverse,mesh.matrixWorld);
  const m=relative.elements,a=position.isInterleavedBufferAttribute?position.data.array:position.array,idx=index?.array;
  const stride=position.isInterleavedBufferAttribute?position.data.stride:position.itemSize,offset=position.isInterleavedBufferAttribute?position.offset:0;
  for(let k=0;k<count;k++){
   const i=(idx?idx[k]:k)*stride+offset,x=a[i],y=a[i+1],z=a[i+2];
   const qx=Math.round((m[0]*x+m[4]*y+m[8]*z+m[12])*10),qy=Math.round((m[1]*x+m[5]*y+m[9]*z+m[13])*10),qz=Math.round((m[2]*x+m[6]*y+m[10]*z+m[14])*10);
   entry.moments[0]+=qx;entry.moments[1]+=qy;entry.moments[2]+=qz;entry.moments[3]+=qx*qx;entry.moments[4]+=qy*qy;entry.moments[5]+=qz*qz;
  }
 });
 return Object.fromEntries(Object.entries(identity).sort(([a],[b])=>a.localeCompare(b)));
}

export function yeosuLightSources(world,route){
 const layout=YEOSU_VISUAL_LAYOUT;
 if(layout&&(!route?.revision||route.revision===layout.routeRevision)&&JSON.stringify(yeosuLayoutIdentity(world))===JSON.stringify(layout.identity)){
  const source=row=>({position:new THREE.Vector3(row[0],row[1],row[2]).applyMatrix4(world.matrixWorld),colour:colour[row[3]].clone(),kind:row[4],size:row[5],strength:row[6]});
  return {bridge:layout.bridge.map(source),road:layout.road.map(source),water:layout.water.map(source),layoutMode:'baked'};
 }
 return {...extractYeosuLightSources(world),layoutMode:'geometry-fallback'};
}

function createHalos(sources,name,material){
 if(!sources.length)return null;
 const plane=new THREE.PlaneGeometry(2,2),geometry=new THREE.InstancedBufferGeometry();
 geometry.setIndex(plane.index.clone());geometry.setAttribute('position',plane.getAttribute('position').clone());
 const anchors=new Float32Array(sources.length*3),colours=new Float32Array(sources.length*3),sizes=new Float32Array(sources.length);
 sources.forEach((source,i)=>{source.position.toArray(anchors,i*3);source.colour.toArray(colours,i*3);sizes[i]=source.size;});
 geometry.setAttribute('lightAnchor',new THREE.InstancedBufferAttribute(anchors,3));
 geometry.setAttribute('lightColour',new THREE.InstancedBufferAttribute(colours,3));
 geometry.setAttribute('lightSize',new THREE.InstancedBufferAttribute(sizes,1));
 geometry.instanceCount=sources.length;
 const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.frustumCulled=false;mesh.renderOrder=1;
 mesh.castShadow=mesh.receiveShadow=false;plane.dispose();return mesh;
}

function roadMask(route){
 const points=route?.points??[],cell=8;
 if(!points.length){const texture=new THREE.DataTexture(new Uint8Array(1),1,1,THREE.RedFormat);texture.needsUpdate=true;return {texture,bounds:new THREE.Vector4(0,0,1,1),bytes:1};}
 let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
 for(const p of points){minX=Math.min(minX,p.x);minZ=Math.min(minZ,p.z);maxX=Math.max(maxX,p.x);maxZ=Math.max(maxZ,p.z);}
 minX-=40;minZ-=40;maxX+=40;maxZ+=40;
 const width=Math.ceil((maxX-minX)/cell),height=Math.ceil((maxZ-minZ)/cell),data=new Uint8Array(width*height);
 for(const p of points){
  // This conservative visual-only mask also protects junctions and the road
  // edge between successive route points. It never substitutes collision data.
  const radius=(p.roadWidth??route.width??22)/2+cell;
  const x0=Math.max(0,Math.floor((p.x-radius-minX)/cell)),x1=Math.min(width-1,Math.floor((p.x+radius-minX)/cell));
  const z0=Math.max(0,Math.floor((p.z-radius-minZ)/cell)),z1=Math.min(height-1,Math.floor((p.z+radius-minZ)/cell));
  for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)data[z*width+x]=255;
 }
 const texture=new THREE.DataTexture(data,width,height,THREE.RedFormat);texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
 return {texture,bounds:new THREE.Vector4(minX,minZ,width*cell,height*cell),bytes:data.length};
}

const WATER_VERTEX=`
 varying vec3 waterPosition;
 #include <fog_pars_vertex>
 void main(){vec4 worldPosition=modelMatrix*vec4(position,1.0);waterPosition=worldPosition.xyz;
  vec4 mvPosition=viewMatrix*worldPosition;gl_Position=projectionMatrix*mvPosition;
  #include <fog_vertex>
 }`;
const WATER_FRAGMENT=`
 uniform vec3 deepColour;uniform vec3 horizonColour;uniform float visualTime;
 uniform sampler2D roadMask;uniform vec4 roadBounds;
 uniform vec3 sourcePosition[12];uniform vec3 sourceColour[12];uniform float sourceStrength[12];uniform int sourceCount;
 varying vec3 waterPosition;
 #include <common>
 #include <fog_pars_fragment>
 void main(){
  vec3 sight=normalize(cameraPosition-waterPosition);
  float grazing=pow(1.0-clamp(abs(sight.y),0.0,1.0),2.5);
  float wave=sin(waterPosition.x*.12+waterPosition.z*.08+visualTime*.6)*sin(waterPosition.z*.17-visualTime*.4);
  vec3 colour=mix(deepColour,horizonColour,.15+grazing*.48)+(wave*.009)*vec3(.1,.35,.7);
  vec2 roadUv=(waterPosition.xz-roadBounds.xy)/roadBounds.zw;
  float inBounds=step(0.0,roadUv.x)*step(0.0,roadUv.y)*step(roadUv.x,1.0)*step(roadUv.y,1.0);
  float reflectionAllowed=1.0-texture2D(roadMask,clamp(roadUv,0.0,1.0)).r*inBounds;
  for(int i=0;i<12;i++){
   if(i>=sourceCount)break;
   vec2 toward=cameraPosition.xz-sourcePosition[i].xz;float reach=clamp(length(toward),25.0,230.0);
   vec2 axis=normalize(toward+vec2(.0001));vec2 delta=waterPosition.xz-sourcePosition[i].xz;
   float along=dot(delta,axis),side=dot(delta,vec2(-axis.y,axis.x));
   float width=2.2+max(along,0.0)*.035;
   float streak=exp(-side*side/(width*width))*exp(-max(along,0.0)/reach*2.0)*step(-2.0,along);
   float ripples=pow(.5+.5*sin(along*2.2+wave*1.8+visualTime*.85+float(i)*.8),5.0);
   colour+=sourceColour[i]*sourceStrength[i]*streak*(.08+.62*ripples)*(.35+grazing*.65)*reflectionAllowed;
  }
  gl_FragColor=vec4(max(colour,vec3(0.0)),1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
 }`;

// Analytic light streaks are an artistic approximation, not screen-space or
// ray-traced reflections. They reuse the main scene pass and the authored sea.
// Physics, source vertices/materials/transforms and night-light budget stay intact.
export function createYeosuVisuals(scene,world,route,{quality='high'}={}){
 const group=new THREE.Group();group.name='Yeosu_Visuals';group.visible=false;scene.add(group);
 const sources=yeosuLightSources(world,route),waters=[],resources=[],corridor=roadMask(route);
 resources.push(corridor.texture);
 const haloMaterial=new THREE.ShaderMaterial({transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,
  uniforms:{distanceLimit:{value:1500}},
  vertexShader:`attribute vec3 lightAnchor;attribute vec3 lightColour;attribute float lightSize;varying vec2 haloUv;varying vec3 haloColour;varying float haloFade;uniform float distanceLimit;
   void main(){vec4 mvPosition=viewMatrix*vec4(lightAnchor,1.0);mvPosition.xy+=position.xy*lightSize;gl_Position=projectionMatrix*mvPosition;
    haloUv=position.xy;haloColour=lightColour;haloFade=1.0-smoothstep(distanceLimit*.7,distanceLimit,length(cameraPosition-lightAnchor));}`,
  fragmentShader:`varying vec2 haloUv;varying vec3 haloColour;varying float haloFade;
   void main(){float radius=length(haloUv);float glow=exp(-radius*radius*5.5)*(1.0-smoothstep(.72,1.0,radius))*haloFade;
    gl_FragColor=vec4(haloColour,.22*glow);#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
 resources.push(haloMaterial);
 const bridgeHalos=createHalos(sources.bridge,'Yeosu_Bridge_Halos',haloMaterial),roadHalos=createHalos(sources.road,'Yeosu_Road_Halos',haloMaterial);
 for(const mesh of [bridgeHalos,roadHalos])if(mesh){group.add(mesh);resources.push(mesh.geometry);}
 const waterMaterial=new THREE.ShaderMaterial({name:'Yeosu_Analytic_Sea',toneMapped:false,fog:true,depthWrite:true,
  uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),roadMask:{value:corridor.texture},roadBounds:{value:corridor.bounds},deepColour:{value:new THREE.Color('#031329')},horizonColour:{value:new THREE.Color('#0a3158')},visualTime:{value:0},sourceCount:{value:0},
   sourcePosition:{value:Array.from({length:WATER_SOURCE_LIMIT},()=>new THREE.Vector3())},sourceColour:{value:Array.from({length:WATER_SOURCE_LIMIT},()=>new THREE.Color())},sourceStrength:{value:new Float32Array(WATER_SOURCE_LIMIT)}},
  vertexShader:WATER_VERTEX,fragmentShader:WATER_FRAGMENT});
 resources.push(waterMaterial);
 world.traverse(mesh=>{
  if(!mesh.isMesh||Array.isArray(mesh.material)||mesh.material.name!=='Water')return;
  const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),position=geometry.getAttribute('position');
  for(let i=0;i<position.count;i++)position.setY(i,position.getY(i)+.08);
  geometry.computeBoundingSphere();
  const water=new THREE.Mesh(geometry,waterMaterial);water.name='Yeosu_Sea_Ripples';water.castShadow=water.receiveShadow=false;
  group.add(water);waters.push({source:mesh,water,visible:mesh.visible});resources.push(geometry);
 });
 let disposed=false,mode='high',clock=0,lastSelection=-Infinity;
 const nearest=[];
 const stats={lights:0,shadowMaps:0,reflectionPasses:0,skyDraws:0,seaReplacements:waters.length,sourceLights:sources.water.length,
  reflectionSources:0,addedDraws:0,addedTriangles:0,haloInstances:0,quality:mode,waterShaderSources:WATER_SOURCE_LIMIT,roadMaskBytes:corridor.bytes,layoutMode:sources.layoutMode};
 function setQuality(value){
  mode=typeof value==='string'?value:value?.id;mode=YEOSU_VISUAL_BUDGETS[mode]?mode:'high';
  const budget=YEOSU_VISUAL_BUDGETS[mode];
  haloMaterial.uniforms.distanceLimit.value=budget.distance;
  for(const [mesh,limit] of [[bridgeHalos,budget.bridgeHalos],[roadHalos,budget.roadHalos]])if(mesh){mesh.geometry.instanceCount=Math.min(limit,mesh.geometry.getAttribute('lightAnchor').count);mesh.visible=mesh.geometry.instanceCount>0;}
  stats.quality=mode;stats.reflectionSources=Math.min(sources.water.length,budget.reflections);stats.haloInstances=(bridgeHalos?.geometry.instanceCount??0)+(roadHalos?.geometry.instanceCount??0);
  stats.addedDraws=Number(!!bridgeHalos?.visible)+Number(!!roadHalos?.visible);stats.addedTriangles=stats.haloInstances*2;
  waterMaterial.uniforms.sourceCount.value=Math.min(waterMaterial.uniforms.sourceCount.value,stats.reflectionSources);
  // A replacement adds zero draw calls/triangles relative to the authored sea.
  stats.seaTriangles=waters.reduce((n,{water})=>n+(water.geometry.index?.count??water.geometry.getAttribute('position').count)/3,0);
  lastSelection=-Infinity;
 }
 setQuality(quality);
 return {stats,setQuality,update(camera,dt,elapsed,visible=true){
  if(disposed)return;
  const showing=!!visible;group.visible=showing;
  for(const water of waters)water.source.visible=showing?false:water.visible;
  if(!showing)return;
  clock=Number.isFinite(elapsed)?elapsed:clock+Math.max(0,Number.isFinite(dt)?dt:0);
  waterMaterial.uniforms.visualTime.value=clock;
  if(clock<lastSelection)lastSelection=-Infinity;
  if(!camera?.position||clock-lastSelection<.25)return;
  nearest.length=0;
  for(const source of sources.water){
   // Bridge light remains useful farther away than a window; source placement
   // itself always comes from the current Blender asset.
   const distance=camera.position.distanceToSquared(source.position)/(source.kind==='harbor'?1:2.5);
   if(distance>YEOSU_VISUAL_BUDGETS[mode].distance**2)continue;
   let i=0;while(i<nearest.length&&nearest[i].distance<=distance)i++;
   if(i<stats.reflectionSources){nearest.splice(i,0,{source,distance});if(nearest.length>stats.reflectionSources)nearest.pop();}
  }
  const uniform=waterMaterial.uniforms;
  uniform.sourceCount.value=nearest.length;
  for(let i=0;i<nearest.length;i++){const {source}=nearest[i];uniform.sourcePosition.value[i].copy(source.position);uniform.sourceColour.value[i].copy(source.colour);uniform.sourceStrength.value[i]=source.strength;}
  lastSelection=clock;
 },dispose(){
  if(disposed)return;disposed=true;
  for(const water of waters)water.source.visible=water.visible;
  group.removeFromParent();for(const resource of resources)resource.dispose();
 }};
}
