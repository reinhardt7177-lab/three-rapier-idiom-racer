import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createSeongsamjaeVisuals,SEONGSAMJAE_VISUAL_BUDGETS} from '../src/rebuild/seongsamjaeVisuals.js';
import {polishWorldSurfaces} from '../src/rebuild/surfacePolish.js';
import {applyKoreaPalette} from '../src/rebuild/koreaPresentation.js';
import {batchWorldScenery} from '../src/rebuild/worldRendering.js';
import {createSceneDisposer} from '../src/rendering/sceneResources.js';

const read=name=>fs.readFileSync(new URL(`../public/assets/rebuild/${name}`,import.meta.url));
const bytes=read('seongsamjae.glb'),route=JSON.parse(read('seongsamjae-route.json'));
const {scene:base}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
polishWorldSurfaces(base);applyKoreaPalette(base,'seongsamjae');batchWorldScenery(base);
test.after(()=>createSceneDisposer(base)());
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const materialsOf=o=>Array.isArray(o.material)?o.material:[o.material];
function fixture(quality='high'){
 const scene=new THREE.Scene(),world=base.clone(true);scene.add(world);world.updateMatrixWorld(true);
 const source=[];world.traverse(o=>{if(o.isMesh)source.push({object:o,geometry:o.geometry,positionHash:hash(Buffer.from(o.geometry.attributes.position.array.buffer)),matrix:o.matrixWorld.elements.slice(),material:o.material,visible:o.visible,collider:o.userData.unity_collider});});
 const v=createSeongsamjaeVisuals(scene,world,route,{quality});return {scene,world,source,v};
}
function roadDistance(x,z){
 let d=Infinity;for(let i=0;i<route.points.length;i++){
  const a=route.points[i],b=route.points[(i+1)%route.points.length],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));
  d=Math.min(d,Math.hypot(x-a.x-dx*t,z-a.z-dz*t));
 }return d;
}

test('seongsamjae details preserve every recovered geometry, road material, collider and route byte',()=>{
 const routeBefore=JSON.stringify(route),glbBefore=hash(bytes),{source,v}=fixture();
 try{
  for(const s of source){const o=s.object;assert.equal(o.geometry,s.geometry);assert.equal(hash(Buffer.from(o.geometry.attributes.position.array.buffer)),s.positionHash);assert.deepEqual(o.matrixWorld.elements,s.matrix);assert.equal(o.userData.unity_collider,s.collider);if(o.name.includes('Road_Asphalt'))assert.equal(o.material,s.material);}
  assert.equal(v.stats.addedNetworkBytes,0);assert.equal(v.stats.generatedTextureBytes,2*256*256*4);assert.equal(JSON.stringify(route),routeBefore);assert.equal(hash(read('seongsamjae.glb')),glbBefore);
 }finally{v.dispose();}
});

test('seongsamjae shrubs, mossy stones and crown lobes keep the whole return-road corridor clear',()=>{
 const {v}=fixture(),matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion();let checked=0;
 try{
  assert.ok(v.placements.length>250,'there must be visible roadside detail, not only palette changes');
  v.root.traverse(o=>{if(!o.isInstancedMesh)return;o.geometry.computeBoundingSphere();for(let i=0;i<o.count;i++){
   o.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);const radius=o.geometry.boundingSphere.radius*Math.max(scale.x,scale.z);
   assert.ok(roadDistance(position.x,position.z)-radius>=14-1e-5,`${o.name} instance ${i} intrudes on the racing corridor`);checked++;
  }});
  assert.ok(checked>1000);const ridge=v.root.getObjectByName('Jirisan_Continuous_Ridge');assert.ok(ridge);const p=ridge.geometry.attributes.position;
  for(let i=0;i<p.count;i++)assert.ok(roadDistance(p.getX(i),p.getZ(i))>65,'distant ridge intrudes on a hairpin or view corridor');
 }finally{v.dispose();}
});

test('seongsamjae underside decoration uses real terrain triangles and stays at their surface',()=>{
 const {world,v}=fixture(),ground=[];world.traverse(o=>{if(o.isMesh&&materialsOf(o).some(m=>/^Terrain(_JirisanDetail)?$/.test(m.name)))ground.push(o);});
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);ray.far=12;
 try{
  for(let i=0;i<v.placements.length;i+=7){const p=v.placements[i];ray.set(new THREE.Vector3(p.x,p.groundY+1,p.z),down);const hit=ray.intersectObjects(ground,false)[0];assert.ok(hit,`no actual rendered ground at ${i}`);assert.ok(Math.abs(hit.point.y-p.groundY)<.001);if(p.type==='fern')assert.equal(p.y,p.groundY);else assert.ok(p.y-p.sy<p.groundY,'stone bases must not float');}
 }finally{v.dispose();}
});

test('seongsamjae high and medium cull cells and canopy replacements within explicit draw budgets',()=>{
 const {v}=fixture(),camera=new THREE.PerspectiveCamera();
 try{
  for(const quality of ['high','medium']){v.setQuality(quality);const budget=SEONGSAMJAE_VISUAL_BUDGETS[quality];
   for(let i=0;i<route.points.length;i+=123){const p=route.points[i];camera.position.set(p.x,p.y+2,p.z);v.update(camera,1/60,0,true);assert.ok(v.stats.visibleDraws<=budget.cells*2+budget.canopies+1);assert.ok(v.stats.newDecorationDraws<=budget.cells*2+1);}
  }
  v.update(camera,0,0,false);assert.equal(v.root.visible,false);assert.equal(v.stats.visibleDraws,0);
 }finally{v.dispose();}
});

test('seongsamjae low quality restores materials and adds no draws or override of existing visibility culling',()=>{
 const {source,v}=fixture(),camera=new THREE.PerspectiveCamera();camera.position.set(route.points[0].x,2,route.points[0].z);
 try{
  v.update(camera,1/60,0,true);assert.ok(v.stats.visibleDraws>0);v.setQuality('low');
  for(const s of source)assert.equal(s.object.material,s.material);
  const leaf=source.find(s=>materialsOf(s.object).some(m=>m.name==='Leaf')).object;leaf.visible=false;
  v.update(camera,1/60,10,true);assert.equal(leaf.visible,false,'detail update must not undo decorationQuality culling');assert.equal(v.stats.visibleDraws,0);assert.equal(v.stats.newDecorationDraws,0);assert.equal(v.stats.visibleTriangles,0);assert.equal(v.root.visible,false);
  v.setQuality('medium');v.update(camera,1/60,10,true);assert.ok(v.stats.visibleDraws>0);
 }finally{v.dispose();}
});

test('seongsamjae detail shaders retain previous hooks and sample real instance-world coordinates',()=>{
 const {world,v}=fixture();let material;
 world.traverse(o=>{for(const m of o.isMesh?materialsOf(o):[])if(m.name==='Terrain_JirisanDetail')material=m;});
 try{
  assert.ok(material);const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);
  assert.ok(shader.uniforms.surfaceGrain,'previous surface polish hook must remain active');assert.ok(shader.uniforms.jirisanDetail);assert.match(shader.vertexShader,/instanceMatrix\*jirisanWorld/);assert.match(shader.fragmentShader,/floorCover/);assert.match(material.customProgramCacheKey(),/coastal-surface-v1-ground.*jirisan-forest-surface/);assert.equal(material.surfaceGrain,shader.uniforms.surfaceGrain.value);
 }finally{v.dispose();}
});

test('seongsamjae pause updates never animate instance poses or move any wheel or physics node',()=>{
 const {source,v}=fixture(),camera=new THREE.PerspectiveCamera(),matrices=[];camera.position.set(route.points[0].x,2,route.points[0].z);v.update(camera,1/60,2,true);
 v.root.traverse(o=>{if(o.isInstancedMesh)matrices.push({object:o,hash:hash(Buffer.from(o.instanceMatrix.array.buffer))});});
 try{
  for(let i=0;i<10;i++)v.update(camera,0,2,true);
  for(const m of matrices)assert.equal(hash(Buffer.from(m.object.instanceMatrix.array.buffer)),m.hash);
  for(const s of source)assert.deepEqual(s.object.matrixWorld.elements,s.matrix);
 }finally{v.dispose();}
});

test('seongsamjae cleanup disposes each owned GPU resource once and restores exact original world references',()=>{
 const {scene,world,source,v}=fixture(),resources=new Set();
 v.root.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.isInstancedMesh)resources.add(o);for(const m of o.material?materialsOf(o):[]){resources.add(m);if(m.jirisanDetailTexture)resources.add(m.jirisanDetailTexture);}});
 world.traverse(o=>{for(const m of o.isMesh?materialsOf(o):[])if(m.name.endsWith('_JirisanDetail')){resources.add(m);resources.add(m.jirisanDetailTexture);}});
 const counts=new Map();for(const r of resources){counts.set(r,0);r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));}
 v.dispose();v.dispose();assert.equal(v.root.parent,null);assert.ok(!scene.children.includes(v.root));assert.equal(v.root.children.length,0);assert.equal(v.stats.disposed,true);
 for(const count of counts.values())assert.equal(count,1,'owned instance buffers, textures, materials and geometries must be released exactly once');
 for(const s of source){assert.equal(s.object.material,s.material);assert.equal(s.object.geometry,s.geometry);assert.equal(s.object.visible,s.visible);}
});
