import * as THREE from 'three';
export function createImpactSparks(){
 const limit=160,positions=new Float32Array(limit*3),life=new Float32Array(limit),velocity=new Float32Array(limit*3);let cursor=0,seed=7231;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('life',new THREE.BufferAttribute(life,1).setUsage(THREE.DynamicDrawUsage));
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending,
  vertexShader:'attribute float life;varying float alpha;void main(){alpha=life;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(35./max(1.,-p.z),1.,5.);}',
  fragmentShader:'varying float alpha;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(1.,.55,.12,alpha*(1.-smoothstep(.08,.5,d)));}',
 });
 const root=new THREE.Points(geometry,material);root.frustumCulled=false;root.name='physical-contact-sparks';root.visible=false;
 function emit(hit){if(!hit.point)return;for(let n=0;n<8+Math.round(hit.intensity*24);n++){
  const i=cursor++%limit;positions.set([hit.point.x,hit.point.y+.03,hit.point.z],i*3);life[i]=.35+random()*.3;
  const speed=2+hit.intensity*6;velocity.set([(random()-.5)*speed+hit.normal.x*1.5,1+random()*speed*.6,(random()-.5)*speed+hit.normal.z*1.5],i*3);
 }}
 function clear(){life.fill(0);root.visible=false;geometry.attributes.life.needsUpdate=true;}
 function update(dt){let count=0;for(let i=0;i<limit;i++){if(life[i]<=0)continue;life[i]=Math.max(0,life[i]-dt);velocity[i*3+1]-=9.81*dt;for(let j=0;j<3;j++)positions[i*3+j]+=velocity[i*3+j]*dt;count++;}root.visible=count>0;geometry.attributes.position.needsUpdate=geometry.attributes.life.needsUpdate=true;}
 return {root,emit,clear,update};
}
