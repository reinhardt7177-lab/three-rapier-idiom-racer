import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCockpit} from '../src/rebuild/cockpit.js';
import {createRaceInput} from '../src/rebuild/raceInput.js';
import {updateSteering,wheelSteering,steeringLimit} from '../src/driving/steering.js';
import {createCockpitDisplay} from '../src/rebuild/cockpitDisplay.js';
import {createSceneDisposer} from '../src/rendering/sceneResources.js';

const bytes=fs.readFileSync(new URL('../public/assets/rebuild/cockpit.glb',import.meta.url));
const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
const load=()=>new GLTFLoader().parseAsync(buffer,'');

test('opaque Blender interior covers the bottom of a landscape camera while the upper windscreen stays open',async()=>{
  for(const compact of [false,true]){
    const {scene}=await load(),camera=new THREE.PerspectiveCamera(compact?78:72,16/9,.04,100);
    const cockpit=createCockpit(scene,camera);cockpit.update(null,true,8000,{compact});camera.updateMatrixWorld(true);
    const ray=new THREE.Raycaster();
    for(const x of [-.98,-.75,-.5,-.25,0,.25,.5,.75,.98]){
      ray.setFromCamera(new THREE.Vector2(x,-.98),camera);
      const hits=ray.intersectObject(scene,true).filter(h=>h.object.material.opacity===1);
      assert.ok(hits.length,`road leaks under cockpit: compact=${compact} x=${x}`);
    }
    for(const x of [-.4,0,.4]){
      ray.setFromCamera(new THREE.Vector2(x,.25),camera);
      assert.equal(ray.intersectObject(scene,true).length,0,'keep the central windscreen clear');
    }
    createSceneDisposer(camera)();
  }
});

test('Blender GLB retains editable independent steering/gauge pivots and stays inside a small web asset budget',async()=>{
  const {scene}=await load();
  assert.ok(fs.statSync(new URL('../assets-sources/cockpit-v1/cockpit.blend',import.meta.url)).size>100000);
  assert.ok(bytes.length<2_000_000);
  const root=scene.getObjectByName('CockpitRoot');assert.equal(root.userData.cockpit_rig_version,1);
  for(const name of ['SteeringWheel','SpeedNeedle','RPMNeedle']){
    const pivot=scene.getObjectByName(name);assert.ok(pivot);assert.equal(pivot.parent,root);assert.ok(pivot.children.length>0);
  }
  let meshes=0,triangles=0;scene.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
  assert.ok(meshes<=24);assert.ok(triangles<45000);
  createSceneDisposer(scene)();
});

test('actual cockpit needles point at their labeled values and steering leaves the asset geometry unchanged',async()=>{
  const {scene}=await load(),camera=new THREE.PerspectiveCamera(),cockpit=createCockpit(scene,camera);
  const box=new THREE.Box3().setFromObject(scene),centre=new THREE.Vector3();box.getCenter(centre);
  assert.ok(centre.z<-.6&&centre.z> -2);
  const geometry=[];scene.traverse(o=>{if(o.isMesh)geometry.push(o.geometry.attributes.position.array.slice());});
  for(const [kmh,rpm,steering] of [[0,0,0],[130,4000,.3],[260,8000,-.3]]){
    cockpit.update({kmh,powertrain:{rpm},wheels:[{}, {steering}]},true);
    const state=cockpit.status();assert.ok(Math.abs(state.speedNeedle-(130-kmh/260*260)*Math.PI/180)<1e-9);
    assert.ok(Math.abs(state.rpmNeedle-(130-rpm/8000*260)*Math.PI/180)<1e-9);
    assert.ok(Number.isFinite(state.steeringAngle));
    const direction=new THREE.Vector3(0,1,0).applyQuaternion(scene.getObjectByName('SpeedNeedle').quaternion);
    if(kmh===0)assert.ok(direction.x<0&&direction.y<0);
    if(kmh===130)assert.ok(Math.abs(direction.x)<1e-8&&direction.y>.99);
    if(kmh===260)assert.ok(direction.x>0&&direction.y<0);
  }
  let index=0;scene.traverse(o=>{if(o.isMesh)assert.deepEqual(o.geometry.attributes.position.array,geometry[index++]);});
  cockpit.update(null,false);assert.equal(cockpit.status().visible,false);
  cockpit.update(null,true,8000,{compact:true});
  assert.ok(scene.position.z<-.3&&scene.position.y<-.1);
  cockpit.update(null,true);assert.deepEqual(scene.position.toArray(),[0,0,0]);
  const host=new THREE.Scene();host.add(camera);createSceneDisposer(host)();
});

test('camera-mounted hidden interior and its fill light release through scene disposal exactly once',async()=>{
  const {scene}=await load(),camera=new THREE.PerspectiveCamera(),host=new THREE.Scene();host.add(camera);
  createCockpit(scene,camera).update(null,false);
  const resources=new Set(),textures=new Set();scene.traverse(o=>{if(o.isMesh){resources.add(o.geometry);resources.add(o.material);for(const value of Object.values(o.material))if(value?.isTexture){resources.add(value);textures.add(value);}}});
  assert.equal(textures.size,2,'atlas and shared leather grain are owned by the interior');
  const counts=new Map([...resources].map(r=>[r,0]));for(const r of resources)r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));
  const dispose=createSceneDisposer(host);dispose();dispose();assert.ok([...counts.values()].every(n=>n===1));
});

test('digital instruments show real over-range speed and reverse gear; hidden cockpit skips texture uploads',async()=>{
  const {scene}=await load(),camera=new THREE.PerspectiveCamera(),cockpit=createCockpit(scene,camera);
  const vehicle={kmh:289.4,gear:'R',powertrain:{rpm:7234.2}},music={title:'Seven Mile Horizon',playing:true,wanted:true};
  cockpit.update(vehicle,true,7600,{music,now:0});
  assert.deepEqual(cockpit.status().display.readout,{kmh:289,gear:'R',rpm:7234,redline:7600,musicTitle:'Seven Mile Horizon',musicState:'PLAYING'});
  const uploads=cockpit.status().display.uploads;
  cockpit.update({...vehicle,kmh:98},false,7600,{music,now:1000});
  assert.equal(cockpit.status().display.uploads,uploads);
  cockpit.update({...vehicle,kmh:98},true,7600,{music:{...music,playing:false},now:1001});
  assert.equal(cockpit.status().display.readout.kmh,98);
  assert.equal(cockpit.status().display.readout.musicState,'PAUSED');
  createSceneDisposer(camera)();
});

test('display draws telemetry onto one atlas at most ten times a second and retains the latest value',()=>{
  const calls=[],context={fillRect(){},fillText(value){calls.push(value);}},canvas={getContext:()=>context};
  const material=new THREE.MeshStandardMaterial(),display=createCockpitDisplay(material,{canvas});
  assert.equal(material.map,material.emissiveMap);
  for(let now=0;now<1000;now+=10)display.update({kmh:now/10,gear:3,powertrain:{rpm:4000}},null,8000,now);
  assert.equal(display.status().uploads,10);
  display.update({kmh:113,gear:4,powertrain:{rpm:5600}},{title:'Slipstream Pursuit',wanted:false},8000,1000);
  assert.ok(calls.includes('113'));assert.ok(calls.includes('5600 RPM'));assert.ok(calls.includes('SLIPSTREAM PURSUIT'));assert.equal(calls.at(-1),'OFF');
  display.update({kmh:113,gear:4,powertrain:{rpm:5600}},{title:'Slipstream Pursuit',wanted:false},8000,2000);
  assert.equal(display.status().uploads,11,'unchanged instrument values do not upload again');
  display.texture.dispose();material.dispose();
});

test('first-person Blender wheel stripe turns toward keyboard and touch steering, including reverse and compact views',async()=>{
  const {scene}=await load(),camera=new THREE.PerspectiveCamera(72,16/9,.04,100),cockpit=createCockpit(scene,camera);
  const stripe=scene.getObjectByName('WheelCentreStripe');assert.ok(stripe,'actual Blender wheel has an upper centre stripe');
  const projectedStripe=()=>{camera.updateMatrixWorld(true);return stripe.getWorldPosition(new THREE.Vector3()).project(camera);};
  for(const compact of [false,true])for(const gear of ['1','R']){
    for(const [code,source,side] of [['KeyA','keyboard',-1],['KeyD','keyboard',1],['ArrowLeft','keyboard',-1],['ArrowRight','keyboard',1],['ArrowLeft','pointer-1',-1],['ArrowRight','pointer-1',1]]){
      const input=createRaceInput();input.press(code,source);assert.equal(input.read().steer,side);
      let rack=0;for(let i=0;i<24;i++)rack=updateSteering(rack,input.read().steer,1/120);
      const frontAngles=wheelSteering(rack*steeringLimit(15));
      // The +Z-facing car's left is +X; from the driver's seat it projects left.
      const tyreRolling=new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0),frontAngles[1]);
      assert.ok(-tyreRolling.x*side>0,'physical front tyre faces the requested side');
      cockpit.update({gear,wheels:[{},{steering:0}]},true,8000,{compact});const neutral=projectedStripe();
      cockpit.update({gear,wheels:frontAngles.map(steering=>({steering}))},true,8000,{compact});const turned=projectedStripe();
      assert.ok((turned.x-neutral.x)*side>.01,code+' / '+source+' / '+gear+' / compact='+compact+' wheel stripe moves opposite the driver input');
      input.release(code,source);assert.equal(input.read().steer,0);
      cockpit.update({gear,wheels:[{},{steering:0}]},true,8000,{compact});
      assert.ok(Math.abs(projectedStripe().x-neutral.x)<1e-9,'released rack returns the displayed wheel to centre');
    }
  }
  createSceneDisposer(camera)();
});
