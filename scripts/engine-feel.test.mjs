import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ENGINE_VOICES,engineVoice,engineWave} from '../src/driving/engineVoices.js';
import {audioMix,createDrivingAudio,createEngineResponse} from '../src/driving/drivingAudio.js';
import {RACE_TUNING,createRaceDrivetrain} from '../src/rebuild/vehicleDynamics.js';
import {VEHICLES} from '../src/rebuild/fleet.js';
import {initPhysics,createVehiclePhysics,STEP} from '../src/driving/physics.js';

test('eight original voices have distinct spectra and pitch follows actual RPM, not road speed',()=>{
 const spectra=new Set();
 for(const car of VEHICLES){
  const profile=engineVoice(car.id),wave=engineWave(car.id);assert.notEqual(profile,ENGINE_VOICES.legacy);
  assert.ok(wave.imag.every(Number.isFinite));assert.ok(wave.real.every(v=>v===0));assert.equal(wave.imag[0],0);
  spectra.add(JSON.stringify([...wave.imag]));
  const engine={rpm:4200,load:.7,shifting:true},s={kmh:100,gear:'3',drive:1,powertrain:engine};
  const mix=audioMix(s,{},car.id),sameRpm=audioMix({...s,kmh:180}, {},car.id);
  assert.equal(mix.rpm,4200);assert.equal(mix.hz,4200*profile.pulses/60);assert.equal(mix.hz,sameRpm.hz);
  assert.equal(mix.shifting,true);assert.equal(audioMix({...s,brake:1}, {},car.id).load,0);
 }
 assert.equal(spectra.size,8);assert.equal(engineVoice('missing'),ENGINE_VOICES.legacy);
});
test('voice changes reset response, pause holds RPM, and recovery clears stale shift history',()=>{
 const response=createEngineResponse('mustang');let old;
 for(let i=0;i<=60;i++)old=response.update({elapsed:i/60,powertrain:{rpm:5000,load:1},gear:'2'});
 assert.ok(old.rpm>4800);assert.equal(response.update({elapsed:1,powertrain:{rpm:850}}).rpm,old.rpm);
 response.reset('huracan');const fresh=response.update({elapsed:0,powertrain:{rpm:850}});assert.equal(fresh.rpm,850);assert.equal(fresh.hz,850*5/60);
});
test('vehicle pedal response, shift interruption and engine braking really reach the drivetrain',()=>{
 const muscle=createRaceDrivetrain(RACE_TUNING.mustang,.365),exotic=createRaceDrivetrain(RACE_TUNING.huracan,.35);
 const m=muscle.update({speed:3,drive:1},.05),h=exotic.update({speed:3,drive:1},.05);assert.ok(h.load>m.load+.15);
 for(const car of VEHICLES){
  const tuning=RACE_TUNING[car.id],drive=createRaceDrivetrain(tuning,car.wheelRadius);
  const speed=(tuning.redline-350)*car.wheelRadius*2*Math.PI/(60*tuning.ratios[0]*tuning.finalDrive);
  assert.ok(drive.update({speed,drive:1},STEP).shifting);
  for(let i=0;i<Math.floor(tuning.shiftDuration/STEP)-2;i++)assert.ok(drive.update({speed,drive:1},STEP).shifting);
  for(let i=0;i<5;i++)drive.update({speed,drive:1},STEP);
  assert.equal(drive.snapshot().shifting,false);
  assert.ok(drive.update({speed:15,drive:0},STEP).force<0);assert.equal(drive.update({speed:15,drive:1,brake:1},STEP).force,0);
  drive.reset();assert.equal(drive.snapshot().gear,'N');assert.equal(drive.snapshot().force,0);
 }
});
test('Web Audio changes voices on one graph, ducks real shifts, silences pause/mute and releases sources',async()=>{
 const original=globalThis.AudioContext,instances=[];
 class Audio {
  constructor(){this.state='suspended';this.currentTime=0;this.sampleRate=100;this.sources=[];this.gains=[];instances.push(this);}
  param(){return {value:0,setTargetAtTime(v){assert.ok(Number.isFinite(v));this.value=v;},cancelScheduledValues(){},setValueAtTime(v){this.value=v;}};}
  createGain(){const g={gain:this.param(),connect(){},disconnect(){}};this.gains.push(g);return g;}
  createBiquadFilter(){return {frequency:this.param(),Q:this.param(),connect(){}};}
  createPeriodicWave(real,imag){return {real,imag};}
  createDynamicsCompressor(){return {threshold:this.param(),knee:this.param(),ratio:this.param(),attack:this.param(),release:this.param(),connect(){},disconnect(){this.disconnected=true;}};}
  source(){const s={frequency:this.param(),connect(){},start(){},stop(){this.stopped=true;},setPeriodicWave(w){this.wave=w;}};this.sources.push(s);return s;}
  createOscillator(){return this.source();}createBufferSource(){return this.source();}
  createBuffer(){return {getChannelData:()=>new Float32Array(200)};}
  async resume(){this.state='running';}async close(){this.state='closed';}
 }
 globalThis.AudioContext=Audio;
 try{
  const audio=createDrivingAudio();audio.setVehicle('supra');assert.equal(instances.length,0,'voice selection must not request audio permission');
  await audio.setEnabled(true);const graph=instances[0],engine=graph.sources[0],sourceCount=graph.sources.length;
  for(const car of VEHICLES){audio.setVehicle(car.id);assert.deepEqual([...engine.wave.imag],[...engineWave(car.id).imag]);}
  assert.equal(instances.length,1);assert.equal(graph.sources.length,sourceCount);
  const s={elapsed:1,kmh:100,gear:'2',drive:1,powertrain:{rpm:4200,load:1,shifting:false}};
  audio.update(s);const gain=graph.gains[1].gain.value;
  audio.update({...s,elapsed:1+STEP,powertrain:{...s.powertrain,shifting:true}});assert.ok(graph.gains[1].gain.value<gain*.6);
  assert.equal(engine.frequency.value,audio.status().mix.hz);assert.ok(audio.status().audible);
  audio.setPaused(true);assert.equal(graph.gains[0].gain.value,0);assert.equal(audio.status().audible,false);
  audio.setPaused(false);await audio.setEnabled(false);assert.equal(graph.gains[0].gain.value,0);
  audio.setVehicle('rx7');assert.equal(audio.status().enabled,false);assert.equal(audio.status().shiftCount,0);
  audio.dispose();assert.equal(graph.state,'closed');assert.ok(graph.sources.every(s=>s.stopped));audio.setVehicle('supra');assert.equal(instances.length,1);
 }finally{globalThis.AudioContext=original;}
});

await initPhysics();
test('eight tuned vehicles accelerate, change gears and coast with stable supported chassis',()=>{
 const results=[];
 for(const car of VEHICLES){
  const sim=createVehiclePhysics({barriers:false,arcade:true,launchEnabled:false,progressiveAcceleration:true,spec:car,raceTuning:RACE_TUNING[car.id],start:{x:0,y:.85,z:-400}});
  try{
   for(let i=0;i<120;i++)sim.step({brake:1});let s=sim.snapshot(),time100=null,shifts=0,lastGear=s.gear,peakTilt=0;
   for(let i=0;i<120*10&&s.kmh<110;i++){
    s=sim.step({throttle:1});if(s.kmh>=100&&time100===null)time100=(i+1)*STEP;
    if(s.gear!==lastGear&&s.powertrain.shifting)shifts++;lastGear=s.gear;
    assert.equal(s.contacts,4);peakTilt=Math.max(peakTilt,Math.abs(s.rotation.x),Math.abs(s.rotation.z));
    assert.equal(audioMix(s,{},car.id).rpm,s.powertrain.rpm);
   }
   assert.ok(time100>2.5&&time100<10,`${car.id}: no usable acceleration`);assert.ok(shifts>0);assert.ok(peakTilt<.0001,'powertrain must not restore chassis rocking');
   const before=s.kmh;for(let i=0;i<120;i++)s=sim.step({});assert.ok(s.kmh<before-1,'coast must slow the physical car');
   results.push({id:car.id,time100,shifts,peakTilt,coastLoss:before-s.kmh});
  }finally{sim.dispose();}
 }
 fs.mkdirSync(new URL('../artifacts/engine-feel-20261010/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../artifacts/engine-feel-20261010/physical-fleet.json',import.meta.url),JSON.stringify(results,null,2));console.log(results);
 assert.ok(Math.max(...results.map(r=>r.time100))-Math.min(...results.map(r=>r.time100))>.4,'fleet dynamics must have measurable differences');
});
