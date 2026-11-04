import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as studio from '../src/rebuild/vehicleStudio.js';
import {polishWorldSurfaces} from '../src/rebuild/surfacePolish.js';
import {createSceneDisposer} from '../src/rendering/sceneResources.js';
import {createExhaustVfx} from '../src/rebuild/exhaustVfx.js';

test('night exhaust scatters dim blue ambient instead of glowing like rear headlights',()=>{
 const day=createExhaustVfx(),night=createExhaustVfx({night:true});
 try{
  const d=day.root.material.uniforms.ink.value,n=night.root.material.uniforms.ink.value;
  const luma=c=>c.r*.2126+c.g*.7152+c.b*.0722;
  assert.ok(luma(n)<luma(d)*.4&&luma(n)>luma(d)*.2);
  assert.ok(n.b>n.r);assert.equal(night.stats().budget,day.stats().budget);
 }finally{day.dispose();night.dispose();}
});

test('night reflection is a separate blue-hour/warm-harbor bake with no live lights',()=>{
 const scene=studio.createNightVehicleStudio?.()??studio.createVehicleStudio();
 try{
  assert.ok(scene.background.b>scene.background.r*2,'night environment must carry a blue horizon');
  const lamps=[];scene.traverse(o=>{if(o.isMesh&&o.material.color.r>o.material.color.b*1.6)lamps.push(o);assert.ok(!o.isLight);});
  assert.ok(lamps.length>=2,'separated warm harbor light reflections, not a neutral showroom');
  assert.ok(scene.children.length<=8,'baking geometry stays bounded');
  const resources=new Set();scene.traverse(o=>{if(o.isMesh){resources.add(o.geometry);resources.add(o.material);}});
  let disposed=0;for(const r of resources)r.addEventListener('dispose',()=>disposed++);
  scene.dispose();scene.dispose();assert.equal(disposed,resources.size,'one-time ownership');
 }finally{scene.dispose();}
});

for(const options of [{},{night:true},{namak:true}])test(`asphalt has lit aggregate without geometry or texture growth ${JSON.stringify(options)}`,()=>{
 const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({name:'Asphalt'}));root.add(mesh);
 const positions=mesh.geometry.attributes.position.array.slice();
 try{
  const stats=polishWorldSurfaces(root,options);assert.equal(stats.textureBytes,16384);
  const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>'};
  mesh.material.onBeforeCompile(shader);
  assert.match(shader.fragmentShader,/normal=namakRelief\(/,'light must respond to aggregate normals on all tracks');
  assert.match(shader.fragmentShader,/roughnessFactor=clamp\(/,'aggregate changes optical roughness');
  assert.match(shader.fragmentShader,/fwidth\(/,'subpixel aggregate must fade');
  const height=shader.fragmentShader.match(/float surfaceHeight=([^;]+);/)[1];
  assert.ok(!height.includes('ReliefFade'),'do not differentiate a derivative-derived fade');
  assert.match(shader.fragmentShader,/vec2 surfaceGradient=vec2\(dFdx\(surfaceHeight\),dFdy\(surfaceHeight\)\)/);
  assert.match(shader.fragmentShader,/surfaceGradient\*=roadReliefFade/,'fade the first derivative, not its input');
  assert.deepEqual(mesh.geometry.attributes.position.array,positions);assert.equal(Object.keys(shader.uniforms).length,1);
 }finally{createSceneDisposer(root)();}
});

test('aggregate roughness preserves wet-road optical calibration instead of clamping it to dry asphalt',()=>{
 const root=new THREE.Group(),material=new THREE.MeshStandardMaterial({name:'Asphalt'});root.add(new THREE.Mesh(new THREE.PlaneGeometry(),material));
 try{
  polishWorldSurfaces(root);
  // Weather applies this uniform after surface compilation, just as runtime does.
  material.roughness=.48;
  const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>'};material.onBeforeCompile(shader);
  const match=shader.fragmentShader.match(/roughnessFactor=clamp\(roughnessFactor\+fineGrain\*([.\d]+),([.\d]+),([.\d]+)\)/);
  assert.ok(match,'read the final shader expression, not a separate tuning helper');
  const [,amplitude,min,max]=match.map(Number),shade=(base,grain)=>Math.min(max,Math.max(min,base+grain*amplitude));
  assert.equal(shade(material.roughness,0),.48,'wet uniform survives at average grain');
  assert.ok(shade(.48,.1)>shade(.48,-.1),'wet aggregate variation remains visible');
  assert.equal(shade(.88,0),.88,'dry calibration also survives');
 }finally{createSceneDisposer(root)();}
});
