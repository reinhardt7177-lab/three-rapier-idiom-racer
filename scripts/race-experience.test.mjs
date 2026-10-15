import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PerspectiveCamera,Vector3,Quaternion,Euler} from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {createFirstPersonCamera} from '../src/rebuild/firstPersonCamera.js';
import {createRaceMusic} from '../src/rebuild/raceMusic.js';
import {RIVAL_RACE_PROFILE,rivalPace} from '../src/rebuild/rivalSpeed.js';
import {aiInput,nearestRoute,curveSpeeds} from '../src/rebuild/course.js';
import {RACE_TUNING} from '../src/rebuild/vehicleDynamics.js';
import {VEHICLES} from '../src/rebuild/fleet.js';
import {initPhysics,createVehiclePhysics,STEP,stepVehicleWorld} from '../src/driving/physics.js';
import {createRaceInput,handleRaceKeyDown} from '../src/rebuild/raceInput.js';

test('driver view follows 230 km/h without horizontal lag at 30/60/120 Hz and respects each cabin height',()=>{
 for(const tuning of Object.values(RACE_TUNING))for(const fps of [30,60,120]){
  const c=new PerspectiveCamera(),view=createFirstPersonCamera(c),p=new Vector3(),q=new Quaternion();
  for(let i=0;i<fps*3;i++){p.z+=230/3.6/fps;view.update(p,q,1/fps,{snap:i===0,roof:tuning.roof,width:tuning.width});
   assert.ok(Math.abs(c.position.z-p.z-.12)<1e-8);assert.ok(Math.abs(c.position.x+tuning.width*.19)<1e-8);
  }
  assert.equal(c.fov,72);assert.equal(c.near,.04);assert.ok(c.position.y-p.y>=1.03);
 }
});
test('driver view filters heave and roll, follows hill pitch, freezes while paused and snaps after recovery',()=>{
 const c=new PerspectiveCamera(),view=createFirstPersonCamera(c),p=new Vector3(0,1,0),q=new Quaternion();view.update(p,q,1/60,{snap:true});
 const before=c.position.y;p.y+=.06;view.update(p,new Quaternion().setFromEuler(new Euler(0,0,.3)),1/60);
 assert.ok(c.position.y-before<.02);const right=new Vector3(1,0,0).applyQuaternion(c.quaternion);assert.ok(Math.abs(right.y)<1e-8);
 const paused=c.position.clone();view.update(p,q,0);assert.deepEqual(c.position.toArray(),paused.toArray());
 for(let i=0;i<120;i++)view.update(p,new Quaternion().setFromEuler(new Euler(-.2,0,0)),1/60);
 const direction=new Vector3();c.getWorldDirection(direction);assert.ok(direction.y>.18,'look up the physical road slope');
 p.set(150,40,500);view.update(p,q,0,{snap:true,compact:true});assert.ok(c.position.y>41);assert.equal(c.fov,78);
});
test('V switches view once per press without changing pedals or stealing editable/button keys',()=>{
 const input=createRaceInput();input.press('KeyW');let switches=0;
 const actions={inRace:()=>true,canDrive:()=>true,input,camera:()=>switches++};
 const key=(repeat=false,target={closest:()=>null})=>handleRaceKeyDown({code:'KeyV',repeat,target,preventDefault(){}},actions);
 key();key(true);assert.equal(switches,1);assert.equal(input.read().throttle,1);
 key(false,{closest:()=>({})});assert.equal(switches,1);key();assert.equal(switches,2);
});
function mediaMock(){return {paused:true,volume:0,currentTime:0,duration:68.847,plays:0,loads:0,events:new Map(),
 play(){this.plays++;if(this.reject)return Promise.reject(this.reject);this.paused=false;return Promise.resolve();},pause(){this.paused=true;},
 addEventListener(e,cb){this.events.set(e,cb);},removeEventListener(e){this.events.delete(e);},removeAttribute(){this.src='';},load(){this.loads++;}};}
test('one local looping track respects pause, mute, volume, restart, garage stop and disposal',async()=>{
 const media=mediaMock();let count=0;const music=createRaceMusic('track.mp3',{makeAudio:()=>{count++;return media;}});
 assert.equal(media.loop,true);assert.equal(media.preload,'none');assert.equal(music.status().playing,false);
 await music.start();music.update(1);assert.ok(music.status().playing);assert.ok(media.volume>0&&media.volume<.25);
 media.currentTime=12;music.setPaused(true);assert.equal(media.paused,true);assert.equal(media.currentTime,12);
 await music.setPaused(false);assert.equal(media.currentTime,12);
 music.setMaster(false);assert.equal(music.status().playing,false);await music.setMaster(true);assert.ok(music.status().playing);
 music.setEnabled(false);await music.start();assert.equal(music.status().wanted,false);assert.equal(media.paused,true);
 await music.setEnabled(true);music.setVolume(10);assert.equal(music.status().volume,.6);
 music.stop();assert.equal(media.currentTime,0);assert.equal(media.paused,true);await music.start();assert.equal(count,1);
 music.dispose();assert.equal(media.paused,true);assert.equal(media.loads,1);assert.equal(media.events.size,0);
 assert.equal(await music.resume(),undefined);
});
test('blocked or failed media is silent, retries only on a gesture and ignores a late play after disposal',async()=>{
 const media=mediaMock(),music=createRaceMusic('track.mp3',{makeAudio:()=>media});media.reject={name:'NotAllowedError'};
 await music.start();assert.ok(music.status().blocked);music.setPaused(false);assert.equal(media.plays,1);
 media.reject=null;await music.resume();assert.ok(music.status().playing);
 media.events.get('error')();assert.ok(music.status().failed);await music.setEnabled(true);assert.ok(!music.status().failed);
 let resolve;media.play=()=>new Promise(r=>resolve=r);const pending=music.resume();music.dispose();resolve();await pending;assert.ok(media.paused);
});
test('packaged music is real audio and sharper bends retain lower target speeds',()=>{
 const bytes=fs.readFileSync(new URL('../public/assets/audio/seven-mile-horizon.mp3',import.meta.url));assert.ok(bytes.length>100000);assert.equal(bytes.subarray(0,3).toString(),'ID3');
 const route=JSON.parse(fs.readFileSync(new URL('../public/assets/rebuild/world-route.json',import.meta.url))),classic=curveSpeeds(route),race=curveSpeeds(route,RIVAL_RACE_PROFILE);
 assert.ok(Math.max(...race)>=185);assert.ok(race.some(s=>s<70));assert.ok(race.every((s,i)=>classic[i]>=70||s===classic[i]),'retain the proven tight-corner envelope');assert.ok(race.every(s=>s<=185));assert.ok(rivalPace(0)<rivalPace(4));
});
await initPhysics();
test('faster rival pedals produce higher real speed while all tyres stay on a flat straight',()=>{
 const route={length:6000,points:Array.from({length:1200},(_,i)=>({x:0,y:0,z:i*5,dx:0,dz:1,distance:i*5}))};
 const results=[];
 for(const profile of [null,RIVAL_RACE_PROFILE]){
  const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=STEP;world.createCollider(RAPIER.ColliderDesc.cuboid(30,.5,3200).setTranslation(0,-.5,3000));
  const sim=createVehiclePhysics({sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,start:{x:0,y:.7,z:100},spec:VEHICLES.find(v=>v.id==='gtr'),raceTuning:RACE_TUNING.gtr});let state=sim.snapshot(),index=20,max=0;
  try{
   for(let i=0;i<120;i++){sim.step({brake:1},false);stepVehicleWorld(world);state=sim.finishStep();}
   for(let i=0;i<120*25;i++){index=nearestRoute(route,state.position,index).index;sim.step(aiInput(route,state,index,0,1,[],{speedProfile:profile}),false);stepVehicleWorld(world);state=sim.finishStep();max=Math.max(max,state.kmh);assert.equal(state.contacts,4);}
   results.push({profile:profile?'race':'classic',max,metres:state.position.z-100});
  }finally{sim.dispose();world.free();}
 }
 assert.ok(results[1].max>170&&results[1].max<200);assert.ok(results[1].metres>results[0].metres*1.15);console.log('Rival speed A/B',results);
});
