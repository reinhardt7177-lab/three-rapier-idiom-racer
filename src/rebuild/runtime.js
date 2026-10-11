import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {Sky} from 'three/addons/objects/Sky.js';
import { loadRebuildAssets,createVehicleView,poseVehicle,VEHICLES } from './assets.js';
import { createVehiclePhysics,initPhysics,STEP,stepVehicleWorld } from '../driving/physics.js';
import {PLAYER_STEERING_SENSITIVITY} from '../driving/steering.js';
import { createChaseCamera } from '../driving/chaseCamera.js';
import { createDrivingSignals } from '../driving/drivingSignals.js';
import { createTireSmoke } from '../driving/tireSmoke.js';
import { createTireFeedback } from '../driving/tireFeedback.js';
import { createDrivingAudio } from '../driving/drivingAudio.js';
import { createSceneDisposer } from '../rendering/sceneResources.js';
import { nearestRoute,routePose,forwardProgress,aiInput } from './course.js';
import { RACE_TUNING,RACE_GRID_LANE,playerRaceTuning } from './vehicleDynamics.js';
import { createRaceContacts } from './raceContacts.js';
import { createImpactSparks } from './impactSparks.js';
import { recoveredCollider } from './worldCollision.js';
import {createNamakBarriers} from './namakBarriers.js';
import { createRaceInput,handleRaceKeyDown,raceLayout } from './raceInput.js';
import {batchWorldScenery,createFrameMetrics} from './worldRendering.js';
import {createExhaustVfx,exhaustPoints} from './exhaustVfx.js';
import {modelPosition,roadRecoveryPose,createRecoveryWatch,findRecoveryPose,recoveryProgressChange} from './vehiclePose.js';
import {rivalFleet} from './fleet.js';
import {createGarageBackdrop} from './garageBackdrop.js';
import {createRaceClock} from './raceClock.js';
import {routeGuidance} from './routeGuidance.js';
import {polishWorldSurfaces} from './surfacePolish.js';
import {createRivalPlanner} from './rivalPlanner.js';
import {createOvertakeRoadCheck} from './overtakeRoad.js';
import {createRaceMusic} from './raceMusic.js';
import {createFirstPersonCamera} from './firstPersonCamera.js';
import {difficultyById,difficultyPace,gridSlot,loadDifficulty,saveDifficulty} from './raceDifficulty.js';
import {createSurfaceMap,touchingWall} from './raceSurface.js';
import {LAP_OPTIONS,loadLaps,saveLaps,bestRecord,submitRecord,medalTimes,medalFor,lapInfo} from './raceRecords.js';
import {createGhostRecorder,ghostPose,loadGhost,saveGhost} from './raceGhost.js';
import {RACE_NITRO,OVERTAKE_CHARGE,slipstream,createOvertakeCounter,loadAssist,saveAssist} from './raceRules.js';
import {createCockpit} from './cockpit.js';
import {MUSIC_TRACKS} from './musicTracks.js';
import {createPresentationGuard} from './landscape.js';
import {TRACKS} from './tracks.js';
import {createNamakPresentation,outdoorLighting} from './namakPresentation.js';
import {applyNamakColors,outdoorAtmosphere,tintNamakSky} from './namakColors.js';
import {createNamakLandmarks} from './namakLandmarks.js';
import {createNightPresentation,NIGHT_LIGHTING,NIGHT_ATMOSPHERE} from './nightPresentation.js';
import {createPauseRendering} from './renderTiming.js';

export async function createRebuild(host,signal,onState,onLoading,track=TRACKS[0]) {
  await initPhysics();
  const assets=await loadRebuildAssets(onLoading,track);
  const namak=track.id==='namak',bounded=namak||track.bounded,lighting=track.night?NIGHT_LIGHTING:outdoorLighting(namak),atmosphere=track.night?NIGHT_ATMOSPHERE:outdoorAtmosphere(namak);
  const all=new THREE.Group();all.add(assets.world,assets.garage,assets.cockpit,...Object.values(assets.cars));
  if(signal.aborted){createSceneDisposer(all)();return null;}
  let renderer;
  try {renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}
  catch(error){createSceneDisposer(all)();throw error;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.info.autoReset=false;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  host.appendChild(renderer.domElement);renderer.domElement.tabIndex=0;
  renderer.domElement.setAttribute('aria-label',`MUMU CIRCUIT · Blender 차량과 ${track.name} 레이스`);
  const scene=new THREE.Scene();scene.add(all);scene.background=new THREE.Color('#090e18');
  const night=track.night?createNightPresentation(scene,assets.roads):null;
  Object.values(assets.cars).forEach(c=>c.visible=false);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.035);
  const sky=new Sky();sky.scale.setScalar(1000);
  sky.material.uniforms.turbidity.value=atmosphere.turbidity;sky.material.uniforms.rayleigh.value=atmosphere.rayleigh;
  sky.material.uniforms.mieCoefficient.value=atmosphere.mieCoefficient;
  if(namak)tintNamakSky(sky);
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
  const roads=[],asphalt=new Set(),surfaceMap=createSurfaceMap();let colliderCount=0;
  assets.world.traverse(o=>{
    if(!o.isMesh)return;
    if(o.name.includes('Road_Asphalt'))roads.push(o);
    if(!o.userData.unity_collider)return;
    if(namak&&o.name.startsWith('RaceBarrier_'))return;
    const position=o.geometry.attributes.position,vertices=new Float32Array(position.count*3),v=new THREE.Vector3();
    for(let i=0;i<position.count;i++){v.fromBufferAttribute(position,i).applyMatrix4(o.matrixWorld);vertices.set([v.x,v.y,v.z],i*3);}
    const indices=o.geometry.index?new Uint32Array(o.geometry.index.array):Uint32Array.from({length:position.count},(_,i)=>i);
    const collider=world.createCollider(recoveredCollider(vertices,indices));colliderCount++;
    surfaceMap.add(collider.handle,o.name);
    if(o.name.includes('Road_Asphalt'))asphalt.add(collider.handle);
  });
  if(namak)for(const {collider,name} of createNamakBarriers(world,assets.roads)){surfaceMap.add(collider.handle,name);colliderCount++;}
  const presentation=namak?createNamakPresentation(assets.world,assets.cars):null;
  const landmarks=assets.landmarks?createNamakLandmarks(assets.landmarks):null;
  const surfaces=polishWorldSurfaces(assets.world,{namak}),colors=namak?applyNamakColors(assets.world):null;
  const scenery=batchWorldScenery(assets.world),frameMetrics=createFrameMetrics(),pauseRendering=createPauseRendering();
  // Collision heights are recovered geometry, not a flat substitute under hills.
  const ray=new THREE.Raycaster(),route=assets.roads;
  const roadClear=createOvertakeRoadCheck(world,route,asphalt),storage=()=>{try{return window.localStorage;}catch{return null;}};
  let difficulty=difficultyById(loadDifficulty(storage())),assist=loadAssist(storage()),nitroBonus={amount:0,age:100};
  const overtakes=createOvertakeCounter();
  // Laps chosen in the garage; raceLaps is fixed for the race in progress.
  let laps=loadLaps(storage()),raceLaps=laps,best=bestRecord(storage(),track.id,laps),ghost=null,ghostView=null,ghostRecorder=null,lapStart=0,lapTimes=[],playerLap=1;
  function clearGhost(){ghostView?.dispose();ghostView?.root.removeFromParent();ghostView=null;ghost=null;ghostRecorder=null;}
  function showGhost(){
    ghost=loadGhost(storage(),track.id,raceLaps);
    if(!ghost||!assets.cars[ghost.vehicle]){ghost=null;return;}
    ghostView=createVehicleView(assets.cars[ghost.vehicle],ghost.vehicle,{vivid:namak});
    // Translucent, shadowless and never a physics body: it cannot be hit.
    ghostView.root.traverse(o=>{if(!o.isMesh)return;o.castShadow=o.receiveShadow=false;o.renderOrder=2;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.transparent=true;m.opacity=.36;m.depthWrite=false;m.needsUpdate=true;}});
    ghostView.root.visible=false;scene.add(ghostView.root);
  }
  const planRivals=()=>createRivalPlanner(route,{roadClear,speedProfile:difficulty.profile,nitro:difficulty.nitro});
  let rivalPlanner=planRivals();
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
  const music=createRaceMusic(MUSIC_TRACKS.map(t=>({...t,url:`${import.meta.env.BASE_URL}assets/audio/${t.file}`})),{storage});
  let cameraMode='chase';
  const drivingInput=createRaceInput(),clock=createRaceClock(STEP);let mode='garage',selected='supra',display=null,cars=[],paused=false,pauseReason='',countdown=3,elapsed=0,result=null,alive=true,frame=0,last=performance.now(),reportTime=0,cameraSnap=true,frames=0,fps=0,fpsStart=last,soundWanted=true;
  const startIndex=25;
  // Visible development QA drives the real player through pedals, with no
  // position, timer, lap or progress changes. Disabled in production builds.
  let qaDriver=false;
  function publish(){
    pauseRendering.invalidate();
    const ordered=[...cars].sort((a,b)=>(b.finish!==null)-(a.finish!==null)||(a.finish!==null&&b.finish!==null?a.finish-b.finish:b.progress-a.progress||a.slot-b.slot));
    const player=cars[0];
    const state={mode,selected,paused,countdown:Math.max(0,Math.ceil(countdown)),elapsed,result,kmh:Math.round(player?.state.kmh||0),gear:player?.state.gear||'N',place:Math.max(1,ordered.findIndex(c=>c.player)+1),progress:Math.min(1,Math.max(0,(player?.progress||0)/(route.length*raceLaps))),region:player?route.points[player.index].region:'GARAGE',nitro:(player?.state.action?.charge??100)/100,standings:ordered.map(c=>({name:c.name,progress:c.progress,finished:c.finish!==null})),fps,colliderCount,contacts:player?.state.contacts??0,position:player?.state.position,ai:cars.slice(1).map(c=>({position:c.state.position,kmh:c.state.kmh,progress:c.progress,contacts:c.state.contacts})),cameraDistance:player?camera.position.distanceTo(new THREE.Vector3().copy(player.state.position)):0};
    if(player){state.redline=RACE_TUNING[selected].redline;state.rpm=Math.round(player.state.powertrain?.rpm||850);state.shifting=player.state.powertrain?.shifting||false;state.mass=player.state.mass;state.steeringSensitivity=player.state.steeringSensitivity;state.steeringLimit=player.state.steeringLimit;state.steer=player.state.steer;state.wheels=player.state.wheels;state.impact=player.impact;state.rotation=player.state.rotation;state.angularVelocity=player.state.angularVelocity;state.recovery=player.recovery;state.ride=player.state.ride;state.velocity=player.state.velocity;}
    if(player){state.guidance=routeGuidance(route,player.index,player.progress,route.length*raceLaps);state.lap=lapInfo(player.progress,route.length,raceLaps).lap;state.lapTimes=lapTimes;}
    state.laps=mode==='race'?raceLaps:laps;state.lapOptions=LAP_OPTIONS;state.best=best;state.medals=medalTimes(track.id,state.laps);state.ghost=ghost?{vehicle:ghost.vehicle,time:ghost.time}:null;
    state.timing=clock.snapshot();state.camera={position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov};
    state.input=drivingInput.read();state.pauseReason=pauseReason;state.track={id:track.id,name:track.name,length:route.length};
    state.audio={...audio.status(),wanted:soundWanted};
    state.difficulty=difficulty.id;state.assist=assist;state.nitroBonus=nitroBonus;if(player){state.surface=player.state.surface;state.draft=player.state.draft;}
    state.music=music.status();state.cameraMode=cameraMode;state.cockpit=cockpit.status();
    state.rendering={...frameMetrics.snapshot(),pageVisible:document.visibilityState==='visible',pauseRendering:{...pauseRendering.stats},scenery,surfaces,presentation:presentation?.stats,landmarks:landmarks?.stats,night:night?.stats,lighting,atmosphere,colors,pixelRatio:renderer.getPixelRatio(),width:host.clientWidth,height:host.clientHeight};
    state.loading=assets.loading;
    state.finishOrder=ordered.map(c=>({name:c.name,time:c.finish,finished:c.finish!==null}));
    if(import.meta.env.DEV)state.qaDriver=qaDriver;
    state.vfx={tireSmoke:smoke.stats(),exhaust:exhaust.stats(),trails:trails.stats(),feedback:latestFeedback};
    state.ai.forEach((s,i)=>{const car=cars[i+1];s.waitingForTraffic=!!car.waitingForTraffic;s.name=car.name;s.vehicle=car.id;s.maneuver=rivalPlanner.snapshot(car);s.recovery=car.recovery;});
    window.__mumuRebuild=state;onState(state);
  }
  function setGarage(id=selected){
    rivalPlanner.reset();
    frameMetrics.reset();
    selected=id;mode='garage';paused=false;pauseReason='';result=null;drivingInput.clear();audio.setPaused(true);audio.setVehicle(id);music.stop();
    cockpit.update(null,false);
    cars.forEach(c=>{c.sim.dispose();c.view.dispose();c.view.root.removeFromParent();});cars=[];clearGhost();raceLaps=laps;
    display?.dispose();display?.root.removeFromParent();display=createVehicleView(assets.cars[id],id,{vivid:namak});scene.add(display.root);display.root.position.y=-display.floorOffset;display.root.rotation.y=-.35;
    assets.world.visible=false;assets.garage.visible=true;smoke.clear();exhaust.clear();trails.clear();signals.reset();sparks.clear();raceContacts.clear();latestFeedback={};cameraImpact=0;
    sky.visible=false;scene.background.set('#090e18');scene.fog=null;scene.environment=environment.texture;scene.environmentIntensity=.85;ambient.intensity=.6;fill.visible=true;ceiling.visible=true;sun.intensity=1.9;sun.castShadow=true;fill.intensity=.9;renderer.toneMappingExposure=.95;
    camera.fov=40;camera.near=.15;controls.enabled=true;fitGarageCamera();camera.updateProjectionMatrix();
    sun.position.set(4,8,3);sun.target.position.set(0,0,0);publish();
  }
  function startRace(){
    if(!presentationGuard.canDrive())return;
    rivalPlanner=planRivals();overtakes.reset();nitroBonus={amount:0,age:100};
    clearGhost();raceLaps=laps;lapStart=0;lapTimes=[];playerLap=1;showGhost();ghostRecorder=createGhostRecorder(selected);
    frameMetrics.reset();
    audio.setPaused(true);audio.setVehicle(selected);
    audio.setEnabled(soundWanted).then(()=>{if(alive)publish();});
    music.setMaster(soundWanted);music.start().then(()=>{if(alive)publish();});
    display?.dispose();display?.root.removeFromParent();display=null;drivingInput.clear();mode='race';paused=false;pauseReason='';result=null;countdown=3;elapsed=0;clock.reset();cameraSnap=true;
    cars.forEach(c=>{c.sim.dispose();c.view.dispose();c.view.root.removeFromParent();});cars=[];
    assets.world.visible=true;assets.garage.visible=false;controls.enabled=false;sky.visible=!track.night;scene.background.set(atmosphere.fog);scene.fog=new THREE.Fog(atmosphere.fog,lighting.fogNear,lighting.fogFar);scene.environment=track.night?environment.texture:outdoorEnvironment.texture;sun.castShadow=!track.night;scene.environmentIntensity=lighting.environment;ambient.intensity=lighting.ambient;fill.visible=false;ceiling.visible=false;sun.intensity=lighting.sun;renderer.toneMappingExposure=lighting.exposure;
    for(let i=0;i<6;i++){
      const id=i===0?selected:rivalFleet(selected)[i-1],slot=gridSlot(i),lane=slot%2===0?-RACE_GRID_LANE:RACE_GRID_LANE,index=startIndex-Math.floor(slot/2)*(track.gridRowStep??4);
      const view=createVehicleView(assets.cars[id],id,{vivid:namak});scene.add(view.root);
      const p=spawn(index,lane,view.spec),sim=createVehiclePhysics({sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,start:p.position,spec:view.spec,raceTuning:i===0?playerRaceTuning(id):RACE_TUNING[id],steeringSensitivity:i===0?PLAYER_STEERING_SENSITIVITY:1,surface:surfaceMap.surface,nitro:i===0?RACE_NITRO:difficulty.rivalNitro??RACE_NITRO,recoveryAssist:i===0?assist:true});sim.reset(p.position,p.yaw,{stepWorld:false,rotation:p.rotation});
      const state=sim.snapshot();cars.push({id,sim,view,recoveryWatch:createRecoveryWatch({roadHalfWidth:bounded?route.width/2:Infinity}),recovery:{count:0,reason:'',age:100},exhaustPoints:exhaustPoints(id),player:i===0,name:i===0?'YOU':['NOVA','RAVEN','BLAZE','MIST','LUNA'][i-1],lane,pace:difficultyPace(difficulty,i-1),index,routeDistance:route.points[index].distance,progress:route.points[index].distance-route.points[startIndex].distance,state,previous:state,finish:null,stuck:0,scrape:false,draft:0,slot});
    }
    for(let i=0;i<120;i++){cars.forEach(c=>c.sim.step({brake:1},false));stepVehicleWorld(world);cars.forEach(c=>{c.state=c.previous=c.sim.finishStep();});}
    signals.reset();smoke.clear();exhaust.clear();trails.clear();sparks.clear();raceContacts.clear();latestFeedback={};cameraImpact=0;audio.setPaused(true);renderer.domElement.focus({preventScroll:true});last=performance.now();publish();
  }
  function recover(car=cars[0],reason='manual'){
    if(!car)return;
    const traffic=cars.filter(c=>c!==car).map(c=>c.state);
    // Search backwards only: recovery must never grant a position advantage.
    const found=findRecoveryPose(route,car.index,[car.lane,-car.lane,0],traffic,(index,lane)=>spawn(index,lane,car.view.spec));
    if(!found)return false;
    const {pose,index:recoveryIndex,lane:recoveryLane}=found;
    car.progress+=recoveryProgressChange(car.routeDistance,route.points[recoveryIndex].distance,route.length);
    car.index=recoveryIndex;car.routeDistance=route.points[recoveryIndex].distance;
    car.sim.reset(pose.position,pose.yaw,{stepWorld:false,rotation:pose.rotation,preserveCharge:true});car.state=car.previous=car.sim.snapshot();car.stuck=car.waited=0;
    car.recoveryWatch.reset();car.recovery={count:car.recovery.count+1,reason,age:0};
    if(!car.player)rivalPlanner.reset(car,recoveryLane);
    car.impact={count:0,intensity:0,deltaV:0,age:100};
    if(car.player){drivingInput.clear();audio.reset();cameraSnap=true;signals.reset();smoke.clear();exhaust.clear();trails.clear();cameraImpact=0;latestFeedback={};}
    return true;
  }
  function pause(value,reason='manual'){if(mode!=='race'||(!value&&!presentationGuard.canDrive()))return;paused=value;pauseReason=value?reason:'';drivingInput.clear();clock.reset();last=performance.now();fpsStart=last;frames=0;frameMetrics.reset();audio.setPaused(value||countdown>0||!!result);music.setPaused(value||!!result);publish();if(!value){renderer.domElement.focus({preventScroll:true});music.resume();if(soundWanted&&audio.status().state!=='running')audio.setEnabled(true).then(()=>{if(alive)publish();});}}
  const presentationGuard=createPresentationGuard({clear:()=>drivingInput.clear(),pause:reason=>pause(true,reason)});
  function toggleSound(){soundWanted=!soundWanted;audio.setEnabled(soundWanted).then(()=>{if(alive)publish();});music.setMaster(soundWanted);publish();}
  function toggleCamera(){if(mode!=='race')return;cameraMode=cameraMode==='chase'?'first-person':'chase';cameraSnap=true;if(!paused)renderer.domElement.focus({preventScroll:true});publish();}
  function toggleMusic(){const state=music.status();music.setEnabled(state.failed||state.blocked?true:!state.wanted);publish();}
  function updateStep(){
    // A player's result must not stop unfinished rivals: a championship needs
    // six actual finish times, rather than provisional progress rankings.
    countdown-=STEP;const running=countdown<=0&&cars.some(c=>c.finish===null);
    if(running)elapsed+=STEP;
    const rivalInputs=running?rivalPlanner.update(cars,STEP):new Map();
    for(const c of cars)c.draft=running&&c.finish===null?slipstream(c.state,cars.filter(o=>o!==c).map(o=>o.state)):0;
    for(const c of cars){
      c.previous=c.state;
      const input=!running?{brake:1}:c.finish!==null?(!c.player&&c.finishRunout<50?aiInput(route,c.state,c.index,c.finishLane,c.pace,cars.filter(o=>o!==c).map(o=>o.state),{speedProfile:difficulty.profile,speedLimit:55}):{brake:1}):c.player?(import.meta.env.DEV&&qaDriver?aiInput(route,c.state,c.index,c.lane,1,cars.filter(o=>o!==c).map(o=>o.state),{speedProfile:difficultyById('hard').profile}):drivingInput.read()):rivalInputs.get(c);
      c.waitingForTraffic=!!input.waitingForTraffic;
      c.sim.step(c.scrape||c.draft?{...input,scrape:c.scrape?1:0,draft:c.draft}:input,false);
    }
    stepVehicleWorld(world,raceContacts.queue);
    raceContacts.finish(cars,STEP,(car,hit)=>{if(running){if(car.player){cameraImpact=Math.max(cameraImpact,hit.intensity);audio.impact(hit.intensity);}if(car.player||car.state.position&&Math.hypot(car.state.position.x-cars[0].state.position.x,car.state.position.z-cars[0].state.position.z)<65)sparks.emit(hit);}});
    sparks.update(STEP);
    for(const c of cars){
      c.state=c.sim.finishStep();c.scrape=running&&touchingWall(world,c.sim.colliders,surfaceMap.isWall);const nearest=nearestRoute(route,c.state.position,c.index);c.index=nearest.index;
      c.recovery.age+=STEP;
      const recoveryReason=running&&c.finish===null?c.recoveryWatch.update(c.state,nearest.point.y,STEP,nearest.distance):null;
      // Inverted, underground or outside-wall motion must not collect race progress.
      const q=c.state.rotation,upright=1-2*(q.x*q.x+q.z*q.z)>.25;
      if(running&&c.finish===null&&upright&&(!bounded||nearest.distance<=route.width/2+1)&&c.state.position.y>=nearest.point.y-6)c.progress+=forwardProgress(c.routeDistance,nearest.point.distance,route.length);
      if(c.finish!==null&&!c.player)c.finishRunout+=Math.max(0,forwardProgress(c.routeDistance,nearest.point.distance,route.length));
      c.routeDistance=nearest.point.distance;
      if(recoveryReason){recover(c,recoveryReason);continue;}
      if(c.progress>=route.length*raceLaps&&c.finish===null){
        c.finish=elapsed;c.finishRunout=0;
        c.finishLane=(c.state.position.x-nearest.point.x)*nearest.point.dz-(c.state.position.z-nearest.point.z)*nearest.point.dx;
        if(!c.player)rivalPlanner.reset(c,c.finishLane);
      }
      if(!c.player&&running&&c.finish===null){
        c.stuck=(c.state.kmh<8&&!c.waitingForTraffic)||nearest.distance>22||c.state.position.y<nearest.point.y-6?c.stuck+STEP:0;
        // Waiting for traffic is legitimate, but never for longer than this.
        c.waited=c.state.kmh<8?(c.waited||0)+STEP:0;
        // A failed search (no clear space) retries after two seconds, not every step.
        if((c.stuck>5||c.waited>15)&&!recover(c,c.stuck>5?'stuck':'blocked')){c.stuck=Math.min(c.stuck,3);c.waited=Math.min(c.waited,13);}
      }
    }
    nitroBonus.age+=STEP;
    if(running&&cars[0].finish===null){
      ghostRecorder?.record(elapsed,cars[0].state);
      const {lap}=lapInfo(cars[0].progress,route.length,raceLaps);
      if(lap>playerLap){lapTimes=[...lapTimes,elapsed-lapStart];lapStart=elapsed;playerLap=lap;}
    }
    if(running&&cars[0].finish===null){const passes=overtakes.update(cars[0],cars.slice(1));if(passes){cars[0].sim.addCharge(OVERTAKE_CHARGE*passes);nitroBonus={amount:OVERTAKE_CHARGE*passes,age:0};}}
    if(cars[0].finish!==null&&!result){const place=1+cars.slice(1).filter(c=>c.finish!==null&&c.finish<cars[0].finish).length;lapTimes=[...lapTimes,cars[0].finish-lapStart];
      const record=submitRecord(storage(),track.id,raceLaps,{time:cars[0].finish,vehicle:selected,difficulty:difficulty.id,place,date:new Date().toLocaleDateString('sv-SE')});best=record.best;
      const ghostSaved=record.improved&&ghostRecorder?saveGhost(storage(),track.id,raceLaps,ghostRecorder.finish(cars[0].finish)):false;
      result={place,time:cars[0].finish,difficulty:difficulty.id,laps:raceLaps,lapTimes,bestLap:Math.min(...lapTimes),improved:record.improved,previous:record.previous?.time??null,medal:medalFor(cars[0].finish,medalTimes(track.id,raceLaps)),ghostSaved};drivingInput.clear();music.setPaused(true);}
    const p=cars[0],feedback=signals.update(p.previous,p.state,STEP);latestFeedback=feedback;smoke.update(p.state,feedback,STEP);exhaust.update(p.state,p.exhaustPoints,STEP,{enabled:!result});trails.update(p.state,feedback,STEP);audio.update(p.state,feedback);audio.setPaused(!running||!!result);
  }
  function render(now){
    if(!alive)return;
    if(!pauseRendering.draw(paused)){last=now;frame=requestAnimationFrame(render);return;}
    const workStart=performance.now();let physicsMs=0;
    const rawDt=Math.max(0,(now-last)/1000),dt=Math.min(.05,rawDt);last=now;
    if(mode==='race'){
      if(!paused){const physicsStart=performance.now();clock.advance(rawDt,updateStep);physicsMs=performance.now()-physicsStart;}
      cars.forEach(c=>poseVehicle(c.view,c.state,.6,c.previous,paused?1:clock.alpha()));
      if(ghostView){
        const pose=countdown<=0&&!result?ghostPose(ghost,elapsed+(paused?0:clock.alpha()*STEP)):null;
        ghostView.root.visible=!!pose;
        if(pose){ghostView.root.quaternion.set(pose.rotation.x,pose.rotation.y,pose.rotation.z,pose.rotation.w);ghostView.root.position.copy(modelPosition(new THREE.Vector3(pose.position.x,pose.position.y,pose.position.z),ghostView.root.quaternion,.6));}
      }
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
    night?.update(cars[0]?.state,cars[0]?.index??0,mode==='race');
    presentation?.update(camera);
    landmarks?.update(camera,assets.world.visible);
    const renderStart=performance.now();renderer.info.reset();renderer.render(scene,camera);const renderMs=performance.now()-renderStart;frames++;
    if(!paused)frameMetrics.record(now,renderer.info.render,{workMs:performance.now()-workStart,physicsMs,renderMs});
    if(now-fpsStart>1000){fps=Math.round(frames*1000/(now-fpsStart));frames=0;fpsStart=now;}
    if(now-reportTime>100){publish();reportTime=now;}
    frame=requestAnimationFrame(render);
  }
  function fitGarageCamera(){
    const factor=host.clientWidth<700?Math.max(1.25,.9/(host.clientWidth/host.clientHeight)):1;
    controls.target.set(0,.85,0);camera.position.set(5.8*factor,.85+1.95*factor,7.6*factor);controls.maxDistance=Math.max(14,20*factor);controls.update();
  }
  let previousLayout=null;
  function resize(){pauseRendering.invalidate();const {width,height}=host.getBoundingClientRect();if(!width||!height)return;const layout=raceLayout(width,height);if(previousLayout!==null&&layout!==previousLayout&&mode==='race')pause(true,'layout');previousLayout=layout;renderer.setSize(width,height,false);camera.aspect=width/height;if(mode==='garage')fitGarageCamera();camera.updateProjectionMatrix();smoke.setViewport(height*renderer.getPixelRatio());}
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const keyActions={input:drivingInput,inRace:()=>mode==='race',canDrive:()=>!paused&&!result&&presentationGuard.canDrive(),pause:()=>pause(!paused),recover:()=>recover(),restart:()=>{if(!result)startRace();},mute:toggleSound,camera:toggleCamera};
  const keydown=e=>handleRaceKeyDown(e,keyActions);
  const keyup=e=>drivingInput.release(e.code),blur=()=>pause(true,'focus');
  function visibility(){if(document.hidden){pause(true,'focus');cancelAnimationFrame(frame);}else if(alive){last=performance.now();cancelAnimationFrame(frame);frame=requestAnimationFrame(render);}}
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
  setGarage();frame=requestAnimationFrame(render);
  return {qa:import.meta.env.DEV?{driver(value){qaDriver=!!value;drivingInput.clear();publish();}}:undefined,presentation:next=>presentationGuard.update(next),select:setGarage,start:startRace,assist:()=>{assist=!assist;saveAssist(storage(),assist);if(cars[0]?.player)cars[0].sim.setRecoveryAssist(assist);publish();},laps:n=>{if(mode!=='garage'||!LAP_OPTIONS.includes(n))return;laps=raceLaps=n;saveLaps(storage(),n);best=bestRecord(storage(),track.id,n);publish();},difficulty:id=>{if(mode!=='garage')return;difficulty=difficultyById(id);saveDifficulty(storage(),difficulty.id);publish();},garage:()=>setGarage(),pause:()=>pause(!paused),sound:toggleSound,camera:toggleCamera,music:toggleMusic,musicTrack:id=>{Promise.resolve(music.select(id)).then(()=>{if(alive)publish();});publish();},musicVolume:value=>{music.setVolume(value);publish();},recover:()=>{if(mode==='race'&&!paused&&!result)recover();},input(code,value,source='touch'){if(!value)drivingInput.release(code,source);else if(mode==='race'&&!paused&&!result&&presentationGuard.canDrive())drivingInput.press(code,source);},dispose(){
    if(!alive)return;alive=false;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);
    night?.dispose();audio.dispose();music.dispose();cars.forEach(c=>c.sim.dispose());raceContacts.dispose();world.free();
    createSceneDisposer(scene,{renderTargets:[environment,outdoorEnvironment]})();display?.dispose();cars.forEach(c=>c.view.dispose());clearGhost();renderer.dispose();renderer.domElement.remove();delete window.__mumuRebuild;
  }};
}
