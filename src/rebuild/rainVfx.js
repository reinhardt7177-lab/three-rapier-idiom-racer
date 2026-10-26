import * as THREE from 'three';
const MAX_DROPS=220,MAX_SPRAY=160;
function softSprayTexture(){
 const size=32,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const j=(y*size+x)*4,r=Math.hypot((x+.5)/size*2-1,(y+.5)/size*2-1);data[j]=data[j+1]=data[j+2]=255;data[j+3]=Math.round(255*Math.max(0,1-r)**2);}
 const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
}
export function createRainVfx(){
 const root=new THREE.Group();root.name='Rain_Weather';root.visible=false;
 const rainPositions=new Float32Array(MAX_DROPS*6),drops=new Float32Array(MAX_DROPS*3);
 const sprayPositions=new Float32Array(MAX_SPRAY*3),sprayDraw=new Float32Array(MAX_SPRAY*3),velocities=new Float32Array(MAX_SPRAY*3),ages=new Float32Array(MAX_SPRAY).fill(10);
 const rainGeometry=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(rainPositions,3).setUsage(THREE.DynamicDrawUsage));
 const sprayGeometry=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(sprayDraw,3).setUsage(THREE.DynamicDrawUsage));
 const rain=new THREE.LineSegments(rainGeometry,new THREE.LineBasicMaterial({color:'#c0e4f4',transparent:true,opacity:.28,depthWrite:false}));
 const sprayTexture=softSprayTexture();
 const spray=new THREE.Points(sprayGeometry,new THREE.PointsMaterial({color:'#c4eaf4',map:sprayTexture,transparent:true,opacity:.4,size:.24,depthWrite:false,sizeAttenuation:true}));
 rain.frustumCulled=spray.frustumCulled=false;root.add(rain,spray);
 let budget=MAX_DROPS,sprayBudget=MAX_SPRAY,cursor=0,live=0,seed=281;
 const carry=[0,0,0,0];
 function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
 for(let i=0;i<MAX_DROPS;i++){drops[i*3]=(random()-.5)*22;drops[i*3+1]=random()*11;drops[i*3+2]=(random()-.5)*28;}
 function clear(){root.visible=false;ages.fill(10);carry.fill(0);live=0;sprayGeometry.setDrawRange(0,0);}
 return {root,clear,setBudget(value){budget=Math.max(0,Math.min(MAX_DROPS,Math.floor(value)));sprayBudget=Math.min(MAX_SPRAY,Math.max(8,budget));clear();},
 update(state,dt,enabled){if(!enabled||!state){if(root.visible||live)clear();return;}if(!(dt>0&&Number.isFinite(dt)))return;dt=Math.min(.1,dt);root.visible=true;
  for(let i=0;i<budget;i++){const j=i*3,k=i*6;drops[j+1]-=dt*17;if(drops[j+1]<0)drops[j+1]+=11;
   rainPositions[k]=state.position.x+drops[j];rainPositions[k+1]=state.position.y+drops[j+1];rainPositions[k+2]=state.position.z+drops[j+2];
   rainPositions[k+3]=rainPositions[k]+.12;rainPositions[k+4]=rainPositions[k+1]-.7;rainPositions[k+5]=rainPositions[k+2]+.08;}
  rainGeometry.setDrawRange(0,budget*2);rainGeometry.attributes.position.needsUpdate=true;
  for(let i=0;i<sprayBudget;i++){ages[i]+=dt;if(ages[i]>.75)continue;const j=i*3;sprayPositions[j]+=velocities[j]*dt;sprayPositions[j+1]+=velocities[j+1]*dt;sprayPositions[j+2]+=velocities[j+2]*dt;velocities[j+1]-=dt*2.8;}
  (state.wheels||[]).forEach((wheel,i)=>{if(!wheel.contact||!wheel.point||state.kmh<25){carry[i]=0;return;}carry[i]+=dt*Math.min(45,state.kmh*.3)*(budget<100?.3:1);
   while(carry[i]>=1){carry[i]--;const j=cursor*3;ages[cursor]=0;cursor=(cursor+1)%sprayBudget;
    sprayPositions[j]=wheel.point.x;sprayPositions[j+1]=wheel.point.y+.08;sprayPositions[j+2]=wheel.point.z;
    velocities[j]=(state.velocity?.x||0)*.06+(random()-.5)*1.7;velocities[j+1]=.8+random()*.8;velocities[j+2]=(state.velocity?.z||0)*.06+(random()-.5)*1.7;}
  });
  live=0;for(let i=0;i<sprayBudget;i++)if(ages[i]<.75){sprayDraw.set(sprayPositions.subarray(i*3,i*3+3),live*3);live++;}
  sprayGeometry.setDrawRange(0,live);sprayGeometry.attributes.position.needsUpdate=true;
 },stats:()=>({drops:root.visible?budget:0,spray:live,budget,sprayBudget,drawCalls:root.visible?2:0}),dispose(){rainGeometry.dispose();sprayGeometry.dispose();rain.material.dispose();spray.material.dispose();sprayTexture.dispose();}};
}
