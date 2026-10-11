import * as THREE from 'three';
import {finishCockpitSurfaces} from './cockpitFinish.js';
import {createCockpitDisplay} from './cockpitDisplay.js';

// One camera-space Blender interior, separate from the physical chassis.
export function createCockpit(root,camera) {
  const wheel=root.getObjectByName('SteeringWheel'),speed=root.getObjectByName('SpeedNeedle'),rpm=root.getObjectByName('RPMNeedle');
  if(!wheel||!speed||!rpm)throw new Error('Blender 운전석의 조향/계기판 피벗이 없습니다.');
  root.visible=false;camera.add(root);
  let meshes=0;
  root.traverse(o=>{if(o.isMesh){meshes++;o.castShadow=false;o.receiveShadow=false;o.frustumCulled=false;}});
  const finish=finishCockpitSurfaces(root);
  let displayMaterial;root.traverse(o=>{if(o.isMesh&&o.material.name==='Cockpit_Display')displayMaterial=o.material;});
  if(!displayMaterial)throw new Error('Blender 운전석의 표시 화면이 없습니다.');
  const display=createCockpitDisplay(displayMaterial);
  const fill=new THREE.PointLight('#f1eee7',.4,2.1,2);fill.position.set(.1,.15,-.3);camera.add(fill);fill.visible=false;
  const clamp=(v,max)=>Math.max(0,Math.min(max,Number.isFinite(v)?v:0));
  const angle=value=>(130-260*value)*Math.PI/180;
  let state={visible:false,rig:1,meshes,steeringAngle:0,speedNeedle:angle(0),rpmNeedle:angle(0)};
  function update(vehicle,visible,redline=8000,{compact=false,music=null,now=performance.now()}={}) {
    const shown=visible&&!state.visible;
    root.visible=fill.visible=visible;
    // Small landscape windows need a smaller dashboard and more visible road.
    root.position.set(0,compact?-.12:0,compact?-.32:0);
    // Positive front-wheel yaw is a left turn; +Z rotation moves the
    // camera-space wheel's upper stripe left from the driver's seat.
    wheel.rotation.z=(vehicle?.wheels?.[1]?.steering||0)*4;
    // The right gauge is physically labeled 0..8 (thousands of RPM).
    speed.rotation.z=angle(clamp(vehicle?.kmh,260)/260);
    rpm.rotation.z=angle(clamp(vehicle?.powertrain?.rpm,8000)/8000);
    if(visible)display.update(vehicle,music,redline,now,shown);
    state={visible,rig:1,meshes,steeringAngle:wheel.rotation.z,speedNeedle:speed.rotation.z,rpmNeedle:rpm.rotation.z,redline,grainBytes:finish.bytes,display:display.status()};
  }
  return {root,update,status:()=>({...state})};
}
