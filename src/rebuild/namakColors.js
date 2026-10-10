// sRGB swatches: Color.set converts them to linear light for the PBR renderer.
// Keep pale masonry neutral; greenery, shop fronts and flowers carry the colour.
export const NAMAK_COLORS=Object.freeze({
  Terrain:'#437436',Grass:'#3b7b31',
  Namak_Leaf:'#236922',Namak_LeafLight:'#5a882b',Namak_Pine:'#145438',
  Namak_Roof:'#1f6656',Namak_Teal:'#0087a2',Namak_Glass:'#0c486d',
  Namak_Silver:'#536773',Namak_Dark:'#17222c',Namak_Window:'#18374b',
  Namak_Brick:'#a84225',Namak_Stone:'#677c88',Namak_Cream:'#dac8a2',
  Namak_White:'#d7e0e5',Namak_Beige:'#9caaab',Namak_Wood:'#84552c',
  Namak_Flower:'#e63d74',Namak_FlowerGold:'#ffc326',
  Namak_Yellow:'#ffbd0a',Namak_Red:'#f13725',Namak_Line:'#f2f6f6',
  Namak_Blue:'#0478cb',Water:'#007b99',
});

export function applyNamakColors(root){
  const seen=new Set();let changed=0,graded=0;
  root.traverse(o=>{
    if(!o.isMesh)return;
    for(const m of Array.isArray(o.material)?o.material:[o.material]){
      if(seen.has(m))continue;seen.add(m);
      if(NAMAK_COLORS[m.name]&&m.color){m.color.set(NAMAK_COLORS[m.name]);changed++;}
      if(!/^(Namak_|Asphalt$|Concrete$|Paving$|Terrain$|Grass$|Water$)/.test(m.name))continue;
      const compile=m.onBeforeCompile,cacheKey=m.customProgramCacheKey();
      m.onBeforeCompile=function(shader,renderer){
        compile.call(this,shader,renderer);
        shader.fragmentShader=shader.fragmentShader.replace('#include <tonemapping_fragment>',`#include <tonemapping_fragment>
          float cityLuma=dot(gl_FragColor.rgb,vec3(.2126,.7152,.0722));
          vec3 cityColour=mix(vec3(cityLuma),gl_FragColor.rgb,1.24);
          gl_FragColor.rgb=clamp((cityColour-vec3(.22))*1.10+vec3(.22),0.0,1.0);`);
      };
      m.customProgramCacheKey=()=>`${cacheKey}-namak-vivid-1`;
      m.needsUpdate=true;graded++;
    }
  });
  return {version:'namak-vivid-1',materials:changed,gradedMaterials:graded};
}

export function tintNamakSky(sky){
  // Retain atmospheric gradients, with a blue art-direction tint. The horizon
  // has less tint than the upper sky, so distant buildings stay readable.
  sky.material.fragmentShader=sky.material.fragmentShader.replace('#include <tonemapping_fragment>',`#include <tonemapping_fragment>
    float skyBlue=smoothstep(-.02,.25,direction.y);
    gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(.055,.26,.56),.16+skyBlue*.20);`);
}

export function outdoorAtmosphere(namak=false){
  return namak?{turbidity:2.4,rayleigh:2.2,mieCoefficient:.003,fog:'#8bbdd8'}
    :{turbidity:4,rayleigh:1.7,mieCoefficient:.005,fog:'#b8cbd4'};
}
