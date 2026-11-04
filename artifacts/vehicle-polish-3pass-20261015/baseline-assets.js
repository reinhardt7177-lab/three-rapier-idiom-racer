import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { batchStaticMeshes } from '/src/garage/batchStatic.js';
import { createSceneDisposer } from '/src/rendering/sceneResources.js';
import {modelPosition} from '/src/rebuild/vehiclePose.js';
import {polishVehicleMaterial} from './baseline-surface.js';
import {createBodyMotion} from '/src/rebuild/bodyMotion.js';

import {VEHICLES} from '/src/rebuild/fleet.js';
import {TRACKS} from '/src/rebuild/tracks.js';
import {browserLoadingMetrics} from '/src/rebuild/loadingMetrics.js';
export {VEHICLES} from '/src/rebuild/fleet.js';

export async function loadRebuildAssets(onProgress=()=>{},track=TRACKS[0]) {
  const decoder=new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}assets/rebuild/draco/`);
  const loader=new GLTFLoader().setDRACOLoader(decoder), result={cars:{}};
  const owned=new THREE.Group();
  let completed=0;
  try {
  // Sequential loading avoids decoding four large archives simultaneously.
  const ids=[...VEHICLES.map(v=>v.id),'garage','world','cockpit'];
  for(const id of ids) {
    onProgress(`불러오는 중 · ${id==='world'?track.name:id==='garage'?'차고':id==='cockpit'?'운전석':VEHICLES.find(v=>v.id===id).name}`,completed/ids.length);
    const gltf=await loader.loadAsync(`${import.meta.env.BASE_URL}assets/rebuild/${id==='world'?track.world:id}.glb`);
    owned.add(gltf.scene);
    gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    if(VEHICLES.some(v=>v.id===id)){
      // Prepare each original template once, before any car shares its geometry.
      gltf.scene.traverse(o=>{if(o.isMesh&&!o.geometry.attributes.uv)o.geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(o.geometry.attributes.position.count*2),2));});
      const wheelRoots=['Wheel_FL','Wheel_FR','Wheel_RL','Wheel_RR'].map(n=>gltf.scene.getObjectByName(n));
      wheelRoots.forEach(w=>{if(w){batchStaticMeshes(w);w.userData.dynamic=true;}});
      // Calipers follow suspension/steering but must never join the static body.
      for(const code of ['FL','FR','RL','RR']){
        const steering=gltf.scene.getObjectByName(`Steering_${code}`);
        if(steering){batchStaticMeshes(steering);steering.userData.dynamic=true;}
        const suspension=gltf.scene.getObjectByName(`Suspension_${code}`);
        if(suspension)suspension.userData.dynamic=true;
      }
      batchStaticMeshes(gltf.scene);
      result.cars[id]=gltf.scene;
    }
    else result[id]=gltf.scene;
    completed++;
  }
  const response=await fetch(`${import.meta.env.BASE_URL}assets/rebuild/${track.route}`);
  if(!response.ok)throw new Error('도로 데이터를 불러오지 못했습니다.');
  result.roads=await response.json();
  if(track.landmarksInWorld)result.landmarks=result.world;
  if(track.id==='namak'){
    onProgress('남악 지명·도로 안내판',.97);
    const signs=await loader.loadAsync(`${import.meta.env.BASE_URL}assets/rebuild/namak-landmarks.glb`);
    // Attach immediately so both normal disposal and the loading-error cleanup
    // own this overlay through the world; it supplies no physics colliders.
    result.landmarks=signs.scene;result.world.add(result.landmarks);
    onProgress('남악 청사·상가·수변 디테일',.99);
    const architecture=await loader.loadAsync(`${import.meta.env.BASE_URL}assets/rebuild/namak-architecture.glb`);
    architecture.scene.name='Namak_Architecture';
    architecture.scene.userData.dynamic=true;
    result.world.add(architecture.scene);
  }
  onProgress('출발 준비 완료',1);
  result.loading=browserLoadingMetrics();
  return result;
  } catch(error) {createSceneDisposer(owned)();throw error;}
  finally {decoder.dispose();}
}

export function createVehicleView(template,id,{vivid=false}={}) {
  const root=template.clone(true), wheels=[],materials=new Set(),copies=new Map();
  root.visible=true;
  // Each car owns material instances. Shared geometries/textures stay with templates.
  root.traverse(o=>{
    if(!o.isMesh)return;
    const copy=m=>{if(!copies.has(m))copies.set(m,m.clone());return copies.get(m);};
    o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);
    for(const m of Array.isArray(o.material)?o.material:[o.material]){
      materials.add(m);
      polishVehicleMaterial(m,{vivid});
      if(/Exterior/.test(m.name)) {
        // Authored Blender PBR paint already includes its colour and finish.
        if(m.name.includes('NewPaint'))continue;
        m.metalness=id==='supra'?.32:.2;m.roughness=id==='supra'?.32:.48;
        if('clearcoat' in m){m.clearcoat=.55;m.clearcoatRoughness=.28;}
        // Legacy glTF supplies recovered texture; tint only white painted texels.
        m.onBeforeCompile=shader=>{
          shader.uniforms.paintTint={value:new THREE.Color(VEHICLES.find(v=>v.id===id).color)};
          shader.fragmentShader='uniform vec3 paintTint;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
            float paintMask=smoothstep(.55,.84,min(diffuseColor.r,min(diffuseColor.g,diffuseColor.b)));
            diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*paintTint,paintMask);`);
        };
        m.customProgramCacheKey=()=>`recovered-paint-${id}`;
      }
    }
  });
  root.updateMatrixWorld(true);
  const names=['Wheel_RR','Wheel_FR','Wheel_RL','Wheel_FL'];
  for(const name of names){
    const wheel=root.getObjectByName(name);
    if(!wheel)throw new Error(`${id}: ${name} 바퀴가 없습니다.`);
    const code=name.slice(6),suspension=root.getObjectByName(`Suspension_${code}`),steering=root.getObjectByName(`Steering_${code}`);
    if(suspension&&steering){
      const position=root.worldToLocal(suspension.getWorldPosition(new THREE.Vector3()));
      wheels.push({pivot:suspension,steering,spin:wheel,front:code.includes('F'),baseY:position.y,center:position.clone()});
      continue;
    }
    const position=wheel.getWorldPosition(new THREE.Vector3());
    const pivot=new THREE.Group(),spin=new THREE.Group();
    root.add(pivot);pivot.position.copy(position);pivot.add(spin);spin.attach(wheel);
    wheels.push({pivot,steering:pivot,spin,front:name.includes('F'),baseY:position.y,center:position.clone()});
  }
  const box=new THREE.Box3().setFromObject(root);
  const floorOffset=box.min.y;
  // Keep all original proportions; showroom placement simply rests on its floor.
  const size=box.getSize(new THREE.Vector3());
  let wheelRadius;
  root.traverse(o=>{if(o.userData.vehicle_rig_version===2)wheelRadius=o.userData.wheel_radius;});
  const spec={length:size.z,track:Math.abs(wheels[0].center.x-wheels[2].center.x),wheelbase:Math.abs(wheels[0].center.z-wheels[1].center.z),...(wheelRadius?{wheelRadius}:{})};
  // A separate visual pivot owns only the static chassis meshes. Preserve the
  // original world transforms while excluding every wheel/steering/suspension
  // descendant, including calipers and tyres batched below their rig nodes.
  const body=new THREE.Group();body.name='Visual_Chassis_Motion';
  body.position.y=Math.max(.45,Math.min(.9,wheels.reduce((s,w)=>s+w.baseY,0)/wheels.length+.35));root.add(body);
  const chassis=[];
  root.traverse(o=>{if(!o.isMesh)return;for(let p=o;p&&p!==root;p=p.parent)if(/^(Wheel_|Steering_|Suspension_)/.test(p.name))return;chassis.push(o);});
  root.updateMatrixWorld(true);for(const o of chassis)body.attach(o);
  const motion=createBodyMotion();
  return {root,body,motion,wheels,floorOffset,spec,dispose(){materials.forEach(m=>m.dispose());}};
}

export function poseVehicle(view,state,modelOffset=.6,previous=state,alpha=1) {
  const mix=(a,b)=>a+(b-a)*alpha;
  view.root.quaternion.set(previous.rotation.x,previous.rotation.y,previous.rotation.z,previous.rotation.w).slerp(new THREE.Quaternion(state.rotation.x,state.rotation.y,state.rotation.z,state.rotation.w),alpha);
  view.root.position.copy(modelPosition(new THREE.Vector3(mix(previous.position.x,state.position.x),mix(previous.position.y,state.position.y),mix(previous.position.z,state.position.z)),view.root.quaternion,modelOffset));
  state.wheels.forEach((w,i)=>{
    const before=previous.wheels[i];
    view.wheels[i].pivot.position.y=mix(before.y,w.y);
    view.wheels[i].steering.rotation.y=mix(before.steering,w.steering);
    view.wheels[i].spin.rotation.x=mix(before.rotation+(before.launchAngle||0),w.rotation+(w.launchAngle||0));
  });
}
