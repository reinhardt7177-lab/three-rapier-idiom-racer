import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createNamakPresentation,NAMAK_PARKING,outdoorLighting} from '../src/rebuild/namakPresentation.js';
import {polishWorldSurfaces} from '../src/rebuild/surfacePolish.js';
import {batchWorldScenery} from '../src/rebuild/worldRendering.js';
import {createSceneDisposer} from '../src/rendering/sceneResources.js';
import {steeringLimit,wheelSteering} from '../src/driving/steering.js';
import {initPhysics,createVehiclePhysics,STEP} from '../src/driving/physics.js';
import {VEHICLES} from '../src/rebuild/fleet.js';
import {RACE_TUNING} from '../src/rebuild/vehicleDynamics.js';
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url));
const parse=async id=>{const b=read(`public/assets/rebuild/${id}.glb`);return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;};

test('Blender corridor has dense street furniture and improved facades within the existing download budget',async()=>{
 const report=JSON.parse(read('artifacts/namak-20261010/map-report.json'));
 assert.equal(report.roadside.stops,4);assert.ok(report.roadside.planters>=80&&report.roadside.benches>=60&&report.roadside.bollards>=240&&report.roadside.drains>=120);
 assert.ok(report.bytes<20_000_000);const scene=await parse('namak');
 for(const part of ['BusShelterRoof','Boulevard_RetailPodium','Park_StreetCafe','GraniteKerb','FlowerBed']){
  let exists=false;scene.traverse(o=>{if(o.name.startsWith(part))exists=true;});assert.ok(exists,part);
 }
 // A pedestrian-height view must hit the shop glass, not the old 2.4m solid
 // plinth that covered the entire ground floor. This checks exported geometry.
 const facadeRay=new THREE.Raycaster(new THREE.Vector3(148.4,1.7,24),new THREE.Vector3(0,0,1),0,5);scene.updateMatrixWorld(true);
 assert.equal(facadeRay.intersectObject(scene,true)[0]?.object.material.name,'Namak_Glass');
 // Front facing cylinder sides survive export: side normals point away from
 // the axis rather than disappearing behind back-face culling.
 const source=read('scripts/blender/build_namak.py').toString();assert.ok(source.includes('f.append((n,k,k+segments,n+segments))'));
 createSceneDisposer(scene)();
});

test('parked display placements remain outside the race corridor, share buffers, cull by distance and survive batching',()=>{
 const route=JSON.parse(read('public/assets/rebuild/namak-route.json'));
 // Ownership/placement fixtures use real vehicle dimensions. The compressed
 // authored models themselves are decoded and visually checked in the browser.
 const template=id=>{const v=VEHICLES.find(v=>v.id===id),root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(v.width,1.3,v.length),new THREE.MeshStandardMaterial()));return root;};
 const world=new THREE.Group(),supra=template('supra'),mustang=template('mustang'),owned=new THREE.Group();owned.add(world,supra,mustang);
 supra.visible=mustang.visible=false;
 const presentation=createNamakPresentation(world,{supra,mustang}),parked=[...world.children];
 assert.equal(parked.length,4);const originals=new Set();for(const model of [supra,mustang])model.traverse(o=>{if(o.geometry)originals.add(o.geometry);});
 for(let i=0;i<parked.length;i++){
  const root=parked[i],p=NAMAK_PARKING[i];root.updateMatrixWorld(true);
  const b=new THREE.Box3().setFromObject(root);assert.ok(Math.abs(b.min.y-.14)<1e-5);
  assert.ok(Math.min(...route.points.map(q=>Math.hypot(p.x-q.x,p.z-q.z)))>21);
  root.traverse(o=>{assert.ok(!o.userData.unity_collider);if(o.geometry)assert.ok(originals.has(o.geometry));});
 }
 batchWorldScenery(world);assert.equal(world.children.length,4);
 presentation.update({position:new THREE.Vector3(80,5,23)});assert.equal(presentation.stats.visibleParkedCars,1);
 world.visible=false;presentation.update({position:new THREE.Vector3(80,5,23)});assert.equal(presentation.stats.visibleParkedCars,0);
 const disposed=new Map();for(const g of originals){disposed.set(g,0);g.addEventListener('dispose',()=>disposed.set(g,disposed.get(g)+1));}
 createSceneDisposer(owned)();for(const count of disposed.values())assert.equal(count,1);
});

test('world relief adds only one shared texture and preserves all physics vertices and coastal lighting',()=>{
 const scene=new THREE.Scene(),geometry=new THREE.BoxGeometry(),before=geometry.attributes.position.array.slice();
 const names=['Asphalt','Paving','Namak_Brick','Namak_Stone','Namak_Wood','Water'];
 const materials=names.map(name=>new THREE.MeshStandardMaterial({name}));materials.forEach(m=>scene.add(new THREE.Mesh(geometry,m)));
 const stats=polishWorldSurfaces(scene,{namak:true});assert.equal(stats.textureBytes,16384);assert.equal(stats.surfaces,names.length);
 assert.deepEqual(geometry.attributes.position.array,before);assert.equal(new Set(materials.map(m=>m.surfaceGrain)).size,1);
 for(const m of materials){const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>\n#include <normal_fragment_maps>'};m.onBeforeCompile(shader);assert.ok(shader.fragmentShader.includes('normal=namakRelief('));}
 let disposed=0;materials[0].surfaceGrain.addEventListener('dispose',()=>disposed++);createSceneDisposer(scene)();assert.equal(disposed,1);
 assert.deepEqual(outdoorLighting(),{ambient:.45,sun:2,exposure:.85,environment:.32,fogNear:800,fogFar:2600});assert.ok(outdoorLighting(true).sun>outdoorLighting().sun);
});

test('player steering is exactly 1.3 times at road speeds with the original low-speed rack stop and mirrored wheel axes',()=>{
 const spec={...VEHICLES[0],steeringAcceleration:RACE_TUNING.supra.steeringAcceleration??12.8};
 for(const kmh of [40,100,180,230]){
  const original=steeringLimit(kmh/3.6,true,spec),enhanced=steeringLimit(kmh/3.6,true,spec,1.3);
  assert.ok(Math.abs(enhanced/original-1.3)<1e-12);assert.equal(enhanced,steeringLimit(-kmh/3.6,true,spec,1.3));
  const left=wheelSteering(enhanced,spec),right=wheelSteering(-enhanced,spec);assert.equal(left[0],0);assert.equal(left[2],0);assert.equal(left[1],-right[3]);
 }
 assert.equal(steeringLimit(0,true,spec,1.3),.52);
});

test('enhanced steering actually turns the Rapier front wheels and stays upright at 100 and 180km/h',async()=>{
 await initPhysics();const spec=VEHICLES.find(v=>v.id==='supra');
 for(const target of [100,180])for(const direction of [-1,1]){
  const sim=createVehiclePhysics({barriers:false,launchEnabled:false,arcade:true,progressiveAcceleration:true,start:{x:0,y:1,z:-500},spec,raceTuning:RACE_TUNING.supra,steeringSensitivity:1.3});
  try{
   let s;for(let i=0;i<120;i++)s=sim.step({brake:1});
   for(let i=0;i<2400&&s.kmh<target;i++)s=sim.step({throttle:1});assert.ok(s.kmh>=target,`reach ${target}`);
   for(let i=0;i<60;i++){
    const previousSpeed=s.speed;
    s=sim.step({throttle:.2,steer:direction});
    assert.equal(s.contacts,4);assert.ok(1-2*(s.rotation.x**2+s.rotation.z**2)>.97);
    const baseline=steeringLimit(s.speed,true,{...spec,steeringAcceleration:RACE_TUNING.supra.steeringAcceleration??12.8});
    assert.ok(Math.abs(s.steeringLimit/baseline-1.3)<1e-12);
    const appliedLimit=steeringLimit(previousSpeed,true,{...spec,steeringAcceleration:RACE_TUNING.supra.steeringAcceleration??12.8},1.3);
    assert.ok(Math.abs(s.steer-s.steerInput*appliedLimit)<1e-10);
    wheelSteering(s.steer,spec).forEach((angle,j)=>assert.ok(Math.abs(s.wheels[j].steering-angle)<1e-8));
   }
   assert.ok(s.position.x*direction<-.2);console.log(JSON.stringify({target,direction,kmh:s.kmh,contacts:s.contacts,steer:s.steer,sensitivity:s.steeringSensitivity}));
  }finally{sim.dispose();}
 }
});
