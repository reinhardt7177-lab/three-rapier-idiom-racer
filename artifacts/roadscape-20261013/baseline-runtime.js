import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {Sky} from 'three/addons/objects/Sky.js';
import { loadRebuildAssets,createVehicleView,poseVehicle,VEHICLES } from '/src/rebuild/assets.js';
import { createVehiclePhysics,initPhysics,STEP,stepVehicleWorld } from '/src/driving/physics.js';
import {PLAYER_STEERING_SENSITIVITY} from '/src/driving/steering.js';
import { createChaseCamera } from '/src/driving/chaseCamera.js';
import { createDrivingSignals } from '/src/driving/drivingSignals.js';
import { createTireSmoke } from '/src/driving/tireSmoke.js';
import { createTireFeedback } from '/src/driving/tireFeedback.js';
import { createDrivingAudio } from '/src/driving/drivingAudio.js';
import { createSceneDisposer } from '/src/rendering/sceneResources.js';
import { nearestRoute,routePose,forwardProgress,aiInput } from '/src/rebuild/course.js';
import { RACE_TUNING,RACE_GRID_LANE,playerRaceTuning } from '/src/rebuild/vehicleDynamics.js';
import { createRaceContacts } from '/src/rebuild/raceContacts.js';
import { createImpactSparks } from '/src/rebuild/impactSparks.js';
import { recoveredCollider } from '/src/rebuild/worldCollision.js';
import {createNamakBarriers} from '/src/rebuild/namakBarriers.js';
import { createRaceInput,handleRaceKeyDown,raceLayout } from '/src/rebuild/raceInput.js';
import {batchWorldScenery,createFrameMetrics} from '/src/rebuild/worldRendering.js';
import {createExhaustVfx,exhaustPoints} from '/src/rebuild/exhaustVfx.js';
import {modelPosition,roadRecoveryPose,createRecoveryWatch,findRecoveryPose,recoveryProgressChange} from '/src/rebuild/vehiclePose.js';
import {raceRoster,loadRaceSetup,saveRaceSetup,normalizeRaceSetup,duelStatus,duelOutcome} from '/src/rebuild/raceMode.js';
import {duelRecord,submitDuelRecord} from '/src/rebuild/duelRecords.js';
import {createOnlineRace} from '/src/rebuild/onlineRace.js';
import {ONLINE_VERSION,ONLINE_STEP_MS,onlineRoster,packOnlineCar,ZERO_ONLINE_INPUT} from '/src/rebuild/onlineProtocol.js';
import {createGarageBackdrop} from '/src/rebuild/garageBackdrop.js';
import {createRaceClock} from '/src/rebuild/raceClock.js';
import {routeGuidance} from '/src/rebuild/routeGuidance.js';
import {polishWorldSurfaces} from '/src/rebuild/surfacePolish.js';
import {createRivalPlanner} from '/src/rebuild/rivalPlanner.js';
import {createOvertakeRoadCheck} from '/src/rebuild/overtakeRoad.js';
import {createRaceMusic} from '/src/rebuild/raceMusic.js';
import {createFirstPersonCamera} from '/src/rebuild/firstPersonCamera.js';
import {difficultyById,difficultyPace,loadDifficulty,saveDifficulty} from '/src/rebuild/raceDifficulty.js';
import {createSurfaceMap,touchingWall} from '/src/rebuild/raceSurface.js';
import {LAP_OPTIONS,loadLaps,saveLaps,bestRecord,submitRecord,medalTimes,medalFor,lapInfo} from '/src/rebuild/raceRecords.js';
import {createGhostRecorder,ghostPose,ghostVelocity,ghostVisibleFromCamera,loadGhost,saveGhost} from '/src/rebuild/raceGhost.js';
import {applyBodyMotion} from '/src/rebuild/bodyMotion.js';
import {RACE_NITRO,OVERTAKE_CHARGE,slipstream,createOvertakeCounter,loadAssist,saveAssist} from '/src/rebuild/raceRules.js';
import {createCockpit} from '/src/rebuild/cockpit.js';
import {MUSIC_TRACKS} from '/src/rebuild/musicTracks.js';
import {createPresentationGuard} from '/src/rebuild/landscape.js';
import {TRACKS} from '/src/rebuild/tracks.js';
import {createNamakPresentation,outdoorLighting} from '/src/rebuild/namakPresentation.js';
import {applyNamakColors,outdoorAtmosphere,tintNamakSky} from '/src/rebuild/namakColors.js';
import {createNamakLandmarks} from '/src/rebuild/namakLandmarks.js';
import {createNightPresentation,NIGHT_LIGHTING,NIGHT_ATMOSPHERE} from '/src/rebuild/nightPresentation.js';
import {createPauseRendering} from '/src/rebuild/renderTiming.js';
import {createRacePreparation,createRaceStartBoundary} from '/src/rebuild/racePreparation.js';
import {createRenderProfile,classifyDraw} from '/src/rebuild/renderProfile.js';
import {createFrozenComparison,createFrozenTreadTrial,createFrozenGhostTrial} from '/src/rebuild/frozenComparison.js';
import {applyKoreaPalette,MOUNTAIN_LIGHTING,MOUNTAIN_ATMOSPHERE} from '/src/rebuild/koreaPresentation.js';
import {createPerformanceRun,applyGhostComparison,PERFORMANCE_EXPERIMENTS} from '/src/rebuild/performanceComparison.js';
import {loadQuality,saveQuality,qualityById,createDecorationQuality} from '/src/rebuild/graphicsQuality.js';
import {loadWeather,saveWeather,weatherById,weatherSpeedProfile,weatherLighting,createWeatherSurfaceQuery} from '/src/rebuild/weather.js';
import {createRainVfx} from '/src/rebuild/rainVfx.js';
import {progressFromRecords,newlyUnlocked,canSelectCar,canRaceTrack} from '/src/rebuild/progression.js';
import {createRoadTraffic,TRAFFIC_BUDGET} from '/src/rebuild/roadTraffic.js';
import {createTrafficViews} from '/src/rebuild/trafficView.js';
import {createCoastalVisuals} from '/src/rebuild/coastalVisuals.js';
import {createNamakVisuals} from '/src/rebuild/namakVisuals.js';
import {createYeosuVisuals} from '/src/rebuild/yeosuVisuals.js';
import {createSeongsamjaeVisuals} from '/src/rebuild/seongsamjaeVisuals.js';
import {freezeStaticWorld} from '/src/rebuild/staticWorld.js';
import {createDaylightSky} from '/src/rebuild/daylightSky.js';

export async function createRebuild(host,signal,onState,onLoading,track=TRACKS[0]) {
  await initPhysics();
  const assets=await loadRebuildAssets(onLoading,track);
  const namak=track.id==='namak',mountain=track.id==='seongsamjae',bounded=namak||track.bounded,lighting=track.night?NIGHT_LIGHTING:mountain?MOUNTAIN_LIGHTING:outdoorLighting(namak),atmosphere=track.night?NIGHT_ATMOSPHERE:mountain?MOUNTAIN_ATMOSPHERE:outdoorAtmosphere(namak);
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
  const surfaces=polishWorldSurfaces(assets.world,{namak}),colors=namak?applyNamakColors(assets.world):applyKoreaPalette(assets.world,track.id);
  const scenery=batchWorldScenery(assets.world),frameMetrics=createFrameMetrics(import.meta.env.DEV&&new URLSearchParams(window.location.search).has('qaFrozen')?360:240),pauseRendering=createPauseRendering();
  const preparation=createRacePreparation({onChange:()=>{if(alive)publish();}});
  const raceBoundary=createRaceStartBoundary();
  // Collision heights are recovered geometry, not a flat substitute under hills.
  const ray=new THREE.Raycaster(),route=assets.roads;
  const roadClear=createOvertakeRoadCheck(world,route,asphalt),storage=()=>{try{return window.localStorage;}catch{return null;}};
  let weather=loadWeather(storage()),raceWeather=weather,raceProfile=null,qaSpeed=null;
  const rain=createRainVfx();scene.add(rain.root);
  let quality=qualityById(loadQuality(storage())),progression=progressFromRecords(storage()),restoredSeries=false;
  const daylight=track.night?null:createDaylightSky(sky,track.id,quality);
  const mapVisuals=({coastal:createCoastalVisuals,namak:createNamakVisuals,yeosu:createYeosuVisuals,seongsamjae:createSeongsamjaeVisuals})[track.id]?.(scene,assets.world,assets.roads,{quality});
  const decorationQuality=createDecorationQuality(assets.world);
  const staticWorld=freezeStaticWorld(assets.world);
  let currentWeatherLighting={lighting,atmosphere};
  const dryRoadRoughness=new Map();for(const road of roads)for(const m of Array.isArray(road.material)?road.material:[road.material])if('roughness' in m)dryRoadRoughness.set(m,m.roughness);
  function applyQuality(){
    renderer.setPixelRatio(Math.min(devicePixelRatio,quality.pixelRatio));renderer.shadowMap.enabled=quality.shadows;
    if(sun.shadow.mapSize.x!==quality.shadowSize){sun.shadow.map?.dispose();sun.shadow.map=null;sun.shadow.mapSize.set(quality.shadowSize,quality.shadowSize);}
    sun.castShadow=quality.shadows&&(mode!=='race'||!track.night);decorationQuality.set(quality.decorationDistance);
    mapVisuals?.setQuality(quality);
    daylight?.setQuality(quality);
    rain.setBudget(quality.rainParticles);resize();
  }
  let difficulty=difficultyById(loadDifficulty(storage())),assist=loadAssist(storage()),nitroBonus={amount:0,age:100};
  let raceSetup=normalizeRaceSetup({...loadRaceSetup(storage()),...(new URLSearchParams(location.search).has('room')?{mode:'online'}:{})});
  const overtakes=createOvertakeCounter();
  // Laps chosen in the garage; raceLaps is fixed for the race in progress.
  let laps=loadLaps(storage()),raceLaps=laps,best=bestRecord(storage(),track.id,laps),ghost=null,ghostView=null,ghostRecorder=null,lapStart=0,lapTimes=[],playerLap=1,ghostPreviousState=null,ghostPreviousTime=null;
  function clearGhost(){ghostView?.dispose();ghostView?.root.removeFromParent();ghostView=null;ghost=null;ghostRecorder=null;ghostPreviousState=ghostPreviousTime=null;}
  function showGhost(){
    if(!quality.ghost||raceSetup.mode!=='grid')return;
    ghost=loadGhost(storage(),track.id,raceLaps);
    if(!ghost||!assets.cars[ghost.vehicle]){ghost=null;return;}
    ghostView=createVehicleView(assets.cars[ghost.vehicle],ghost.vehicle,{vivid:namak});
    // Translucent, shadowless and never a physics body: it cannot be hit.
    ghostView.root.traverse(o=>{if(!o.isMesh)return;o.castShadow=o.receiveShadow=false;o.renderOrder=2;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.transparent=true;m.opacity=.36;m.depthWrite=false;m.needsUpdate=true;}});
    ghostView.root.visible=false;scene.add(ghostView.root);
  }
  const planRivals=()=>createRivalPlanner(route,{roadClear,speedProfile:raceProfile??difficulty.profile,nitro:difficulty.nitro,personalities:true});
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
  let qaDriverCar={},qaPlanner=null;
  let roadTraffic=null,trafficViews=null;
  function clearTraffic(){trafficViews?.dispose();trafficViews=null;roadTraffic?.dispose();roadTraffic=null;}
  let onlineSampleSeconds=ONLINE_STEP_MS/1000,lastOnlineTiming=null;
  const online=createOnlineRace({track,onChange:status=>{if(mode==='garage'&&raceSetup.mode==='online')refreshBest();if(status.requestRecovery&&mode==='race'&&!paused&&cars[1]?.finish===null)recover(cars[1]);if(alive)publish();},onPrepare:config=>{laps=raceLaps=config.laps;weather=config.weather;startRace({networkPrepare:true});},onGo:()=>{countdown=3;elapsed=0;clock.reset();last=performance.now();raceBoundary.begin(last);cancelAnimationFrame(frame);frame=requestAnimationFrame(render);publish();},onFrame:receiveOnlineFrame,onPause:(value,reason)=>pause(value,reason,{fromNetwork:true}),onLobby:()=>setGarage(),onDisconnect:()=>{drivingInput.clear();paused=true;pauseReason='network';clock.reset();audio.setPaused(true);music.setPaused(true);publish();}});
  function duelSetup(){return {mode:raceSetup.mode,side:online.status().role||'host',trackId:track.id,laps:mode==='race'?raceLaps:laps,player:selected,opponent:raceSetup.opponent,difficulty:difficulty.id,weather:mode==='race'?raceWeather:weather};}
  function refreshBest(){best=raceSetup.mode!=='grid'?duelRecord(storage(),duelSetup())?.best??null:bestRecord(storage(),track.id,laps);}
  function chooseRaceSetup(next,{persist=true}={}){if(mode!=='garage'||online.status().connected)return;raceSetup=normalizeRaceSetup({...raceSetup,...next});if(persist)saveRaceSetup(storage(),raceSetup);refreshBest();publish();}
  function receiveOnlineFrame(packet){
    if(mode!=='race'||cars.length!==2||packet.cars.some(c=>c.index>=route.points.length)||packet.cars[0].id!==cars[1].id||packet.cars[1].id!==cars[0].id)return;
    const recovered=(packet.cars[1].recovery?.count??0)>(cars[0].recovery?.count??0);
    for(let i=0;i<2;i++){const car=cars[i],wire=packet.cars[1-i];car.previous=car.state;car.state=wire.state;car.index=wire.index;car.progress=wire.progress;car.finish=wire.finish;car.impact=wire.impact;car.recovery=wire.recovery;}
    onlineSampleSeconds=Math.max(STEP,Math.min(.25,packet.elapsed-elapsed||ONLINE_STEP_MS/1000));elapsed=packet.elapsed;countdown=packet.countdown;paused=packet.paused;pauseReason=paused?'peer':'';lastOnlineTiming=packet.timing;nitroBonus=packet.cars[1].nitroBonus??nitroBonus;
    if(recovered){drivingInput.clear();online.input(ZERO_ONLINE_INPUT,true);cameraSnap=true;}
    lapTimes=packet.cars[1].lapTimes??[];lapStart=lapTimes.reduce((sum,t)=>sum+t,0);playerLap=lapInfo(cars[0].progress,route.length,raceLaps).lap;
    updateRaceResult();const p=cars[0],feedback=signals.update(p.previous,p.state,ONLINE_STEP_MS/1000);latestFeedback=feedback;
    if(!paused&&countdown<=0&&!result){if(raceWeather!=='rain')smoke.update(p.state,feedback,.05);exhaust.update(p.state,p.exhaustPoints,.05);trails.update(p.state,feedback,.05);}
    audio.update(p.state,feedback);audio.setPaused(paused||countdown>0||!!result);publish();
  }
  const makeProfile=()=>createRenderProfile(renderer,{classify:o=>classifyDraw(o,{world:assets.world,vehicles:cars.map(c=>c.view.root),sky})});
  let profile=import.meta.env.DEV&&new URLSearchParams(window.location.search).has('qaProfile')?makeProfile():null;
  let performanceTrial=null,performanceKind=null,performanceCondition=0,performanceResults=[],performanceRun=null,performanceStatus='idle';
  function performanceRace(){
    profile?.dispose();profile=performanceKind==='instrumentation'&&performanceCondition===1?makeProfile():null;
    performanceTrial?.restore();performanceTrial=null;performanceRun=null;
    startRace()?.then(()=>{if(alive&&performanceStatus==='running'){performanceTrial=applyGhostComparison(ghostView?.root,performanceKind,performanceCondition);performanceRun=createPerformanceRun();performanceRun.start();publish();}});
  }
  function performanceStart(kind){
    if(!import.meta.env.DEV||raceSetup.mode==='online'||(!PERFORMANCE_EXPERIMENTS[kind]&&kind!=='acceptance')||performanceStatus==='running')return;
    performanceKind=kind;performanceCondition=0;performanceResults=[];performanceStatus='running';qaDriver=true;performanceRace();
  }
  const drawScene=label=>profile?profile.render(scene,camera,label):renderer.render(scene,camera);
  const frozenEnabled=import.meta.env.DEV&&!!profile&&new URLSearchParams(window.location.search).has('qaFrozen');
  const frozenGhostEnabled=frozenEnabled&&new URLSearchParams(window.location.search).has('qaFrozenGhost');
  let frozenComparison=null,frozenTread=null,frozenSetupMs=0;
  function publish(){
    pauseRendering.invalidate();
    const ordered=[...cars].sort((a,b)=>(b.finish!==null)-(a.finish!==null)||(a.finish!==null&&b.finish!==null?a.finish-b.finish:b.progress-a.progress||a.slot-b.slot));
    const player=cars[0];
    const state={mode,selected,paused,countdown:Math.max(0,Math.ceil(countdown)),elapsed,result,kmh:Math.round(player?.state.kmh||0),gear:player?.state.gear||'N',place:Math.max(1,ordered.findIndex(c=>c.player)+1),progress:Math.min(1,Math.max(0,(player?.progress||0)/(route.length*raceLaps))),region:player?route.points[player.index].region:'GARAGE',nitro:(player?.state.action?.charge??100)/100,standings:ordered.map(c=>({name:c.name,progress:c.progress,finished:c.finish!==null,personality:rivalPlanner.snapshot(c)?.style})),fps,colliderCount,contacts:player?.state.contacts??0,position:player?.state.position,ai:cars.slice(1).map(c=>({position:c.state.position,kmh:c.state.kmh,progress:c.progress,contacts:c.state.contacts})),cameraDistance:player?camera.position.distanceTo(new THREE.Vector3().copy(player.state.position)):0};
    if(player){state.redline=RACE_TUNING[selected].redline;state.rpm=Math.round(player.state.powertrain?.rpm||850);state.shifting=player.state.powertrain?.shifting||false;state.mass=player.state.mass;state.steeringSensitivity=player.state.steeringSensitivity;state.steeringLimit=player.state.steeringLimit;state.steer=player.state.steer;state.wheels=player.state.wheels;state.impact=player.impact;state.rotation=player.state.rotation;state.angularVelocity=player.state.angularVelocity;state.recovery=player.recovery;state.ride=player.state.ride;state.velocity=player.state.velocity;}
    if(player){state.guidance=routeGuidance(route,player.index,player.progress,route.length*raceLaps);state.lap=lapInfo(player.progress,route.length,raceLaps).lap;state.lapTimes=lapTimes;}
    state.laps=mode==='race'?raceLaps:laps;state.lapOptions=LAP_OPTIONS;state.best=best;state.medals=raceSetup.mode!=='grid'?null:medalTimes(track.id,state.laps);state.ghost=ghost?{vehicle:ghost.vehicle,time:ghost.time}:null;
    state.raceSetup={...raceSetup};state.participants=mode==='race'?cars.length:raceRoster(selected,raceSetup).length;state.duel=mode==='race'&&raceSetup.mode!=='grid'?duelStatus(cars):null;state.online=online.status();
    if(raceSetup.mode==='online')state.ai=[];
    state.timing=raceSetup.mode==='online'&&online.status().role==='guest'&&lastOnlineTiming?{...lastOnlineTiming,authority:'host'}:clock.snapshot();state.camera={position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov};
    state.input=drivingInput.read();state.pauseReason=pauseReason;state.track={id:track.id,name:track.name,length:route.length};
    state.audio={...audio.status(),wanted:soundWanted};
    state.difficulty=difficulty.id;state.assist=raceSetup.mode==='online'?true:assist;state.nitroBonus=nitroBonus;if(player){state.surface=player.state.surface;state.draft=player.state.draft;}
    state.music=music.status();state.cameraMode=cameraMode;state.cockpit=cockpit.status();
    state.quality=quality.id;state.progression=progression;state.weather=mode==='race'?raceWeather:weather;
    state.traffic=roadTraffic?.snapshot()??{count:0,vehicles:[]};
    state.rendering={...frameMetrics.snapshot(),pageVisible:document.visibilityState==='visible',pageFocused:document.hasFocus(),pauseRendering:{...pauseRendering.stats},scenery,surfaces,presentation:presentation?.stats,landmarks:landmarks?.stats,night:night?.stats,mapVisuals:mapVisuals?.stats,staticWorld:staticWorld.stats,lighting:currentWeatherLighting.lighting,atmosphere:currentWeatherLighting.atmosphere,colors,decoration:decorationQuality.status(),pixelRatio:renderer.getPixelRatio(),width:host.clientWidth,height:host.clientHeight};
    if(profile)state.rendering.profile=profile.snapshot();
    if(frozenEnabled){const frozenState=frozenComparison?.snapshot();state.rendering.frozen={...frozenState,results:frozenState?.status==='running'?[]:frozenState?.results,detail:frozenTread?.snapshot(),setupMs:frozenSetupMs};}
    state.loading=assets.loading;
    state.preparation={...preparation.snapshot(),busy:preparation.busy()||raceBoundary.pending(),frameBoundary:raceBoundary.snapshot()};
    state.finishOrder=ordered.map(c=>({name:c.name,time:c.finish,finished:c.finish!==null}));
    if(import.meta.env.DEV)state.qaDriver=qaDriver;
    if(import.meta.env.DEV)state.bodyMotion={cars:cars.map(c=>({id:c.id,...c.view.motion.snapshot()})),ghost:ghostView?.motion.snapshot()??null,ghostVisible:ghostView?.root.visible??false,reducedMotion,cameraExtraTilt:0};
    if(import.meta.env.DEV)state.performanceTrial={kind:performanceKind,status:performanceStatus,condition:performanceCondition,label:PERFORMANCE_EXPERIMENTS[performanceKind]?.[performanceCondition],profile:!!profile,frozen:frozenEnabled,results:performanceStatus==='running'?[]:performanceResults};
    state.vfx={rain:rain.stats(),tireSmoke:smoke.stats(),exhaust:exhaust.stats(),trails:trails.stats(),feedback:latestFeedback};
    state.ai.forEach((s,i)=>{const car=cars[i+1];s.waitingForTraffic=!!car.waitingForTraffic;s.name=car.name;s.vehicle=car.id;s.maneuver=rivalPlanner.snapshot(car);s.recovery=car.recovery;});
    window.__mumuRebuild=state;onState(state);
  }
  function setGarage(id=selected,{resumeSeries=false}={}){
    progression=progressFromRecords(storage());
    if(resumeSeries)restoredSeries=true;
    if(!assets.cars[id]||!canSelectCar(progression,id)&&!(restoredSeries&&(resumeSeries||id===selected)))return;
    frozenComparison?.cancel();frozenComparison=null;frozenTread=null;
    raceBoundary.cancel();
    preparation.cancel();
    rivalPlanner.reset();
    clearTraffic();
    frameMetrics.reset();
    rain.clear();currentWeatherLighting={lighting,atmosphere};selected=id;mode='garage';paused=false;pauseReason='';result=null;drivingInput.clear();audio.setPaused(true);audio.setVehicle(id);music.stop();
    cockpit.update(null,false);
    cars.forEach(c=>{c.sim.dispose();c.view.dispose();c.view.root.removeFromParent();});cars=[];clearGhost();raceLaps=laps;
    refreshBest();
    display?.dispose();display?.root.removeFromParent();display=createVehicleView(assets.cars[id],id,{vivid:namak});scene.add(display.root);display.root.position.y=-display.floorOffset;display.root.rotation.y=-.35;
    assets.world.visible=false;assets.garage.visible=true;smoke.clear();exhaust.clear();trails.clear();signals.reset();sparks.clear();raceContacts.clear();latestFeedback={};cameraImpact=0;
    sky.visible=false;scene.background.set('#090e18');scene.fog=null;scene.environment=environment.texture;scene.environmentIntensity=.85;ambient.intensity=.6;fill.visible=true;ceiling.visible=true;sun.intensity=1.9;sun.castShadow=quality.shadows;fill.intensity=.9;renderer.toneMappingExposure=.95;
    camera.fov=40;camera.near=.15;controls.enabled=true;fitGarageCamera();camera.updateProjectionMatrix();
    sun.position.set(4,8,3);sun.target.position.set(0,0,0);publish();
  }
  function startRace({networkPrepare=false}={}){
    if(raceSetup.mode==='online'&&!networkPrepare)return online.start({laps,weather});
    const networkRace=raceSetup.mode==='online';
    if(!presentationGuard.canDrive()||preparation.busy()||raceBoundary.pending()||!networkRace&&!restoredSeries&&(!canRaceTrack(progression,track.id)||!canSelectCar(progression,selected)))return;
    return preparation.run({setup(){
    frozenComparison?.cancel();frozenComparison=null;frozenTread=null;
    raceWeather=weather;raceProfile=weatherSpeedProfile(difficulty.profile,raceWeather);qaSpeed=weatherSpeedProfile(difficultyById('hard').profile,raceWeather);
    const raceSurface=createWeatherSurfaceQuery(surfaceMap,raceWeather);
    const wet=weatherLighting(lighting,atmosphere,raceWeather,track.night),raceLighting=wet.lighting,raceAtmosphere=wet.atmosphere;
    currentWeatherLighting=wet;for(const [material,dry] of dryRoadRoughness)material.roughness=raceWeather==='rain'?Math.min(dry,.48):dry;
    sky.material.uniforms.turbidity.value=raceAtmosphere.turbidity;
    rain.clear();rivalPlanner=planRivals();overtakes.reset();nitroBonus={amount:0,age:100};
    if(import.meta.env.DEV)qaPlanner=createRivalPlanner(route,{roadClear,speedProfile:qaSpeed,nitro:true});
    clearTraffic();
    clearGhost();raceLaps=laps;lapStart=0;lapTimes=[];playerLap=1;showGhost();ghostRecorder=raceSetup.mode!=='grid'?null:createGhostRecorder(selected);
    frameMetrics.reset();
    audio.setPaused(true);audio.setVehicle(selected);
    audio.setEnabled(soundWanted).then(()=>{if(alive)publish();});
    music.setMaster(soundWanted);music.start().then(()=>{if(alive)publish();});
    display?.dispose();display?.root.removeFromParent();display=null;drivingInput.clear();mode='race';paused=false;pauseReason='';result=null;countdown=3;elapsed=0;clock.reset();cameraSnap=true;
    cars.forEach(c=>{c.sim.dispose();c.view.dispose();c.view.root.removeFromParent();});cars=[];
    assets.world.visible=true;assets.garage.visible=false;controls.enabled=false;sky.visible=!track.night;scene.background.set(raceAtmosphere.fog);scene.fog=new THREE.Fog(raceAtmosphere.fog,raceLighting.fogNear,raceLighting.fogFar);scene.environment=track.night?environment.texture:outdoorEnvironment.texture;sun.castShadow=quality.shadows&&!track.night;scene.environmentIntensity=raceLighting.environment;ambient.intensity=raceLighting.ambient;fill.visible=false;ceiling.visible=false;sun.intensity=raceLighting.sun;renderer.toneMappingExposure=raceLighting.exposure;
    const session=online.status(),roster=networkRace?onlineRoster(session.role==='host'?selected:session.remoteVehicle,session.role==='host'?session.remoteVehicle:selected,session.role):raceRoster(selected,raceSetup);
    for(let i=0;i<roster.length;i++){
      const {id,name,slot,rivalIndex}=roster[i],lane=slot%2===0?-RACE_GRID_LANE:RACE_GRID_LANE,index=startIndex-Math.floor(slot/2)*(track.gridRowStep??4);
      const view=createVehicleView(assets.cars[id],id,{vivid:namak});scene.add(view.root);
      const p=spawn(index,lane,view.spec),sim=createVehiclePhysics({sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,start:p.position,spec:view.spec,raceTuning:i===0||networkRace||difficulty.id!=='easy'?playerRaceTuning(id):RACE_TUNING[id],steeringSensitivity:i===0||networkRace?PLAYER_STEERING_SENSITIVITY:1,surface:raceSurface,nitro:i===0||networkRace?RACE_NITRO:difficulty.rivalNitro??RACE_NITRO,recoveryAssist:networkRace?true:i===0?assist:true});sim.reset(p.position,p.yaw,{stepWorld:false,rotation:p.rotation});
      const state=sim.snapshot();cars.push({id,sim,view,recoveryWatch:createRecoveryWatch({roadHalfWidth:bounded?route.width/2:Infinity}),recovery:{count:0,reason:'',age:100},exhaustPoints:exhaustPoints(id),player:i===0,name,lane,pace:difficultyPace(difficulty,rivalIndex),index,routeDistance:route.points[index].distance,progress:route.points[index].distance-route.points[startIndex].distance,state,previous:state,finish:null,stuck:0,scrape:false,draft:0,slot});
      if(networkRace)Object.assign(cars.at(-1),{onlineHuman:true,peerRole:roster[i].peerRole,pace:1,peerOvertakes:createOvertakeCounter(),nitroBonus:{amount:0,age:100},lapTimes:[],onlineLap:1,onlineLapStart:0});
    }
    if(track.traffic&&raceSetup.mode==='grid'){roadTraffic=createRoadTraffic(world,route,{count:TRAFFIC_BUDGET[quality.id],surface:raceSurface});trafficViews=createTrafficViews(roadTraffic.cars);scene.add(trafficViews.root);}
    for(let i=0;i<120;i++){cars.forEach(c=>c.sim.step({brake:1},false));roadTraffic?.step(cars,false);stepVehicleWorld(world);roadTraffic?.finishStep();cars.forEach(c=>{c.state=c.previous=c.sim.finishStep();});}
    signals.reset();smoke.clear();exhaust.clear();trails.clear();sparks.clear();raceContacts.clear();latestFeedback={};cameraImpact=0;audio.setPaused(true);renderer.domElement.focus({preventScroll:true});last=performance.now();publish();
    },compile(){presentScene(performance.now(),0);return renderer.compileAsync(scene,camera);},draw(){renderer.info.reset();drawScene('preparation');},ready(){
      clock.reset();frameMetrics.reset();drivingInput.clear();last=performance.now();fpsStart=last;frames=0;
      if(networkRace){online.prepared();return;}
      raceBoundary.begin(last);
      // The pending callback may carry a timestamp from before the warm draw.
      // Request a fresh frame so preparation time cannot enter the race clock.
      cancelAnimationFrame(frame);frame=requestAnimationFrame(render);
      if(document.hidden||!document.hasFocus())pause(true,'focus');
    }});
  }
  function recover(car=cars[0],reason='manual'){
    if(raceSetup.mode==='online'&&online.status().role==='guest'){online.input(ZERO_ONLINE_INPUT,true);online.recover();drivingInput.clear();return true;}
    if(!car||!car.player&&!car.onlineHuman)return false;
    const traffic=cars.filter(c=>c!==car).map(c=>c.state);
    // Search backwards only: recovery must never grant a position advantage.
    const found=findRecoveryPose(route,car.index,[car.lane,-car.lane,0],traffic,(index,lane)=>spawn(index,lane,car.view.spec));
    if(!found)return false;
    const {pose,index:recoveryIndex,lane:recoveryLane}=found;
    car.progress+=recoveryProgressChange(car.routeDistance,route.points[recoveryIndex].distance,route.length);
    car.index=recoveryIndex;car.routeDistance=route.points[recoveryIndex].distance;
    car.sim.reset(pose.position,pose.yaw,{stepWorld:false,rotation:pose.rotation,preserveCharge:true});car.state=car.previous=car.sim.snapshot();car.stuck=car.waited=0;
    car.recoveryWatch.reset();car.recovery={count:car.recovery.count+1,reason,age:0};
    car.impact={count:0,intensity:0,deltaV:0,age:100};
    if(car.player){drivingInput.clear();audio.reset();cameraSnap=true;signals.reset();smoke.clear();exhaust.clear();trails.clear();cameraImpact=0;latestFeedback={};}
    return true;
  }
  function pause(value,reason='manual',{fromNetwork=false}={}){if(preparation.blocked()||mode!=='race'||(!value&&!presentationGuard.canDrive()))return;if(raceSetup.mode==='online'&&!fromNetwork){drivingInput.clear();online.input(ZERO_ONLINE_INPUT,true);if(online.status().phase==='racing')online.pause(value,reason);return;}paused=value;if(value)rain.clear();pauseReason=value?reason:'';drivingInput.clear();clock.reset();last=performance.now();fpsStart=last;frames=0;frameMetrics.reset();audio.setPaused(value||countdown>0||!!result);music.setPaused(value||!!result);publish();if(!value){renderer.domElement.focus({preventScroll:true});music.resume();if(soundWanted&&audio.status().state!=='running')audio.setEnabled(true).then(()=>{if(alive)publish();});}}
  const presentationGuard=createPresentationGuard({clear:()=>drivingInput.clear(),pause:reason=>pause(true,reason)});
  function toggleSound(){soundWanted=!soundWanted;audio.setEnabled(soundWanted).then(()=>{if(alive)publish();});music.setMaster(soundWanted);publish();}
  function toggleCamera(){if(mode!=='race')return;cameraMode=cameraMode==='chase'?'first-person':'chase';cameraSnap=true;if(!paused)renderer.domElement.focus({preventScroll:true});publish();}
  function toggleMusic(){const state=music.status();music.setEnabled(state.failed||state.blocked?true:!state.wanted);publish();}
  function updateStep(){
    const networkRace=raceSetup.mode==='online';
    if(networkRace&&online.status().phase!=='racing')return;
    // A player's result must not stop unfinished rivals: a championship needs
    // six actual finish times, rather than provisional progress rankings.
    countdown-=STEP;const running=countdown<=0&&cars.some(c=>c.finish===null);
    if(running)elapsed+=STEP;
    const rivalInputs=running&&!networkRace?rivalPlanner.update(cars,STEP,roadTraffic?.cars??[]):new Map();
    let qaInput=null;
    if(import.meta.env.DEV&&running&&qaDriver){Object.assign(qaDriverCar,cars[0],{player:false});qaInput=qaPlanner.update([qaDriverCar],STEP,[...cars.slice(1),...(roadTraffic?.cars??[])]).get(qaDriverCar);}
    for(const c of cars)c.draft=running&&c.finish===null?slipstream(c.state,cars.filter(o=>o!==c).map(o=>o.state)):0;
    for(const c of cars){
      c.previous=c.state;
      const input=!running?{brake:1}:c.finish!==null?(!c.player&&!c.onlineHuman&&c.finishRunout<50?aiInput(route,c.state,c.index,c.finishLane,c.pace,cars.filter(o=>o!==c).map(o=>o.state),{speedProfile:raceProfile,speedLimit:55}):{brake:1}):c.player?(import.meta.env.DEV&&qaDriver?qaInput:drivingInput.read()):c.onlineHuman?online.remoteInput.read():rivalInputs.get(c);
      c.waitingForTraffic=!!input.waitingForTraffic;
      c.sim.step(c.scrape||c.draft?{...input,scrape:c.scrape?1:0,draft:c.draft}:input,false);
    }
    roadTraffic?.step(cars,running);stepVehicleWorld(world,raceContacts.queue);roadTraffic?.finishStep();
    raceContacts.finish(roadTraffic?[...cars,...roadTraffic.cars]:cars,STEP,(car,hit)=>{if(running){if(car.player){cameraImpact=Math.max(cameraImpact,hit.intensity);audio.impact(hit.intensity);}if(car.player||car.state.position&&Math.hypot(car.state.position.x-cars[0].state.position.x,car.state.position.z-cars[0].state.position.z)<65)sparks.emit(hit);}});
    sparks.update(STEP);
    for(const c of cars){
      c.state=c.sim.finishStep();c.scrape=running&&touchingWall(world,c.sim.colliders,surfaceMap.isWall);const nearest=nearestRoute(route,c.state.position,c.index);c.index=nearest.index;
      c.recovery.age+=STEP;
      const recoveryReason=running&&(c.player||c.onlineHuman)&&c.finish===null?c.recoveryWatch.update(c.state,nearest.point.y,STEP,nearest.distance):null;
      // Inverted, underground or outside-wall motion must not collect race progress.
      const q=c.state.rotation,upright=1-2*(q.x*q.x+q.z*q.z)>.25;
      if(running&&c.finish===null&&upright&&(!bounded||nearest.distance<=route.width/2+1)&&c.state.position.y>=nearest.point.y-6)c.progress+=forwardProgress(c.routeDistance,nearest.point.distance,route.length);
      if(c.finish!==null&&!c.player&&!c.onlineHuman)c.finishRunout+=Math.max(0,forwardProgress(c.routeDistance,nearest.point.distance,route.length));
      c.routeDistance=nearest.point.distance;
      if(recoveryReason){recover(c,recoveryReason);continue;}
      if(c.progress>=route.length*raceLaps&&c.finish===null){
        c.finish=elapsed;c.finishRunout=0;
        c.finishLane=(c.state.position.x-nearest.point.x)*nearest.point.dz-(c.state.position.z-nearest.point.z)*nearest.point.dx;
        if(!c.player&&!c.onlineHuman)rivalPlanner.reset(c,c.finishLane);
      }
      if(c.onlineHuman){
        c.nitroBonus.age+=STEP;
        const lap=lapInfo(c.progress,route.length,raceLaps).lap;
        if(lap>c.onlineLap){c.lapTimes.push(elapsed-c.onlineLapStart);c.onlineLapStart=elapsed;c.onlineLap=lap;}
        if(c.finish!==null&&c.lapTimes.length<raceLaps)c.lapTimes.push(c.finish-c.onlineLapStart);
        if(!c.player&&running&&c.finish===null){const passes=c.peerOvertakes.update(c,cars.filter(o=>o!==c));if(passes){c.sim.addCharge(OVERTAKE_CHARGE*passes);c.nitroBonus={amount:OVERTAKE_CHARGE*passes,age:0};}}
      }
    }
    nitroBonus.age+=STEP;
    if(running&&cars[0].finish===null){
      ghostRecorder?.record(elapsed,cars[0].state);
      const {lap}=lapInfo(cars[0].progress,route.length,raceLaps);
      if(lap>playerLap){lapTimes=[...lapTimes,elapsed-lapStart];lapStart=elapsed;playerLap=lap;}
    }
    if(running&&cars[0].finish===null){const passes=overtakes.update(cars[0],cars.slice(1));if(passes){cars[0].sim.addCharge(OVERTAKE_CHARGE*passes);nitroBonus={amount:OVERTAKE_CHARGE*passes,age:0};}}
    updateRaceResult();
    const p=cars[0],feedback=signals.update(p.previous,p.state,STEP);latestFeedback=feedback;if(raceWeather!=='rain')smoke.update(p.state,feedback,STEP);exhaust.update(p.state,p.exhaustPoints,STEP,{enabled:!result});trails.update(p.state,feedback,STEP);audio.update(p.state,feedback);audio.setPaused(!running||!!result);
    if(networkRace){cars[0].nitroBonus=nitroBonus;online.frame(()=>({version:ONLINE_VERSION,elapsed,countdown,paused,cars:cars.map(packOnlineCar),timing:clock.snapshot()}));}
  }
  function updateRaceResult(){
    if(cars[0]?.finish!==null&&cars[0]&&!result){const place=1+cars.slice(1).filter(c=>c.finish!==null&&c.finish<cars[0].finish).length;if(lapTimes.length<raceLaps)lapTimes=[...lapTimes,cars[0].finish-lapStart];
      const previousProgress=progression;
      const duel=raceSetup.mode!=='grid',outcome=duel?duelOutcome(cars[0].finish,cars[1].finish):null;
      const entry={time:cars[0].finish,vehicle:selected,difficulty:difficulty.id,place,date:new Date().toLocaleDateString('sv-SE')};
      const record=duel?submitDuelRecord(storage(),duelSetup(),{...entry,outcome}):submitRecord(storage(),track.id,raceLaps,entry);best=record.best;progression=progressFromRecords(storage());
      const ghostSaved=!duel&&record.improved&&ghostRecorder?saveGhost(storage(),track.id,raceLaps,ghostRecorder.finish(cars[0].finish)):false;
      result={raceMode:raceSetup.mode,outcome,opponent:duel?cars[1].name:null,recordsSaved:duel?record.saved:undefined,wins:record.wins,runs:record.runs,unlocked:newlyUnlocked(previousProgress,progression),place,time:cars[0].finish,difficulty:difficulty.id,laps:raceLaps,lapTimes,bestLap:Math.min(...lapTimes),improved:record.improved,previous:record.previous?.time??null,medal:duel?null:medalFor(cars[0].finish,medalTimes(track.id,raceLaps)),ghostSaved};drivingInput.clear();music.setPaused(true);}
  }
  function presentScene(now,dt){
    if(mode==='race'){
      trafficViews?.update(paused?1:clock.alpha());
      const guest=raceSetup.mode==='online'&&online.status().role==='guest';
      cars.forEach(c=>{poseVehicle(c.view,c.state,.6,c.previous,paused?1:guest?online.alpha(onlineSampleSeconds*1000):clock.alpha());applyBodyMotion(c.view,c.previous,c.state,paused?0:dt,{sampleSeconds:guest?onlineSampleSeconds:STEP,reducedMotion,enabled:quality.id!=='low'});});
      if(ghostView){
        const ghostTime=elapsed+(paused?0:clock.alpha()*STEP),pose=countdown<=0&&!result&&performanceTrial?.visible!==false?ghostPose(ghost,ghostTime):null;
        ghostView.root.visible=!!pose;
        if(pose){
          ghostView.root.quaternion.set(pose.rotation.x,pose.rotation.y,pose.rotation.z,pose.rotation.w);ghostView.root.position.copy(modelPosition(new THREE.Vector3(pose.position.x,pose.position.y,pose.position.z),ghostView.root.quaternion,.6));
          const state={...pose,velocity:ghostVelocity(ghost,ghostTime)};
          if(ghostPreviousState&&ghostTime>ghostPreviousTime)applyBodyMotion(ghostView,ghostPreviousState,state,paused?0:dt,{sampleSeconds:ghostTime-ghostPreviousTime,reducedMotion,enabled:quality.id!=='low'});
          ghostPreviousState=state;ghostPreviousTime=ghostTime;
          ghostView.root.visible=ghostVisibleFromCamera(cameraMode,ghostView.root.position,cars[0].view.root.position);
        }
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
    rain.update(cars[0]?.state,dt,mode==='race'&&raceWeather==='rain'&&!paused&&!result&&countdown<=0);
    music.update(dt);
    if(sky.visible)sky.position.copy(camera.position);
    night?.update(cars[0]?.state,cars[0]?.index??0,mode==='race',camera.position);
    presentation?.update(camera,quality.decorationDistance);
    landmarks?.update(camera,assets.world.visible);
    if(mode==='race')decorationQuality.update(camera);
    mapVisuals?.update(camera,mode==='race'&&!paused&&!result?dt:0,elapsed,mode==='race');
    daylight?.update(mode==='race'&&!paused&&!result?dt:0,elapsed);
  }
  function render(now){
    if(!alive)return;
    if(frozenEnabled&&paused&&mode==='race'){
      if(!frozenComparison){
        const setupStart=performance.now();
        frozenTread=frozenGhostEnabled?createFrozenGhostTrial(ghostView?.root):createFrozenTreadTrial(cars.map(c=>c.view),camera,host.clientHeight);
        frozenComparison=createFrozenComparison({middleMode:frozenGhostEnabled?'ghost-single-pass':'tread',middlePhase:frozenGhostEnabled?'ghost-single-pass':'tread-only',apply:mode=>frozenTread.apply(mode),reset:()=>frameMetrics.reset(),measure:()=>({frames:frameMetrics.snapshot(),profile:profile.snapshot(),camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray()},cars:cars.map(c=>({position:c.view.root.position.toArray(),quaternion:c.view.root.quaternion.toArray()})),ghost:ghostView?{position:ghostView.root.position.toArray(),quaternion:ghostView.root.quaternion.toArray(),visible:ghostView.root.visible}:null,elapsed})});
        frozenComparison.start();frozenSetupMs=performance.now()-setupStart;last=now;
      }
      if(frozenComparison.active())pauseRendering.invalidate();
    }else if(frozenComparison?.active()){frozenComparison.cancel();frameMetrics.reset();}
    if(preparation.blocked()||!pauseRendering.draw(paused)){last=now;frame=requestAnimationFrame(render);return;}
    if(mode==='race'){
      const boundary=raceBoundary.enter(now,performance.now());
      if(!boundary.accepted){frame=requestAnimationFrame(render);return;}
      if(boundary.first){last=now;fpsStart=now;frames=0;}
    }
    const workStart=performance.now();let physicsMs=0;
    const rawDt=Math.max(0,(now-last)/1000),dt=Math.min(.05,rawDt);last=now;
    if(mode==='race'&&!paused){const physicsStart=performance.now();if(raceSetup.mode==='online'&&online.status().role==='guest'){
      let input=drivingInput.read();if(import.meta.env.DEV&&qaDriver&&countdown<=0&&!result){Object.assign(qaDriverCar,cars[0],{player:false});input=qaPlanner.update([qaDriverCar],Math.max(STEP,dt),cars.slice(1)).get(qaDriverCar);}
      online.input(countdown>0||result?ZERO_ONLINE_INPUT:input);
    }else clock.advance(rawDt,updateStep);physicsMs=performance.now()-physicsStart;}
    presentScene(now,dt);
    const renderStart=performance.now();renderer.info.reset();drawScene(frozenComparison?.active()?frozenComparison.label():mode);const renderMs=performance.now()-renderStart;frames++;
    if(!paused||frozenComparison?.active())frameMetrics.record(now,renderer.info.render,{workMs:performance.now()-workStart,physicsMs,renderMs},{visible:document.visibilityState==='visible',focused:document.hasFocus(),callbackDelayMs:Math.max(0,workStart-now),droppedSeconds:clock.snapshot().droppedSeconds});
    if(import.meta.env.DEV&&performanceStatus==='running'&&performanceRun&&!paused&&countdown<=0&&performanceRun.record(now,renderMs,renderer.info.render,{visible:document.visibilityState==='visible',focused:document.hasFocus()})){
      performanceResults.push({label:PERFORMANCE_EXPERIMENTS[performanceKind]?.[performanceCondition]??'제품 기준',...performanceRun.snapshot(),context:{width:host.clientWidth,height:host.clientHeight,dpr:renderer.getPixelRatio(),quality:quality.id,track:track.id,camera:cameraMode,ghost:!!ghostView,profile:!!profile,frozen:frozenEnabled,progress:cars[0].progress,elapsed,dropped:clock.snapshot().droppedSeconds}});
      performanceRun=null;performanceTrial?.restore();performanceTrial=null;
      if(++performanceCondition<(performanceKind==='acceptance'?1:3))performanceRace();else {performanceStatus='complete';profile?.dispose();profile=null;qaDriver=false;pause(true);publish();}
    }
    if(frozenComparison?.active()){const before=frozenComparison.label();frozenComparison.record(now);if(before!==frozenComparison.label())publish();}
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
  const keyActions={input:drivingInput,inRace:()=>mode==='race',canDrive:()=>!preparation.blocked()&&!raceBoundary.pending()&&!paused&&!result&&presentationGuard.canDrive(),pause:()=>pause(!paused),recover:()=>recover(),restart:()=>{if(!result)startRace();},mute:toggleSound,camera:toggleCamera};
  const keydown=e=>handleRaceKeyDown(e,keyActions);
  const keyup=e=>drivingInput.release(e.code),blur=()=>pause(true,'focus');
  function visibility(){if(document.hidden){pause(true,'focus');cancelAnimationFrame(frame);}else if(alive){last=performance.now();cancelAnimationFrame(frame);frame=requestAnimationFrame(render);}}
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
  setGarage();applyQuality();frame=requestAnimationFrame(render);
  function onlineAction(action,value){
    if(action==='leave'){online.close();setGarage();return;}
    if(raceSetup.mode!=='online')return;
    if(action==='host'&&mode==='garage')online.host(selected);
    if(action==='join'&&mode==='garage')online.join(value,selected);
    if(action==='ready'&&mode==='garage')online.ready(value);
    if(action==='start')startRace();
  }
  function returnGarage(){
    if(raceSetup.mode==='online'&&online.status().phase==='racing'&&online.status().connected){online.lobby();return;}
    if(raceSetup.mode==='online')online.close();
    restoredSeries=false;progression=progressFromRecords(storage());setGarage(canSelectCar(progression,selected)?selected:'supra');
  }
  return {online:onlineAction,qa:import.meta.env.DEV?{performance:performanceStart,driver(value){qaDriver=!!value;drivingInput.clear();publish();}}:undefined,raceSetup:chooseRaceSetup,quality:id=>{if(mode!=='garage')return;quality=qualityById(id);saveQuality(storage(),quality.id);applyQuality();publish();},weather:id=>{if(mode!=='garage')return;weather=weatherById(id).id;saveWeather(storage(),weather);refreshBest();publish();},presentation:next=>presentationGuard.update(next),select:setGarage,start:startRace,assist:()=>{if(raceSetup.mode==='online')return;assist=!assist;saveAssist(storage(),assist);if(cars[0]?.player)cars[0].sim.setRecoveryAssist(assist);publish();},laps:n=>{if(mode!=='garage'||!LAP_OPTIONS.includes(n))return;laps=raceLaps=n;saveLaps(storage(),n);refreshBest();publish();},difficulty:id=>{if(mode!=='garage')return;difficulty=difficultyById(id);saveDifficulty(storage(),difficulty.id);refreshBest();publish();},garage:returnGarage,pause:()=>pause(!paused),sound:toggleSound,camera:toggleCamera,music:toggleMusic,musicTrack:id=>{Promise.resolve(music.select(id)).then(()=>{if(alive)publish();});publish();},musicVolume:value=>{music.setVolume(value);publish();},recover:()=>{if(!preparation.blocked()&&!raceBoundary.pending()&&mode==='race'&&!paused&&!result)recover();},input(code,value,source='touch'){if(!value)drivingInput.release(code,source);else if(!preparation.blocked()&&!raceBoundary.pending()&&mode==='race'&&!paused&&!result&&presentationGuard.canDrive())drivingInput.press(code,source);},dispose(){
    if(!alive)return;alive=false;raceBoundary.cancel();preparation.cancel();cancelAnimationFrame(frame);observer.disconnect();controls.dispose();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);
    online.dispose();frozenComparison?.cancel();profile?.dispose();night?.dispose();daylight?.dispose();mapVisuals?.dispose();staticWorld.dispose();audio.dispose();music.dispose();cars.forEach(c=>c.sim.dispose());clearTraffic();raceContacts.dispose();world.free();
    createSceneDisposer(scene,{renderTargets:[environment,outdoorEnvironment]})();display?.dispose();cars.forEach(c=>c.view.dispose());clearGhost();renderer.dispose();renderer.domElement.remove();delete window.__mumuRebuild;
  }};
}
