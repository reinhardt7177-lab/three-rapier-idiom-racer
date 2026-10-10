import * as THREE from 'three';

export function polishVehicleMaterial(m){
  if(/Exterior_NewPaint/.test(m.name)){
    m.roughness=.26;m.metalness=.34;
    if('clearcoat' in m){m.clearcoat=.8;m.clearcoatRoughness=.16;}
  }
  if(/Glass/.test(m.name)){
    m.roughness=.14;m.metalness=.02;
    if('clearcoat' in m){m.clearcoat=.65;m.clearcoatRoughness=.12;}
  }
}

// One shared 64px mipmapped grain. World-space coordinates also work on roads
// without UVs, and remain identical after static scenery batching.
export function polishWorldSurfaces(root){
  const data=new Uint8Array(64*64*4);let seed=73471;
  for(let i=0;i<data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const value=80+(seed>>>24)%96;data.set([value,value,value,255],i);}
  const grain=new THREE.DataTexture(data,64,64);grain.wrapS=grain.wrapT=THREE.RepeatWrapping;
  grain.magFilter=THREE.LinearFilter;grain.minFilter=THREE.LinearMipmapLinearFilter;grain.generateMipmaps=true;grain.needsUpdate=true;
  const seen=new Set();let surfaces=0;
  root.traverse(o=>{
    if(!o.isMesh)return;
    for(const m of Array.isArray(o.material)?o.material:[o.material]){
      if(seen.has(m))continue;seen.add(m);
      if(m.name==='Water'){m.roughness=.28;m.metalness=.2;continue;}
      const road=m.name==='Asphalt',ground=/^(Grass|Terrain|IslandTerrain|BackdropTerrain|Rock|RockLight|HarborConcrete|Concrete|Paving|CityPaving)$/.test(m.name);
      if(!road&&!ground)continue;
      surfaces++;m.roughness=road?.88:.94;
      if(road)m.color.setRGB(.018,.022,.027);
      // Direct property keeps the shared texture visible to the scene disposer.
      m.surfaceGrain=grain;
      m.onBeforeCompile=shader=>{
        shader.uniforms.surfaceGrain={value:grain};
        shader.vertexShader='varying vec3 surfacePosition;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nsurfacePosition=(modelMatrix*vec4(position,1.0)).xyz;');
        shader.fragmentShader='varying vec3 surfacePosition;\nuniform sampler2D surfaceGrain;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
          float fineGrain=texture2D(surfaceGrain,surfacePosition.xz*1.8).r-.5;
          float weather=texture2D(surfaceGrain,surfacePosition.xz*.025).r-.5;
          diffuseColor.rgb*=1.0+fineGrain*${road?'0.24':'0.18'}+weather*${road?'0.22':'0.30'};`);
      };
      m.customProgramCacheKey=()=>`coastal-surface-v1-${road?'road':'ground'}`;
    }
  });
  if(!surfaces)grain.dispose();
  return {surfaces,textureBytes:data.length};
}
