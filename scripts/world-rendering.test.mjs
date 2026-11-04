import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {batchWorldScenery,createFrameMetrics} from '../src/rebuild/worldRendering.js';
import {createSceneDisposer} from '../src/rendering/sceneResources.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

function prop(root,material,x,z,name='sign',geometry=new THREE.BoxGeometry(1,2,.2)){
 const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,1,z);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;
}
const vertices=root=>{
 root.updateMatrixWorld(true);const out=[];root.traverse(o=>{if(o.isMesh){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)out.push(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).toArray().map(n=>n.toFixed(4)).join(','));}});
 return out.sort();
};
const triangles=root=>{let count=0;root.traverse(o=>{if(o.isMesh)count+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});return count;};
test('spatial batches preserve world-space vertices, normals, vertex colours, UVs and triangle count',()=>{
 const root=new THREE.Group();root.position.set(450,7,-300);root.rotation.y=.3;
 const material=new THREE.MeshStandardMaterial({vertexColors:true}),geometry=new THREE.BoxGeometry(1,2,.2);
 geometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count*3).fill(.35),3));
 for(let i=0;i<4;i++){const p=prop(root,material,i*2,8,'painted sign',geometry);p.rotation.y=.4;p.scale.set(1,1.3,.8);}
 const before=vertices(root),count=triangles(root),report=batchWorldScenery(root),batch=root.children[0];
 assert.equal(report.after,1);assert.equal(report.mergedObjects,4);assert.deepEqual(vertices(root),before);assert.equal(triangles(root),count);
 assert.ok(batch.geometry.index);assert.ok(batch.geometry.attributes.uv);assert.ok(batch.geometry.attributes.normal);assert.ok(batch.geometry.attributes.color);
 for(let i=0;i<batch.geometry.attributes.color.count;i++)assert.ok(Math.abs(batch.geometry.attributes.color.getX(i)-.35)<1e-6);
 assert.equal(batch.material,material);assert.ok(batch.frustumCulled);assert.ok(batch.geometry.boundingSphere);
 createSceneDisposer(root)();
});

test('separate regions and incompatible appearance stay separate; large terrain stays individually culled',()=>{
 const root=new THREE.Group(),material=new THREE.MeshStandardMaterial();
 prop(root,material,10,10);prop(root,material,12,10);prop(root,material,500,500);prop(root,material,502,500);
 const long=prop(root,material,0,0,'terrain',new THREE.BoxGeometry(1200,10,1200));
 const different=prop(root,new THREE.MeshStandardMaterial({color:'red'}),11,10);
 const transparent=prop(root,new THREE.MeshStandardMaterial({transparent:true,opacity:.5}),11,10);
 const mirrored=prop(root,material,14,10);mirrored.scale.x=-1;
 const report=batchWorldScenery(root);assert.equal(report.batches,2);assert.equal(report.after,6);
 for(const o of [long,different,transparent,mirrored])assert.equal(o.parent,root);
 const batches=root.children.filter(o=>o.userData.sceneryBatch);assert.equal(batches.length,2);
 assert.ok(batches.every(o=>o.geometry.boundingBox.getSize(new THREE.Vector3()).length()<10));
 createSceneDisposer(root)();
});

test('collision, spawn-road and moving geometry are untouched; shared retained geometry is not freed',()=>{
 const root=new THREE.Group(),material=new THREE.MeshStandardMaterial(),geometry=new THREE.BoxGeometry(1,1,1);let disposed=0;
 geometry.addEventListener('dispose',()=>disposed++);
 const collider=prop(root,material,10,10,'wall',geometry);collider.userData.unity_collider=true;
 const road=prop(root,material,10,12,'Harbor_Road_Asphalt',geometry);
 const moving=prop(root,material,10,14,'moving prop',geometry);moving.userData.dynamic=true;
 prop(root,material,10,16,'sign',geometry);prop(root,material,10,18,'sign',geometry);
 const matrices=[collider,road,moving].map(o=>{o.updateMatrixWorld(true);return o.matrixWorld.clone();});
 const report=batchWorldScenery(root);assert.equal(report.mergedObjects,2);assert.equal(disposed,0);
 [collider,road,moving].forEach((o,i)=>{assert.equal(o.geometry,geometry);assert.equal(o.parent,root);assert.deepEqual(o.matrixWorld.elements,matrices[i].elements);});
 createSceneDisposer(root)();assert.equal(disposed,1);
});

test('index layout, shadow settings, layers and allocation limits prevent invalid merging',()=>{
 const root=new THREE.Group(),material=new THREE.MeshStandardMaterial();
 const objects=Array.from({length:6},(_,i)=>prop(root,material,10+i,10));
 objects[2].geometry=objects[2].geometry.toNonIndexed();objects[3].castShadow=false;objects[4].layers.set(2);objects[5].renderOrder=3;
 const report=batchWorldScenery(root,{maxVertices:48});assert.equal(report.mergedObjects,2);assert.equal(report.after,5);
 assert.ok(root.children.every(o=>o.geometry.attributes.position.count<=48));
 createSceneDisposer(root)();
});

test('frame metrics expose stutters and bounded samples without mixing resumed or new sessions',()=>{
 const metrics=createFrameMetrics(4),info={calls:100,triangles:1234};
 metrics.record(0,info);for(const t of [16,32,132,148])metrics.record(t,info);
 assert.deepEqual(metrics.snapshot(),{samples:4,meanMs:37,p95Ms:100,maxMs:100,over50Ms:1,calls:100,triangles:1234});
 metrics.record(164,{calls:90,triangles:1200});assert.equal(metrics.snapshot().samples,4);assert.equal(metrics.snapshot().calls,90);
 metrics.reset();metrics.record(100000,info);assert.deepEqual(metrics.snapshot(),{samples:0});
});

test('whole-district forest splits into bounded cells with every rendered triangle and attribute intact',()=>{
 const root=new THREE.Group(),material=new THREE.MeshStandardMaterial({vertexColors:true});material.name='Bark';
 const boxes=Array.from({length:500},(_,i)=>{
  const g=new THREE.BoxGeometry(2,8,2);g.translate((i%10)*320+10,4,Math.floor(i/10)*3+5);
  const colors=new Uint8Array(g.attributes.position.count*3).fill(i%255);g.setAttribute('color',new THREE.BufferAttribute(colors,3,true));return g;
 });
 const source=mergeGeometries(boxes,false);boxes.forEach(g=>g.dispose());const forest=new THREE.Mesh(source,material);root.add(forest);
 const triangleData=()=>{
  const data=[];root.updateMatrixWorld(true);root.traverse(o=>{if(!o.isMesh)return;
   const g=o.geometry,p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,color=g.attributes.color,normalMatrix=new THREE.Matrix3().getNormalMatrix(o.matrixWorld);
   for(let i=0;i<g.index.count;i+=3){const triangle=[];for(let k=0;k<3;k++){
    const id=g.index.getX(i+k),v=new THREE.Vector3().fromBufferAttribute(p,id).applyMatrix4(o.matrixWorld),normal=new THREE.Vector3().fromBufferAttribute(n,id).applyMatrix3(normalMatrix).normalize();
    triangle.push([...v.toArray(),...normal.toArray(),uv.getX(id),uv.getY(id),color.getX(id),color.getY(id),color.getZ(id)].map(x=>x.toFixed(4)).join(','));
   }data.push(triangle.join('|'));}
  });return data.sort();
 };
 const before=triangleData(),count=triangles(root),report=batchWorldScenery(root);
 assert.equal(report.splitObjects,1);assert.ok(report.partsCreated>=10);assert.equal(triangles(root),count);assert.deepEqual(triangleData(),before);
 const camera=new THREE.PerspectiveCamera(60,1,.1,100),frustum=new THREE.Frustum();camera.position.set(10,4,-15);camera.lookAt(10,4,10);camera.updateMatrixWorld(true);
 frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 const parts=root.children.filter(o=>o.isMesh);assert.ok(parts.some(o=>frustum.intersectsObject(o)));assert.ok(parts.some(o=>!frustum.intersectsObject(o)),'distant forest must be individually excluded');
 assert.ok(parts.every(o=>o.geometry.boundingBox.getSize(new THREE.Vector3()).x<=4));
 createSceneDisposer(root)();
});
