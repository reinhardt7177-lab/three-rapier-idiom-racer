import * as THREE from 'three';

// Camera-facing quads avoid hardware point-size limits. Each cloud is one draw.
export function createSmokeCloud(positions,sizes,alphas,{color='#c4c9c8',name='smoke-cloud'}={}){
 const plane=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();
 geometry.index=plane.index;geometry.setAttribute('position',plane.attributes.position);geometry.setAttribute('uv',plane.attributes.uv);
 geometry.setAttribute('aCenter',new THREE.InstancedBufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
 geometry.setAttribute('aSize',new THREE.InstancedBufferAttribute(sizes,1).setUsage(THREE.DynamicDrawUsage));
 geometry.setAttribute('aAlpha',new THREE.InstancedBufferAttribute(alphas,1).setUsage(THREE.DynamicDrawUsage));geometry.instanceCount=sizes.length;
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,
  uniforms:{ink:{value:new THREE.Color(color)}},
  vertexShader:`attribute vec3 aCenter; attribute float aSize; attribute float aAlpha; varying vec2 vUv; varying float opacity;
   void main(){vec4 p=modelViewMatrix*vec4(aCenter,1.);p.xy+=position.xy*aSize;gl_Position=projectionMatrix*p;vUv=uv;opacity=aAlpha;}`,
  fragmentShader:`uniform vec3 ink; varying vec2 vUv; varying float opacity;
   void main(){vec2 p=vUv-.5;float r=length(p);float lobes=.42+.028*sin(p.x*27.)*sin(p.y*23.);
    float soft=1.-smoothstep(.06,lobes,r);float a=opacity*soft;if(a<.003)discard;
    gl_FragColor=vec4(ink*(.96+.04*sin(p.x*17.+p.y*13.)),a);
    #include <colorspace_fragment>
   }`});
 const root=new THREE.Mesh(geometry,material);root.name=name;root.frustumCulled=false;root.visible=false;root.renderOrder=2;
 return root;
}
