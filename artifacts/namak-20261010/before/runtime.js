import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {Sky} from 'three/addons/objects/Sky.js';
import { loadRebuildAssets,createVehicleView,poseVehicle,VEHICLES } from './assets.js';
import { createVehiclePhysics,initPhysics,STEP,stepVehicleWorld } from '../driving/physics.js';
import { createChaseCamera } from '../driving/chaseCamera.js';
import { createDrivingSignals } from '../driving/drivingSignals.js';
import { createTireSmoke } from '../driving/tireSmoke.js';
import { createTireFeedback } from '../driving/tireFeedback.js';
import { createDrivingAudio } from '../driving/drivingAudio.js';
import { createSceneDisposer } from '../rendering/sceneResources.js';
import { nearestRoute,routePose,forwardProgress } from './course.js';
import { RACE_TUNING,RACE_GRID_LANE } from './vehicleDynamics.js';
import { createRaceContacts } from './raceContacts.js';
import { createImpactSparks } from './impactSparks.js';
import { recoveredCollider } from './worldCollision.js';
import { createRaceInput,handleRaceKeyDown,raceLayout } from './raceInput.js';
import {batchWorldScenery,createFrameMetrics} from './worldRendering.js';
import {createExhaustVfx,exhaustPoints} from './exhaustVfx.js';
import {roadRecoveryPose,createRecoveryWatch,recoverySpaceClear,recoveryProgressChange} from './vehiclePose.js';
import {rivalFleet} from './fleet.js';
import {createGarageBackdrop} from './garageBackdrop.js';
import {createRaceClock} from './raceClock.js';
import {routeGuidance} from './routeGuidance.js';
import {polishWorldSurfaces} from './surfacePolish.js';
import {createRivalPlanner} from './rivalPlanner.js';
import {createOvertakeRoadCheck} from './overtakeRoad.js';
import {createRaceMusic} from './raceMusic.js';
import {createFirstPersonCamera} from './firstPersonCamera.js';
import {RIVAL_RACE_PROFILE,rivalPace} from './rivalSpeed.js';
import {createCockpit} from './cockpit.js';
import {MUSIC_TRACKS} from './musicTracks.js';
import {createPresentationGuard} from './landscape.js';

export async function createRebuild(host,signal,onState,onLoading) {
  await initPhysics();
  const assets=await loadRebuildAssets(onLoading);
  const all=new THREE.Group();all.add(assets.world,assets.garage,assets.cockpit,...Object.values(assets.cars));
  if(signal.aborted){createSceneDisposer(all)();return null;}
  let renderer;
  try {renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}
  catch(error){createSceneDisposer(all)();throw error;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.info.autoReset=false;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  host.appendChild(renderer.domElement);renderer.domElement.tabIndex=0;
  renderer.domElement.setAttribute('aria-label','MUMU CIRCUIT · Blender 차량과 해안 레이스');
  const scene=new THREE.Scene();scene.add(all);scene.background=new THREE.Color('#090e18');
  Object.values(assets.cars).forEach(c=>c.visible=false);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.035);
  const sky=new Sky();sky.scale.setScalar(1000);
  sky.material.uniforms.turbidity.value=4;sky.material.uniforms.rayleigh.value=1.7;
  sky.material.uniforms.sunPosition.value.set(-25,45,20).normalize();
  const outdoorScene=new THREE.Scene();outdoorScene.add(sky);
  const outdoorEnvironment=pmrem.fromScene(outdoorScene,.04);
  scene.add(sky);sky.visible=false;
  scene.environment=environment.texture;scene.environmentIntensity=1.15;pmrem.dispose();room.dispose();
  const ambient=new THREE.HemisphereLight('#dbeeff','#6c5942',1.25);scene.add(ambient);
  const sun=new THREE.DirectionalLight('#fff4e0',2.6);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-25,right:25,top:25,bottom:-25,near:.1,far:120});sun.shadow.normalBias=.04;scene.add(sun,sun.target);
  const fill=new THREE.DirectionalLight('#6d9eee',1.8);fill.position.set(-5,3,3);scene.add(fill);
  const ceiling=new THREE.PointLight('#c5ddff',24,30,2);ceiling.position.set(0,4.8,0);scene.add(ceiling);
  const camera=new THREE.PerspectiveCamera(40,1,.15,3500),chase=createChaseCamera(camera),firstPerson=createFirstPersonCamera(camera);
  scene.add(camera);
  const cockpit=createCockpit(assets.cockpit,camera);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=4;controls.maxDistance=14;controls.maxPolarAngle=Math.PI/2-.04;
  const garageBackdrop=createGarageBackdrop(assets.garage);
  const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;world.numSolverIterations=8;
  const raceContacts=createRaceContacts(world),sparks=createImpactSparks();scene.add(sparks.root);
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let latestFeedback={},cameraImpact=0;
  assets.world.updateMatrixWorld(true);
  const roads=[],asphalt=new Set();let colliderCount=0;
  assets.world.traverse(o=>{
    if(!o.isMesh)return;
    if(o.name.includes('Road_Asphalt'))roads.push(o);
    if(!o.userData.unity_collider)return;
    const position=o.geometry.attributes.position,vertices=new Float32Array(position.count*3),v=new THREE.Vector3();
    for(let i=0;i<position.count;i++){v.fromBufferAttribute(position,i).applyMatrix4(o.matrixWorld);vertices.set([v.x,v.y,v.z],i*3);}
    const indices=o.geometry.index?new Uint32Array(o.geometry.index.array):Uint32Array.from({length:position.count},(_,i)=>i);
    const collider=world.createCollider(recoveredCollider(vertices,indices));colliderCount++;
    if(o.name.includes('Road_Asphalt'))asphalt.add(collider.handle);
  });
  const surfaces=polishWorldSurfaces(assets.world),scenery=batchWorldScenery(assets.world),frameMetrics=createFrameMetrics();
  // Collision heights are recovered geometry, not a flat substitute under hills.
  const ray=new THREE.Raycaster(),route=assets.roads;
  const rivalPlanner=createRivalPlanner(route,{roadClear:createOvertakeRoadCheck(world,route,asphalt),speedProfile:RIVAL_RACE_PROFILE});
  function spawn(index,lane=0,spec=null){
    const pose=routePose(route,index,lane);
    ray.set(new THREE.Vector3(pose.position.x,pose.position.y+100,pose.position.z),new THREE.Vector3(0,-1,0));
    const hit=ray.intersectObjects(roads,false)[0];
    if(hit&&spec){
      const normal=hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld));
      if(normal.y<0)normal.negate();
      Object.assign(pose,roadRecoveryPose(hit.point,normal,pose.yaw,spec));
    }else if(hit)pose.position.y=hit.point.y+1.1;
    return pose;
  }
  const smoke=createTireSmoke({billboards:true,strong:true}),exhaust=createExhaustVfx(),trails=createTireFeedback(),signals=createDrivingSignals(),audio=createDrivingAudio();scene.add(smoke.root,exhaust.root,trails.root);
  const music=createRaceMusic(MUSIC_TRACKS.map(t=>({...t,url:`${import.meta.env.BASE_URL}assets/audio/${t.file}`})),{storage:()=>window.localStorage});
  let cameraMode='chase';
  const drivingInput=createRaceInput(),clock=createRaceClock(STEP);let mode='garage',selected='supra',display=null,cars=[],paused=false,pauseReason='',countdown=3,elapsed=0,result=null,alive=true,frame=0,last=performance.now(),reportTime=0,cameraSnap=true,frames=0,fps=0,fpsStart=last,soundWanted=true;
  const startIndex=25;
  function publish(){
    const ordered=[...cars].sort((a,b)=>(b.finish!==null)-(a.finish!==null)||(a.finish!==null&&b.finish!==null?a.finish-b.finish:b.progress-a.progress));
    const player=cars[0];
    const state={mode,selected,paused,countdown:Math.max(0,Math.ceil(countdown)),elapsed,result,kmh:Math.round(player?.state.kmh||0),gear:player?.state.gear||'N',place:Math.max(1,ordered.findIndex(c=>c.player)+1),progress:Math.min(1,Math.max(0,(player?.progress||0)/route.length)),region:player?route.points[player.index].region:'GARAGE',nitro:(player?.state.action?.charge??100)/100,standings:ordered.map(c=>({name:c.name,progress:c.progress,finished:c.finish!==null})),fps,colliderCount,contacts:player?.state.contacts??0,position:player?.state.position,ai:cars.slice(1).map(c=>({position:c.state.position,kmh:c.state.kmh,progress:c.progress,contacts:c.state.contacts})),cameraDistance:player?camera.position.distanceTo(new THREE.Vector3().copy(player.state.position)):0};
    if(player){state.redline=RACE_TUNING[selected].redline;state.rpm=Math.round(player.state.powertrain?.rpm||850);state.shifting=player.state.powertrain?.shifting||false;state.mass=player.state.mass;state.wheels=player.state.wheels;state.impact=player.impact;state.rotation=player.state.rotation;state.angularVelocity=player.state.angularVelocity;state.recovery=player.recovery;state.ride=player.state.ride;state.velocity=player.state.velocity;}
    if(player)state.guidance=routeGuidance(route,player.index,player.progress);
    state.timing=clock.snapshot();state.camera={position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov};
    state.input=drivingInput.read();state.pauseReason=pauseReason;
    state.audio={...audio.status(),wanted:soundWanted};
    state.music=music.status();state.cameraMode=cameraMode;state.cockpit=cockpit.status();
    state.rendering={...frameMetrics.snapshot(),scenery,surfaces,pixelRatio:renderer.getPixelRatio(),width:host.clientWidth,height:host.clientHeight};
    state.vfx={tireSmoke:smoke.stats(),exhaust:exhaust.stats(),trails:trails.stats(),feedback:latestFeedback};
    state.ai.forEach((s,i)=>{const car=cars[i+1];s.waitingForTraffic=!!car.waitingForTraffic;s.name=car.name;s.vehicle=car.id;s.maneuver=rivalPlanner.snapshot(car);s.recovery=car.recovery;});
    window.__mumuRebuild=state;onState(state);
  }
  function setGarage(id=selected){
    rivalPlanner.reset();
    frameMetrics.reset();
    selected=id;mode='garage';paused=false;pauseReason='';result=null;drivingInput.clear();audio.setPaused(true);audio.setVehicle(id);music.stop();
    cockpit.update(null,false);
    cars.forEach(c=>{c.sim.dispose();c.view.dispose();c.view.root.removeFromParent();});cars=[];
    display?.dispose();display?.root.removeFromParent();display=createVehicleView(assets.cars[id],id);scene.add(display.root);display.root.position.y=-display.floorOffset;display.root.rotation.y=-.35;
    assets.world.visible=false;assets.garage.visible=true;smoke.clear();exhaust.clear();trails.clear();signals.reset();sparks.clear();raceContacts.clear();latestFeedback={};cameraImpact=0;
    sky.visible=false;scene.background.set('#090e18');scene.fog=null;scene.environment=environment.texture;scene.environmentIntensity=.85;ambient.intensity=.6;fill.visible=true;ceiling.visible=true;sun.intensity=1.9;fill.intensity=.9;renderer.toneMappingExposure=.95;
    camera.fov=40;camera.near=.15;controls.enabled=true;fitGarageCamera();camera.updateProjectionMatrix();
    sun.position.set(4,8,3);sun.target.position.set(0,0,0);publish();
  }
  function startRace(){
    if(!presentationGuard.canDrive())return;
    rivalPlanner.reset();
    frameMetrics.reset();
    audio.setPaused(true);audio.setVehicle(selected);
    audio.setEnabled(soundWanted).then(()=>{if(alive)publish();});
    music.setMaster(soundWanted);music.start().then(()=>{if(alive)publish();});
    display?.dispose();display?.root.removeFromParent();display=null;drivingInput.clear();mode='race';paused=false;pauseReason='';result=null;countdown=3;elapsed=0;clock.reset();cameraSnap=true;
    cars.forEach(c=>{c.sim.dispose();c.view.dispose();c.view.root.removeFromParent();});cars=[];
    assets.world.visible=true;assets.garage.visible=false;controls.enabled=false;sky.visible=true;scene.background.set('#b8cbd4');scene.fog=new THREE.Fog('#b8cbd4',800,2600);scene.environment=outdoorEnvironment.texture;scene.environmentIntensity=.32;ambient.intensity=.45;fill.visible=false;ceiling.visible=false;sun.intensity=2.0;renderer.toneMappingExposure=.85;
    for(let i=0;i<6;i++){
      const id=i===0?selected:rivalFleet(selected)[i-1],lane=i%2===0?-RACE_GRID_LANE:RACE_GRID_LANE,index=startIndex-Math.floor(i/2)*4;
      const view=createVehicleView(assets.cars[id],id);scene.add(view.root);
      const p=spawn(index,lane,view.spec),sim=createVehiclePhysics({sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,start:p.position,spec:view.spec,raceTuning:RACE_TUNING[id]});sim.reset(p.position,p.yaw,{stepWorld:false,rotation:p.rotation});
      const state=sim.snapshot();cars.push({id,sim,view,recoveryWatch:createRecoveryWatch(),recovery:{count:0,reason:'',age:100},exhaustPoints:exhaustPoints(id),player:i===0,name:i===0?'YOU':['NOVA','RAVEN','BLAZE','MIST','LUNA'][i-1],lane,pace:rivalPace(i-1),index,routeDistance:route.points[index].distance,progress:route.points[index].distance-route.points[startIndex].distance,state,previous:state,finish:null,stuck:0});
    }
    for(let i=0;i<120;i++){cars.forEach(c=>c.sim.step({brake:1},false));stepVehicleWorld(world);cars.forEach(c=>{c.state=c.previous=c.sim.finishStep();});}
    signals.reset();smoke.clear();exhaust.clear();trails.clear();sparks.clear();raceContacts.clear();latestFeedback={};cameraImpact=0;audio.setPaused(true);renderer.domElement.focus({preventScroll:true});last=performance.now();publish();
  }
  function recover(car=cars[0],reason='manual'){
    if(!car)return;
    let pose=null,recoveryIndex=car.index,recoveryLane=car.lane;
    const traffic=cars.filter(c=>c!==car).map(c=>c.state);
    // Search backwards only: recovery must never grant a position advantage.
    for(let back=0;back<=32&&!pose;back+=2){
      const index=(car.index-back+route.points.length)%route.points.length;
      for(const lane of [car.lane,-car.lane,0]){
        const candidate=spawn(index,lane,car.view.spec);
        if(recoverySpaceClear(candidate.position,traffic)){pose=candidate;recoveryIndex=index;recoveryLane=lane;break;}
      }
    }
    if(!pose)return false;
    car.progress+=recoveryProgressChange(car.routeDistance,route.points[recoveryIndex].distance,route.length);
    car.index=recoveryIndex;car.routeDistance=route.points[recoveryIndex].distance;
    car.sim.reset(pose.position,pose.yaw,{stepWorld:false,rotation:pose.rotation,preserveCharge:true});car.state=car.previous=car.sim.snapshot();car.stuck=0;
    car.recoveryWatch.reset();car.recovery={count:car.recovery.count+1,reason,age:0};
    if(!car.player)rivalPlanner.reset(car,recoveryLane);
    car.impact={count:0,intensity:0,deltaV:0,age:100};
    if(car.player){drivingInput.clear();audio.reset();cameraSnap=true;signals.reset();smoke.clear();exhaust.clear();trails.clear();cameraImpact=0;latestFeedback={};}
    return true;
  }
  function pause(value,reason='manual'){if(mode!=='race'||(!value&&!presentationGuard.canDrive()))return;paused=value;pauseReason=value?reason:'';drivingInput.clear();clock.reset();last=performance.now();frameMetrics.reset();audio.setPaused(value||countdown>0||!!result);music.setPaused(value||!!result);publish();if(!value){renderer.domElement.focus({preventScroll:true});music.resume();if(soundWanted&&audio.status().state!=='running')audio.setEnabled(true).then(()=>{if(alive)publish();});}}
  const presentationGuard=createPresentationGuard({clear:()=>drivingInput.clear(),pause:reason=>pause(true,reason)});
  function toggleSound(){soundWanted=!soundWanted;audio.setEnabled(soundWanted).then(()=>{if(alive)publish();});music.setMaster(soundWanted);publish();}
  function toggleCamera(){if(mode!=='race')return;cameraMode=cameraMode==='chase'?'first-person':'chase';cameraSnap=true;if(!paused)renderer.domElement.focus({preventScroll:true});publish();}
  function toggleMusic(){const state=music.status();music.setEnabled(state.failed||state.blocked?true:!state.wanted);publish();}
  function updateStep(){
    countdown-=STEP;const running=countdown<=0&&!result;
    if(running)elapsed+=STEP;
    const rivalInputs=running?rivalPlanner.update(cars,STEP):new Map();
    for(const c of cars){
      c.previous=c.state;
      const input=!running||c.finish!==null?{brake:1}:c.player?drivingInput.read():rivalInputs.get(c);
      c.waitingForTraffic=!!input.waitingForTraffic;
      c.sim.step(input,false);
    }
    stepVehicleWorld(world,raceContacts.queue);
    raceContacts.finish(cars,STEP,(car,hit)=>{if(running){if(car.player){cameraImpact=Math.max(cameraImpact,hit.intensity);audio.impact(hit.intensity);}if(car.player||car.state.position&&Math.hypot(car.state.position.x-cars[0].state.position.x,car.state.position.z-cars[0].state.position.z)<65)sparks.emit(hit);}});
    sparks.update(STEP);
    for(const c of cars){
      c.state=c.sim.finishStep();const nearest=nearestRoute(route,c.state.position,c.index);c.index=nearest.index;
      c.recovery.age+=STEP;
      const recoveryReason=running&&c.finish===null?c.recoveryWatch.update(c.state,nearest.point.y,STEP):null;
      // Inverted/underground motion must not collect race progress.
      const q=c.state.rotation,upright=1-2*(q.x*q.x+q.z*q.z)>.25;
      if(running&&c.finish===null&&upright&&c.state.position.y>=nearest.point.y-6)c.progress+=forwardProgress(c.routeDistance,nearest.point.distance,route.length);
      c.routeDistance=nearest.point.distance;
      if(recoveryReason){recover(c,recoveryReason);continue;}
      if(c.progress>=route.length&&c.finish===null)c.finish=elapsed;
      if(!c.player&&running&&c.finish===null){c.stuck=(c.state.kmh<8&&!c.waitingForTraffic)||nearest.distance>22||c.state.position.y<nearest.point.y-6?c.stuck+STEP:0;if(c.stuck>5)recover(c);}
    }
    if(cars[0].finish!==null&&!result){const place=1+cars.slice(1).filter(c=>c.finish!==null&&c.finish<cars[0].finish).length;result={place,time:elapsed};drivingInput.clear();music.setPaused(true);}
    const p=cars[0],feedback=signals.update(p.previous,p.state,STEP);latestFeedback=feedback;smoke.update(p.state,feedback,STEP);exhaust.update(p.state,p.exhaustPoints,STEP,{enabled:!result});trails.update(p.state,feedback,STEP);audio.update(p.state,feedback);audio.setPaused(!running||!!result);
  }
  function render(now){
    if(!alive)return;const rawDt=Math.max(0,(now-last)/1000),dt=Math.min(.05,rawDt);last=now;
    if(mode==='race'){
      if(!paused)clock.advance(rawDt,updateStep);
      cars.forEach(c=>poseVehicle(c.view,c.state,.6,c.previous,paused?1:clock.alpha()));
      const p=cars[0],forward=new THREE.Vector3(0,0,1).applyQuaternion(p.view.root.quaternion);
      const presentedPosition=p.view.root.position.clone().add(new THREE.Vector3(0,.6,0).applyQuaternion(p.view.root.quaternion));
      p.view.root.visible=cameraMode!=='first-person';
      cockpit.update(p.state,cameraMode==='first-person',RACE_TUNING[selected].redline,{compact:host.clientWidth<700,music:music.status(),now});
      if(cameraMode==='first-person')firstPerson.update(p.view.root.position,p.view.root.quaternion,paused?0:dt,{snap:cameraSnap,roof:RACE_TUNING[selected].roof,width:RACE_TUNING[selected].width,compact:host.clientWidth<700});
      else {camera.near=.15;chase.update(presentedPosition,forward,p.state.kmh,paused?0:dt,{snap:cameraSnap,compact:host.clientWidth<700,motion:!reducedMotion,push:latestFeedback.push,braking:latestFeedback.braking,boost:p.state.action?.active,impact:cameraImpact,stableRide:true});}
      cameraSnap=false;cameraImpact=0;
      // The shadow and visible chassis must use the same interpolated frame.
      sun.position.copy(presentedPosition).add(new THREE.Vector3(-25,45,20));sun.target.position.copy(presentedPosition);
    }else {controls.update();garageBackdrop.update(camera);}
    music.update(dt);
    if(sky.visible)sky.position.copy(camera.position);
    renderer.info.reset();renderer.render(scene,camera);frames++;
    if(!paused)frameMetrics.record(now,renderer.info.render);
    if(now-fpsStart>1000){fps=Math.round(frames*1000/(now-fpsStart));frames=0;fpsStart=now;}
    if(now-reportTime>100){publish();reportTime=now;}
    frame=requestAnimationFrame(render);
  }
  function fitGarageCamera(){
    const factor=host.clientWidth<700?Math.max(1.25,.9/(host.clientWidth/host.clientHeight)):1;
    controls.target.set(0,.85,0);camera.position.set(5.8*factor,.85+1.95*factor,7.6*factor);controls.maxDistance=Math.max(14,20*factor);controls.update();
  }
  let previousLayout=null;
  function resize(){const {width,height}=host.getBoundingClientRect();if(!width||!height)return;const layout=raceLayout(width,height);if(previousLayout!==null&&layout!==previousLayout&&mode==='race')pause(true,'layout');previousLayout=layout;renderer.setSize(width,height,false);camera.aspect=width/height;if(mode==='garage')fitGarageCamera();camera.updateProjectionMatrix();smoke.setViewport(height*renderer.getPixelRatio());}
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const keyActions={input:drivingInput,inRace:()=>mode==='race',canDrive:()=>!paused&&!result&&presentationGuard.canDrive(),pause:()=>pause(!paused),recover:()=>recover(),restart:startRace,mute:toggleSound,camera:toggleCamera};
  const keydown=e=>handleRaceKeyDown(e,keyActions);
  const keyup=e=>drivingInput.release(e.code),blur=()=>pause(true,'focus');
  function visibility(){if(document.hidden){pause(true,'focus');cancelAnimationFrame(frame);}else if(alive){last=performance.now();frame=requestAnimationFrame(render);}}
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
  setGarage();frame=requestAnimationFrame(render);
  return {presentation:next=>presentationGuard.update(next),select:setGarage,start:startRace,garage:()=>setGarage(),pause:()=>pause(!paused),sound:toggleSound,camera:toggleCamera,music:toggleMusic,musicTrack:id=>{Promise.resolve(music.select(id)).then(()=>{if(alive)publish();});publish();},musicVolume:value=>{music.setVolume(value);publish();},recover:()=>{if(mode==='race'&&!paused&&!result)recover();},input(code,value,source='touch'){if(!value)drivingInput.release(code,source);else if(mode==='race'&&!paused&&!result&&presentationGuard.canDrive())drivingInput.press(code,source);},dispose(){
    if(!alive)return;alive=false;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);
    audio.dispose();music.dispose();cars.forEach(c=>c.sim.dispose());raceContacts.dispose();world.free();
    createSceneDisposer(scene,{renderTargets:[environment,outdoorEnvironment]})();display?.dispose();cars.forEach(c=>c.view.dispose());renderer.dispose();renderer.domElement.remove();delete window.__mumuRebuild;
  }};
}
