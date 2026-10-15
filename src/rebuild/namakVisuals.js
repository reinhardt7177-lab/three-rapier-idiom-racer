import * as THREE from 'three';
import {createNamakArchitecture} from './namakArchitecture.js';

export const NAMAK_VISUAL_BUDGETS=Object.freeze({
 high:Object.freeze({distance:230,lobes:9,chunks:12,surfaceDetail:1}),
 medium:Object.freeze({distance:155,lobes:5,chunks:8,surfaceDetail:.65}),
 low:Object.freeze({distance:0,lobes:0,chunks:0,surfaceDetail:0}),
});

// Reference-derived materials, not sampled photo textures or a screen filter.
const FINISHES=Object.freeze({
 Paving:{color:'#b9b7af',roughness:.88,metalness:0,kind:'paving'},
 Concrete:{color:'#a8aba7',roughness:.89,metalness:0,kind:'concrete'},
 Namak_White:{color:'#d5d8d2',roughness:.82,metalness:0,kind:'facade'},
 Namak_Cream:{color:'#c9c1ae',roughness:.86,metalness:0,kind:'facade'},
 Namak_Beige:{color:'#a6aaa2',roughness:.86,metalness:0,kind:'facade'},
 Namak_Stone:{color:'#90968f',roughness:.88,metalness:0,kind:'facade'},
 Namak_Glass:{color:'#477d85',roughness:.21,metalness:.10,kind:'glass'},
 Namak_Window:{color:'#405563',roughness:.23,metalness:.08,kind:'glass'},
 Namak_Leaf:{color:'#466b43',roughness:.88,metalness:0,kind:'leaf'},
 Namak_LeafLight:{color:'#7a9356',roughness:.88,metalness:0,kind:'leaf'},
 Namak_Pine:{color:'#395e49',roughness:.91,metalness:0,kind:'leaf'},
 Grass:{color:'#6a8551',roughness:.97,metalness:0,kind:'ground'},
 Terrain:{color:'#71815c',roughness:.98,metalness:0,kind:'ground'},
});

const PAVING_OLD='vec2 tile=fract(surfacePosition.xz/0.6);float joint=1.0-smoothstep(.018,.045,min(min(tile.x,1.0-tile.x),min(tile.y,1.0-tile.y)));diffuseColor.rgb*=1.0-joint*.24;';
const PAVING_NEW=`if(namakCityDetail>0.0){
 // Wide granite slabs; derivatives fade sub-pixel joints rather than shimmer.
 vec2 namakSlab=surfacePosition.xz/vec2(.9,.6);
 vec2 namakSlabCell=fract(namakSlab);
 vec2 namakSlabAA=max(fwidth(namakSlab),vec2(.002));
 vec2 namakSlabEdge=min(namakSlabCell,1.0-namakSlabCell);
 float namakSlabLine=(1.0-smoothstep(.012,.012+max(namakSlabAA.x,namakSlabAA.y),min(namakSlabEdge.x,namakSlabEdge.y)));
 float namakSlabDistance=1.0-smoothstep(.12,.32,max(namakSlabAA.x,namakSlabAA.y));
 float namakSlabPigment=fract(sin(dot(floor(namakSlab),vec2(17.1,43.7)))*43758.54);
 diffuseColor.rgb*=1.0-namakSlabLine*namakSlabDistance*.18*namakCityDetail+(namakSlabPigment-.5)*.08*namakCityDetail;
}else{${PAVING_OLD}}`;

function surfaceFragment(kind){
 const coordinates='vec2 namakWall=abs(vNamakCityNormal.x)>abs(vNamakCityNormal.z)?vNamakCityPosition.zy:vNamakCityPosition.xy;';
 if(kind==='facade'||kind==='concrete')return `
  ${coordinates}
  vec2 namakPanel=namakWall/vec2(${kind==='facade'?'1.8,3.1':'3.0,.8'});
  vec2 namakPanelEdge=min(fract(namakPanel),1.0-fract(namakPanel));
  vec2 namakPanelAA=max(fwidth(namakPanel),vec2(.002));
  float namakPanelJoint=1.0-smoothstep(.006,.006+max(namakPanelAA.x,namakPanelAA.y),min(namakPanelEdge.x,namakPanelEdge.y));
  float namakPanelFade=1.0-smoothstep(.10,.25,max(namakPanelAA.x,namakPanelAA.y));
  float namakVertical=1.0-smoothstep(.45,.80,abs(vNamakCityNormal.y));
  float namakPlinth=(1.0-smoothstep(.15,1.3,vNamakCityPosition.y))*.10;
  diffuseColor.rgb*=1.0-namakVertical*namakCityDetail*(namakPanelJoint*namakPanelFade*.10+namakPlinth);
 `;
 if(kind==='leaf')return `
  float namakLeafPigment=sin(vNamakCityPosition.x*.59+vNamakCityPosition.z*.73)*sin(vNamakCityPosition.y*1.21);
  float namakLeafTop=smoothstep(-.35,.8,vNamakCityNormal.y);
  diffuseColor.rgb*=1.0+namakCityDetail*((namakLeafPigment*.065)+(namakLeafTop-.5)*.10);
 `;
 if(kind==='ground')return `
  float namakLawnPatch=sin(vNamakCityPosition.x*.071+sin(vNamakCityPosition.z*.094))*sin(vNamakCityPosition.z*.13);
  diffuseColor.rgb*=1.0+namakLawnPatch*.10*namakCityDetail;
 `;
 // Low-opacity reflected glass stays opaque: there is no transparency pass.
 if(kind==='glass')return `
  float namakGlassBand=sin(vNamakCityPosition.y*.24+vNamakCityPosition.x*.008);
  diffuseColor.rgb*=1.0+namakGlassBand*.05*namakCityDetail;
 `;
 return '';
}

function qualityId(value){return typeof value==='string'&&NAMAK_VISUAL_BUDGETS[value]?value:value?.id&&NAMAK_VISUAL_BUDGETS[value.id]?value.id:'high';}
const LOBE_ORDER=[0,2,4,6,8,1,3,5,7];

// Derived from the existing build_namak.py roadside tree layout. Every new
// surface remains beyond the 22 m road and its race wall; physics is untouched.
export function namakTreeDetails(route){
 const cells=new Map(),size=128;
 for(let i=0;i<route.points.length;i+=48){
  const p=route.points[i],normal=Math.hypot(p.dx,p.dz);if(!normal)continue;
  for(const side of [-1,1]){
   const tx=p.x+p.dz/normal*side*22,tz=p.z-p.dx/normal*side*22;
   const key=`${Math.floor(tx/size)},${Math.floor(tz/size)}`;
   if(!cells.has(key))cells.set(key,{key,low:[],high:[]});
   for(let k=0;k<LOBE_ORDER.length;k++){
    const lobe=LOBE_ORDER[k],angle=lobe*Math.PI*2/9+(i%11)*.09;
    const record={x:tx+Math.cos(angle)*1.82,z:tz+Math.sin(angle)*1.82,y:4.78+Math.sin(angle*2)*.26,
     sx:.78+(lobe%3)*.09,sy:.76+(lobe%2)*.12,sz:.86,index:i,side,lobe};
    cells.get(key)[k<5?'low':'high'].push(record);
   }
  }
 }
 return [...cells.values()].map(c=>({...c,records:[...c.low,...c.high],mediumCount:c.low.length}));
}

export function createNamakVisuals(scene,world,route,{quality='high'}={}){
 const architecture=createNamakArchitecture(world,quality);
 const root=new THREE.Group();root.name='Namak_Visual_Details';root.userData={dynamic:true,visualOnly:true};world.add(root);
 const originals=[],uniforms=new Set(),seen=new Set(),chunks=[];
 let id=qualityId(quality),budget=NAMAK_VISUAL_BUDGETS[id],disposed=false,lastUpdate=-Infinity,previousVisible=null;
 world.traverse(o=>{
  if(!o.isMesh)return;
  for(const material of Array.isArray(o.material)?o.material:[o.material]){
   if(seen.has(material)||!FINISHES[material.name]||!material.color)continue;seen.add(material);
   const finish=FINISHES[material.name],saved={material,color:material.color.clone(),roughness:material.roughness,metalness:material.metalness,onBeforeCompile:material.onBeforeCompile,customProgramCacheKey:material.customProgramCacheKey};originals.push(saved);
   material.color.set(finish.color);material.roughness=finish.roughness;material.metalness=finish.metalness;
   const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
   material.onBeforeCompile=function(shader,renderer){
    previous.call(this,shader,renderer);
    const detail={value:budget.surfaceDetail};shader.uniforms.namakCityDetail=detail;uniforms.add(detail);
    shader.vertexShader='varying vec3 vNamakCityPosition;\nvarying vec3 vNamakCityNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <defaultnormal_vertex>','#include <defaultnormal_vertex>\nvNamakCityNormal=normalize(inverseTransformDirection(transformedNormal,viewMatrix));');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvNamakCityPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader='varying vec3 vNamakCityPosition;\nvarying vec3 vNamakCityNormal;\nuniform float namakCityDetail;\n'+shader.fragmentShader;
    if(finish.kind==='paving'&&shader.fragmentShader.includes(PAVING_OLD))shader.fragmentShader=shader.fragmentShader.replace(PAVING_OLD,PAVING_NEW);
    else shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\nif(namakCityDetail>0.0){${surfaceFragment(finish.kind)}}`);
   };
   material.customProgramCacheKey=()=>`${key}-namak-detail-v1-${finish.kind}`;material.needsUpdate=true;
  }
 });
 // Smooth small leaf masses soften the authored coarse tree silhouettes. One
 // shared lit geometry/material, instance colours and bounded 128 m chunks.
 const geometry=new THREE.SphereGeometry(1,10,6),foliage=new THREE.MeshStandardMaterial({name:'Namak_Detail_Leaves',color:'#ffffff',roughness:.90,metalness:0});
 const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),quaternion=new THREE.Quaternion(),colour=new THREE.Color();
 let instances=0;
 for(const cell of namakTreeDetails(route)){
  const mesh=new THREE.InstancedMesh(geometry,foliage,cell.records.length);mesh.name=`Namak_Detail_Tree_${cell.key}`;mesh.castShadow=mesh.receiveShadow=false;
  mesh.userData={visualOnly:true,namakDetailCell:cell.key};
  for(let n=0;n<cell.records.length;n++){
   const p=cell.records[n];position.set(p.x,p.y,p.z);scale.set(p.sx,p.sy,p.sz);quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP,(p.lobe%3)*.32);
   matrix.compose(position,quaternion,scale);mesh.setMatrixAt(n,matrix);
   colour.set(p.lobe%3===0?'#709353':p.lobe%3===1?'#557947':'#395f43');mesh.setColorAt(n,colour);
  }
  mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
  root.add(mesh);chunks.push({mesh,count:cell.records.length,mediumCount:cell.mediumCount,sphere:mesh.boundingSphere.clone()});instances+=cell.records.length;
 }
 const trianglesPerInstance=geometry.index.count/3;
 const geometryBytes=Object.values(geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0)+geometry.index.array.byteLength;
 const stats={version:'namak-detail-v1',materials:originals.length,textureBytes:0,geometryBytes,instanceBytes:instances*(16+3)*4,instances,triangles:instances*trianglesPerInstance,
  maximumDrawCalls:chunks.length,visibleDrawCalls:0,visibleInstances:0,visibleTriangles:0,shadowDrawCalls:0,quality:id,updateInterval:.2};
 const api={root,stats,setQuality(value){
  if(disposed)return;id=qualityId(value);budget=NAMAK_VISUAL_BUDGETS[id];stats.quality=id;
  architecture.setQuality(value);
  for(const u of uniforms)u.value=budget.surfaceDetail;
  for(const chunk of chunks)chunk.mesh.count=budget.lobes===9?chunk.count:budget.lobes===5?chunk.mediumCount:0;
  lastUpdate=-Infinity;
 },update(camera,dt=0,elapsed=0,visible=world.visible){
  if(disposed)return;
  architecture.update(camera,visible);stats.architecture=architecture.stats;
  const shown=Boolean(visible&&world.visible&&budget.distance>0&&camera?.position);root.visible=shown;
  if(!shown){stats.visibleDrawCalls=stats.visibleInstances=stats.visibleTriangles=0;previousVisible=shown;return;}
  if(shown===previousVisible&&Number.isFinite(elapsed)&&elapsed>=lastUpdate&&elapsed-lastUpdate<stats.updateInterval)return;
  previousVisible=shown;lastUpdate=Number.isFinite(elapsed)?elapsed:0;world.updateWorldMatrix(true,false);
  const worldSphere=new THREE.Sphere(),nearby=[];let calls=0,count=0;
  for(const chunk of chunks){
   worldSphere.copy(chunk.sphere).applyMatrix4(world.matrixWorld);
   const near=camera.position.distanceTo(worldSphere.center)-worldSphere.radius;
   chunk.mesh.visible=false;
   if(near<=budget.distance&&chunk.mesh.count)nearby.push({chunk,near});
  }
  nearby.sort((a,b)=>a.near-b.near);
  for(let i=0;i<Math.min(nearby.length,budget.chunks);i++){const chunk=nearby[i].chunk;chunk.mesh.visible=true;calls++;count+=chunk.mesh.count;}
  stats.visibleDrawCalls=calls;stats.visibleInstances=count;stats.visibleTriangles=count*trianglesPerInstance;
 },dispose(){
  architecture.dispose();
  if(disposed)return;disposed=true;root.removeFromParent();for(const chunk of chunks)chunk.mesh.dispose();geometry.dispose();foliage.dispose();uniforms.clear();
  for(const saved of originals){
   const {material}=saved;material.color.copy(saved.color);material.roughness=saved.roughness;material.metalness=saved.metalness;
   material.onBeforeCompile=saved.onBeforeCompile;material.customProgramCacheKey=saved.customProgramCacheKey;material.needsUpdate=true;
  }
  stats.visibleDrawCalls=stats.visibleInstances=stats.visibleTriangles=0;
 }};
 api.setQuality(id);return api;
}
