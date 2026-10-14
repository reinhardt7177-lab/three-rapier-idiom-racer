import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {polishVehicleMaterial} from '../src/rebuild/surfacePolish.js';
import {VEHICLES} from '../src/rebuild/fleet.js';
import {createVehicleStudio,addVehicleReflectionGround} from '../src/rebuild/vehicleStudio.js';
const report=JSON.parse(fs.readFileSync(new URL('../artifacts/vehicle-finish-20261013/blender-report.json',import.meta.url)));
const baseline=JSON.parse(fs.readFileSync(new URL('../artifacts/vehicle-finish-20261013/before-vehicle-manifest.json',import.meta.url)));
const read=id=>{const b=fs.readFileSync(new URL(`../public/assets/rebuild/${id}.glb`,import.meta.url));return {b,g:JSON.parse(b.subarray(20,20+b.readUInt32LE(12)))};};
for(const v of VEHICLES)test(`${v.id}: polished export preserves mechanical transforms, paint and tyre dimensions`,()=>{
 const {b,g}=read(v.id),r=report.find(r=>r.id===v.id);
 assert.deepEqual(r.rigAfter,r.rigBefore,'Chassis/suspension/steering/spin matrices must stay identical');
 assert.equal(g.nodes.find(n=>n.name==='Chassis_Rig').extras.vehicle_finish_revision,1);
 assert.equal(g.nodes.find(n=>n.extras?.wheel_radius).extras.wheel_radius,v.wheelRadius);
 const rig=g.nodes.filter(n=>/^(Chassis_Rig|Wheel_|Steering_|Suspension_)/.test(n.name)).map(n=>({name:n.name,translation:n.translation,rotation:n.rotation,scale:n.scale,matrix:n.matrix}));
 assert.deepEqual(JSON.parse(JSON.stringify(rig)),baseline[v.id].rig);
 const triangles=g.meshes.reduce((s,m)=>s+m.primitives.reduce((s,p)=>s+g.accessors[p.indices].count/3,0),0);
 assert.equal(r.compactPorts,80);assert.ok(triangles<baseline[v.id].triangles-10000,'Tiny rotor inserts must actually reduce geometry');
 assert.ok(b.length<1_000_000);assert.equal(g.images?.length??0,0,'No new download textures');
 assert.ok(g.meshes.reduce((s,m)=>s+m.primitives.length,0)<=baseline[v.id].primitives+8,'Two-tone spokes must batch per wheel, not multiply draw submissions');
 const names=g.materials.map(m=>m.name);
 for(const name of ['Finish_MirrorSilver','Finish_CarbonWeave','Finish_TwoToneAlloy'])assert.ok(names.includes(name),name);
 const colored=g.nodes.filter(n=>n.mesh!==undefined&&g.meshes[n.mesh].primitives.some(p=>g.materials[p.material].name==='Finish_TwoToneAlloy'));assert.equal(colored.length,4);
 for(const n of colored){assert.equal(n.extras?.dynamic,true,'Runtime batching must preserve wheel colour attributes');const primitives=g.meshes[n.mesh].primitives;assert.equal(primitives.length,1);assert.ok(primitives[0].attributes.COLOR_0!==undefined);}
 if(v.id!=='rx7')assert.ok(names.includes('Finish_LampPolymer'));
 const paint=g.materials.find(m=>m.name.endsWith('Exterior_NewPaint'));
 assert.deepEqual(paint.pbrMetallicRoughness.baseColorFactor,baseline[v.id].paint);
 assert.ok(paint?.extensions?.KHR_materials_clearcoat?.clearcoatFactor>.75);
 for(const code of ['FL','FR','RL','RR'])for(const prefix of ['Suspension_','Steering_','Wheel_'])assert.ok(g.nodes.find(n=>n.name===prefix+code));
});
test('reflection studio adds no racing lights and disposes baking resources once',()=>{
 const scene=createVehicleStudio();assert.equal(scene.children.filter(o=>o.isLight).length,0);assert.equal(scene.children.length,6);
 const resources=new Set();scene.traverse(o=>{if(o.isMesh){resources.add(o.geometry);resources.add(o.material);}});let disposed=0;for(const r of resources)r.addEventListener('dispose',()=>disposed++);scene.dispose();scene.dispose();assert.equal(disposed,resources.size);
 const outdoor=new THREE.Scene(),remove=addVehicleReflectionGround(outdoor);assert.equal(outdoor.children.length,1);remove();assert.equal(outdoor.children.length,0);
});
test('windows, lens and mirrors keep independent opaque finishes without transmission passes',()=>{
 const glass=new THREE.MeshPhysicalMaterial({name:'V6_Detail_Glass',color:'#082030'}),color=glass.color.clone();polishVehicleMaterial(glass);
 assert.ok(glass.color.equals(color));assert.ok(glass.envMapIntensity<=.5);assert.equal(glass.transmission,0);assert.equal(glass.transparent,false);
 const lens=new THREE.MeshPhysicalMaterial({name:'Finish_LampPolymer'}),mirror=new THREE.MeshPhysicalMaterial({name:'Finish_MirrorSilver'});polishVehicleMaterial(lens);polishVehicleMaterial(mirror);
 assert.ok(lens.envMapIntensity>glass.envMapIntensity);assert.ok(mirror.metalness>.9);[glass,lens,mirror].forEach(m=>m.dispose());
});
test('carbon shader composes existing hooks once and fades weave below a pixel',()=>{
 const material=new THREE.MeshPhysicalMaterial({name:'Finish_CarbonWeave'});let previous=0;
 material.onBeforeCompile=()=>previous++;polishVehicleMaterial(material);const cache=material.customProgramCacheKey();polishVehicleMaterial(material);assert.equal(material.customProgramCacheKey(),cache);
 const shader={vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>',uniforms:{}};material.onBeforeCompile(shader,null);
 assert.equal(previous,1);assert.match(shader.fragmentShader,/fwidth/);assert.match(shader.fragmentShader,/weaveFade/);assert.match(shader.vertexShader,/finishPosition=position/);
 assert.equal(Object.keys(shader.uniforms).length,0);assert.equal(material.transparent,false);assert.equal(material.transmission,0);material.dispose();
});
test('one-draw alloy retains cut-face and graphite shading through vertex colours without extra textures',()=>{
 const material=new THREE.MeshPhysicalMaterial({name:'Finish_TwoToneAlloy',vertexColors:true});polishVehicleMaterial(material);const cache=material.customProgramCacheKey();polishVehicleMaterial(material);assert.equal(material.customProgramCacheKey(),cache);
 const shader={fragmentShader:'#include <metalnessmap_fragment>',uniforms:{}};material.onBeforeCompile(shader,null);
 assert.match(shader.fragmentShader,/#ifdef USE_COLOR/);assert.match(shader.fragmentShader,/vColor.rgb/);assert.match(shader.fragmentShader,/metalnessFactor=mix\(\.82,\.92,alloyCut\)/);assert.match(shader.fragmentShader,/roughnessFactor=mix\(\.31,\.22,alloyCut\)/);
 assert.equal(Object.keys(shader.uniforms).length,0);assert.equal(material.transparent,false);material.dispose();
});
