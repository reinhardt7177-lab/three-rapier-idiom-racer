import {Vector3,Quaternion} from 'three';
import {createSmokeCloud} from '../driving/smokeCloud.js';
import {modelPosition} from './vehiclePose.js';
import {VEHICLES} from './fleet.js';

// Hard points match vehicle_detail_v3.py's exhaust lips in the authored v4 fleet.
export function exhaustPoints(id){
 const vehicle=VEHICLES.find(v=>v.id===id);
 if(!vehicle)throw new Error(`Unknown exhaust model: ${id}`);
 const original=['supra','slk','mustang'].includes(id),x=original?.66:.61;
 return [-1,1].flatMap(side=>(vehicle.quadExhaust?[-.057,.057]:[0]).map(dx=>new Vector3(side*x+dx,.31,-vehicle.length/2-(original?.125:.155))));
}
export function createExhaustVfx(){
 const limit=96,positions=new Float32Array(limit*3),sizes=new Float32Array(limit),alphas=new Float32Array(limit),velocities=new Float32Array(limit*3),ages=new Float32Array(limit).fill(10),lives=new Float32Array(limit);
 const root=createSmokeCloud(positions,sizes,alphas,{color:'#b3bdc3',name:'dual-exhaust-vapour'}),q=new Quaternion(),point=new Vector3(),back=new Vector3();
 let cursor=0,carry=0,live=0,seed=37;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 function clear(){alphas.fill(0);ages.fill(10);carry=cursor=live=0;root.visible=false;root.geometry.attributes.aAlpha.needsUpdate=true;}
 function update(state,emitters,dt,{enabled=true,modelOffset=.6}={}){
  if(!(dt>0&&Number.isFinite(dt)))return;dt=Math.min(.1,dt);
  for(let i=0;i<limit;i++){
   ages[i]+=dt;if(ages[i]>=lives[i]){alphas[i]=0;continue;}
   const j=i*3,t=ages[i]/lives[i];for(let k=0;k<3;k++)positions[j+k]+=velocities[j+k]*dt;
   sizes[i]=.23+t*.85;alphas[i]=.30*Math.min(1,t*14)*(1-t)**1.2;
  }
  if(enabled&&emitters?.length){
   q.set(state.rotation.x,state.rotation.y,state.rotation.z,state.rotation.w);back.set(0,0,-1).applyQuaternion(q);
   // Dense idle vapour must not remain a smoke screen at racing speed.
   // Boost/load still gives a brief stronger plume at the authored outlets.
   const speed=Math.abs(Number(state.speed??((state.kmh||0)/3.6))||0);
   const speedFade=1-.88*Math.min(1,speed/35);
   carry+=dt*(18+14*Math.max(0,state.drive||0))*speedFade;
   while(carry>=1){carry--;for(const emitter of emitters){
    const i=cursor,j=i*3;cursor=(cursor+1)%limit;point.copy(emitter).applyQuaternion(q).add(modelPosition(new Vector3(state.position.x,state.position.y,state.position.z),q,modelOffset));
    positions.set(point.toArray(),j);velocities[j]=back.x*.95+state.velocity.x*.12+(random()-.5)*.15;velocities[j+1]=back.y*.95+.3+random()*.16;velocities[j+2]=back.z*.95+state.velocity.z*.12+(random()-.5)*.15;
    ages[i]=0;lives[i]=.65+random()*.3;sizes[i]=.23;alphas[i]=.09;
   }}
  }else carry=0;
  live=0;for(let i=0;i<limit;i++)if(alphas[i]>0)live++;
  root.visible=live>0;for(const name of ['aCenter','aSize','aAlpha'])root.geometry.attributes[name].needsUpdate=true;
 }
 return {root,update,clear,stats:()=>({live,budget:limit}),dispose(){root.geometry.dispose();root.material.dispose();}};
}
