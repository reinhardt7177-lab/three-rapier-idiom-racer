import * as THREE from 'three';

// This is a fictional coastal course. Material cues are a visual reinterpretation,
// not a claim that the existing recovered world reproduces a real Korean coast.
export function createCoastalVisuals(scene,world,route,{quality={id:'high'}}={}){
 const time={value:0},detail={value:quality.id==='low'?0:1},owned=new Set(),originals=new Map();
 const stats={version:'coastal-material-relief-1',materials:0,waterMaterials:0,addedDraws:0,addedTriangles:0,addedLights:0,textureBytes:0};
 const replace=new Map();
 world.traverse(o=>{if(!o.isMesh)return;
  const adapt=m=>{
   if(replace.has(m))return replace.get(m);
   const water=m.name==='Water',rock=/^(Rock|RockLight)$/.test(m.name),wall=/^CityWall_|^(Stucco|Coral|Cream|White|Ivory)$/.test(m.name),paving=/^(CityPaving|HarborConcrete|Paving)$/.test(m.name);
   if(!water&&!rock&&!wall&&!paving)return m;
   const n=m.clone();n.onBeforeCompile=m.onBeforeCompile;n.customProgramCacheKey=m.customProgramCacheKey;replace.set(m,n);owned.add(n);stats.materials++;
   if(water){n.color.set('#0b627d');n.roughness=.25;n.metalness=.18;stats.waterMaterials++;}
   if(rock)n.roughness=.96;if(wall)n.roughness=.89;
   const prior=n.onBeforeCompile,key=n.customProgramCacheKey();
   n.onBeforeCompile=function(shader,renderer){
    prior.call(this,shader,renderer);shader.uniforms.coastalTime=time;shader.uniforms.coastalDetail=detail;
    shader.vertexShader='varying vec3 coastalPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncoastalPosition=(modelMatrix*vec4(position,1.0)).xyz;');
    shader.fragmentShader=`varying vec3 coastalPosition;uniform float coastalTime;uniform float coastalDetail;
     vec3 coastalRelief(vec3 p,vec3 n,float h,float side){vec3 a=dFdx(p),b=dFdy(p);vec3 r1=cross(b,n),r2=cross(n,a);float d=dot(a,r1)*side;return normalize(abs(d)*n-sign(d)*(dFdx(h)*r1+dFdy(h)*r2));}\n`+shader.fragmentShader;
    const material=water?`float ripple=sin(coastalPosition.x*.41+coastalPosition.z*.19+coastalTime*.64)*.032+sin(coastalPosition.z*.68-coastalPosition.x*.12-coastalTime*.43)*.016;
       float swell=sin(coastalPosition.x*.019+coastalPosition.z*.031+coastalTime*.12);
       diffuseColor.rgb*=.94+swell*.06;`
     :wall?`vec2 tile=coastalPosition.xy*.8;float panel=min(fract(tile.y),1.0-fract(tile.y));float seam=1.0-smoothstep(.018,.018+fwidth(tile.y),panel);
       float patina=sin(coastalPosition.x*.17+coastalPosition.z*.11)*sin(coastalPosition.y*.29);diffuseColor.rgb*=1.0-.075*seam+.045*patina;float ripple=patina*.003;`
     :paving?`vec2 tile=coastalPosition.xz/.8;vec2 edge=min(fract(tile),1.0-fract(tile));vec2 aa=max(fwidth(tile),vec2(.002));float seam=1.0-min(smoothstep(.014,.014+aa.x,edge.x),smoothstep(.014,.014+aa.y,edge.y));
       diffuseColor.rgb*=1.0-.12*seam;float ripple=-seam*.002;`
     :`float strata=sin(coastalPosition.y*2.6+sin(coastalPosition.x*.22+coastalPosition.z*.13)*1.2);
       float mineral=sin(coastalPosition.x*9.3+coastalPosition.z*7.1)*sin(coastalPosition.y*8.1);diffuseColor.rgb*=1.0+strata*.05+mineral*.035;float ripple=strata*.012+mineral*.003;`;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+material);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=coastalRelief(-vViewPosition,normal,ripple*coastalDetail,faceDirection);');
   };
   n.customProgramCacheKey=()=>`${key}-coastal-${water?'water':rock?'rock':wall?'wall':'paving'}-v1`;n.needsUpdate=true;return n;
  };
  const before=o.material,after=Array.isArray(before)?before.map(adapt):adapt(before);
  if(Array.isArray(before)?after.some((m,i)=>m!==before[i]):after!==before){originals.set(o,before);o.material=after;}
 });
 let disposed=false;
 return {stats,setQuality(q){detail.value=q.id==='low'?0:1;},update(camera,dt,elapsed,visible){if(!disposed&&visible&&dt>0)time.value=elapsed;},dispose(){if(disposed)return;disposed=true;for(const [o,m] of originals)o.material=m;owned.forEach(m=>m.dispose());}};
}
