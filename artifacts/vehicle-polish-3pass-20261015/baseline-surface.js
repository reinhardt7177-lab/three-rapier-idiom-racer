import * as THREE from 'three';

const vividPaintMaterials=new WeakSet();
export function polishVehicleMaterial(m,{vivid=false}={}){
  if(/Exterior_NewPaint/.test(m.name)){
    m.roughness=.26;m.metalness=.34;
    if('clearcoat' in m){m.clearcoat=.8;m.clearcoatRoughness=.16;}
    if(vivid&&!vividPaintMaterials.has(m)){
      vividPaintMaterials.add(m);
      const compile=m.onBeforeCompile,cacheKey=m.customProgramCacheKey();
      // Restore paint chroma after ACES compresses highlights. Neutral reflections
      // and the authored paint colour/map remain intact; no full-screen pass.
      m.onBeforeCompile=function(shader,renderer){
        compile.call(this,shader,renderer);
        shader.fragmentShader=shader.fragmentShader.replace('#include <tonemapping_fragment>',`#include <tonemapping_fragment>
          float paintLuma=dot(gl_FragColor.rgb,vec3(.2126,.7152,.0722));
          gl_FragColor.rgb=clamp(mix(vec3(paintLuma),gl_FragColor.rgb,1.20),0.0,1.0);`);
      };
      m.customProgramCacheKey=()=>`${cacheKey}-vivid-paint-v1`;
      m.needsUpdate=true;
    }
  }
  if(/Glass/.test(m.name)){
    // Windows stay dark enough to read as glazing. Lamp/mirror inserts now
    // have independent authored materials; no transmission sorting/pass.
    m.roughness=.20;m.metalness=.02;m.envMapIntensity=.48;
    if('clearcoat' in m){m.clearcoat=.35;m.clearcoatRoughness=.18;}
  }
  if(/Finish_LampPolymer/.test(m.name)){m.roughness=.08;m.envMapIntensity=.75;}
  if(/Finish_MirrorSilver/.test(m.name)){m.roughness=.1;m.metalness=.95;}
  if(/Finish_(MachinedAlloy|WheelGraphite)/.test(m.name))m.envMapIntensity=.8;
  if(/Finish_TwoToneAlloy/.test(m.name)&&!m.userData.alloyFinish){
    m.envMapIntensity=.8;m.userData.alloyFinish=true;
    const compile=m.onBeforeCompile,key=m.customProgramCacheKey();
    m.onBeforeCompile=function(shader,renderer){
      compile.call(this,shader,renderer);
      shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
        #ifdef USE_COLOR
          float alloyCut=smoothstep(.15,.40,dot(vColor.rgb,vec3(.2126,.7152,.0722)));
          metalnessFactor=mix(.82,.92,alloyCut);
          roughnessFactor=mix(.31,.22,alloyCut);
        #endif`);
    };
    m.customProgramCacheKey=()=>`${key}-alloy-finish-v1`;m.needsUpdate=true;
  }
  if(/Brake rotor/.test(m.name)){m.metalness=.78;m.roughness=.43;}
  if(/Finish_CarbonWeave/.test(m.name)&&!m.userData.carbonFinish){
    m.userData.carbonFinish=true;
    const compile=m.onBeforeCompile,key=m.customProgramCacheKey();
    m.onBeforeCompile=function(shader,renderer){
      compile.call(this,shader,renderer);
      shader.vertexShader='varying vec3 finishPosition;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfinishPosition=position;');
      shader.fragmentShader='varying vec3 finishPosition;\n'+shader.fragmentShader;
      // Millimetre-scale weave fades once below one pixel. fwidth avoids
      // shimmering under motion; no texture, lights or extra render pass.
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        vec2 weaveUV=(finishPosition.xz+finishPosition.xy*.35)*210.0;
        float weaveFade=1.0-smoothstep(.35,1.0,max(fwidth(weaveUV.x),fwidth(weaveUV.y)));
        float weave=sin(weaveUV.x*3.14159)*sin(weaveUV.y*3.14159);
        diffuseColor.rgb*=1.0+weave*.14*weaveFade;`);
    };
    m.customProgramCacheKey=()=>`${key}-carbon-finish-v1`;m.needsUpdate=true;
  }
}

// One shared 64px mipmapped grain. World-space coordinates also work on roads
// without UVs, and remain identical after static scenery batching.
export function polishWorldSurfaces(root,{namak=false}={}){
  const data=new Uint8Array(64*64*4);let seed=73471;
  for(let i=0;i<data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const value=80+(seed>>>24)%96;data.set([value,value,value,255],i);}
  const grain=new THREE.DataTexture(data,64,64);grain.wrapS=grain.wrapT=THREE.RepeatWrapping;
  grain.magFilter=THREE.LinearFilter;grain.minFilter=THREE.LinearMipmapLinearFilter;grain.generateMipmaps=true;grain.needsUpdate=true;
  const seen=new Set();let surfaces=0;
  root.traverse(o=>{
    if(!o.isMesh)return;
    for(const m of Array.isArray(o.material)?o.material:[o.material]){
      if(seen.has(m))continue;seen.add(m);
      if(namak&&/^Namak_(Glass|Window)$/.test(m.name)){m.roughness=.24;m.metalness=.08;}
      if(m.name==='Water'){m.roughness=.28;m.metalness=.2;if(!namak)continue;}
      const road=m.name==='Asphalt',ground=/^(Grass|Terrain|IslandTerrain|BackdropTerrain|Rock|RockLight|HarborConcrete|Concrete|Paving|CityPaving)$/.test(m.name);
      const brick=namak&&m.name==='Namak_Brick',stone=namak&&/^Namak_(Stone|Cream|White|Sand)$/.test(m.name),wood=namak&&m.name==='Namak_Wood',water=namak&&m.name==='Water',paving=namak&&m.name==='Paving';
      if(!road&&!ground&&!brick&&!stone&&!wood&&!water)continue;
      surfaces++;m.roughness=water?.25:road?.88:.94;
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
        if(namak){
          const pattern=paving?`vec2 tile=fract(surfacePosition.xz/0.6);float joint=1.0-smoothstep(.018,.045,min(min(tile.x,1.0-tile.x),min(tile.y,1.0-tile.y)));diffuseColor.rgb*=1.0-joint*.24;`
            :brick?`float row=floor(surfacePosition.y*3.8);vec2 tile=fract(vec2((surfacePosition.x+surfacePosition.z)*2.5+mod(row,2.0)*.5,surfacePosition.y*3.8));float joint=1.0-smoothstep(.025,.075,min(min(tile.x,1.0-tile.x),min(tile.y,1.0-tile.y)));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.13,.12,.10),joint*.55);`
            :wood?`float grainLine=sin((surfacePosition.x+surfacePosition.z)*40.0+(texture2D(surfaceGrain,surfacePosition.xz*.025).r-.5)*8.0);diffuseColor.rgb*=1.0+grainLine*.07;`
            :water?`float wave=sin(surfacePosition.x*1.4+surfacePosition.z*.9)*sin(surfacePosition.z*1.7);diffuseColor.rgb*=.94+wave*.06;`:'';
          shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\n${pattern}`);
          // Derivative bump in view space adds small surface relief without
          // changing the perfectly flat collision road or creating UV buffers.
          shader.fragmentShader=`vec3 namakRelief(vec3 pos,vec3 n,vec2 dh,float side){vec3 sx=normalize(dFdx(pos));vec3 sy=normalize(dFdy(pos));vec3 r1=cross(sy,n);vec3 r2=cross(n,sx);float det=dot(sx,r1)*side;return normalize(abs(det)*n-sign(det)*(dh.x*r1+dh.y*r2));}\n`+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
            float surfaceHeight=texture2D(surfaceGrain,surfacePosition.${brick||stone?'xy':'xz'}*${water?'0.4':'2.7'}).r*${water?'0.03':road?'0.004':'0.008'};
            normal=namakRelief(-vViewPosition,normal,vec2(dFdx(surfaceHeight),dFdy(surfaceHeight)),faceDirection);`);
        }
      };
      m.customProgramCacheKey=()=>namak?`namak-surface-v2-${m.name}`:`coastal-surface-v1-${road?'road':'ground'}`;
    }
  });
  if(!surfaces)grain.dispose();
  return {surfaces,textureBytes:data.length};
}
