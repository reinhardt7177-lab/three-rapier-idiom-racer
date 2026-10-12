import * as THREE from 'three';

export const MOUNTAIN_LIGHTING=Object.freeze({ambient:.36,sun:2.1,exposure:.76,environment:.28,fogNear:1000,fogFar:3200});
export const MOUNTAIN_ATMOSPHERE=Object.freeze({fog:'#9ec6e0',turbidity:2,rayleigh:2.1,mieCoefficient:.0025});

// Photo-derived palette, not sampled photo textures. Restrict changes to the
// two Korean courses; shared geometry, route heights and colliders stay intact.
const palettes=Object.freeze({
 yeosu:{Terrain:'#112b25',Concrete:'#46556b',Facade:'#233248',Roof:'#162332',Water:'#031c39',Bark:'#252227',Leaf:'#153c31'},
 seongsamjae:{Terrain:'#426333',Leaf:'#2e742c',Bark:'#65503b',Stone:'#657a79',Concrete:'#89948d',Facade:'#656b5e',Roof:'#394f42'},
});
export function applyKoreaPalette(root,trackId){
 const palette=palettes[trackId];if(!palette)return null;
 const seen=new Set();let materials=0,emissiveMaterials=0;
 root.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){
  if(seen.has(m))continue;seen.add(m);
  if(palette[m.name]){m.color.set(palette[m.name]);materials++;}
  if(trackId==='yeosu'&&m.name==='Water'){m.roughness=.24;m.metalness=.65;}
  if(trackId==='yeosu'&&['Pink','Cyan','Window'].includes(m.name)){
   // Preserve authored linear emission; avoid ACES turning saturated lamps
   // into pale highlights. This does not add bloom or a reflection pass.
   m.toneMapped=false;emissiveMaterials++;m.needsUpdate=true;
  }
 }});
 return {version:`${trackId}-photo-palette-1`,materials,emissiveMaterials};
}

export function createNightSky(){
 const material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,toneMapped:false,
  uniforms:{zenith:{value:new THREE.Color('#050b27')},horizon:{value:new THREE.Color('#0b1c38')},low:{value:new THREE.Color('#0a2138')}},
  vertexShader:'varying vec3 skyDirection;void main(){skyDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:`varying vec3 skyDirection;uniform vec3 zenith;uniform vec3 horizon;uniform vec3 low;
   void main(){float h=normalize(skyDirection).y;vec3 c=mix(horizon,zenith,smoothstep(0.0,.65,h));
   c=mix(c,low,smoothstep(0.0,.22,-h));gl_FragColor=vec4(c,1.0);
   #include <colorspace_fragment>
   }`});
 const sky=new THREE.Mesh(new THREE.SphereGeometry(2200,24,12),material);
 sky.name='Yeosu_Night_Gradient';sky.frustumCulled=false;sky.renderOrder=-10;
 return sky;
}
