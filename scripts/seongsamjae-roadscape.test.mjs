import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const file=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const bytes=file('public/assets/rebuild/seongsamjae-roadscape.glb');
const route=JSON.parse(file('public/assets/rebuild/seongsamjae-route.json'));
const report=JSON.parse(file('artifacts/roadscape-20261013/seongsamjae/build-report.json'));
const parse=async bytes=>(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
const root=await parse(bytes);root.updateMatrixWorld(true);
const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});
const routeGrid=new Map(),key=(x,z)=>`${Math.floor(x/32)},${Math.floor(z/32)}`;
for(let i=0;i<route.points.length;i++){
 const a=route.points[i],b=route.points[(i+1)%route.points.length];
 for(let x=Math.floor(Math.min(a.x,b.x)/32);x<=Math.floor(Math.max(a.x,b.x)/32);x++)for(let z=Math.floor(Math.min(a.z,b.z)/32);z<=Math.floor(Math.max(a.z,b.z)/32);z++){
  const k=`${x},${z}`;if(!routeGrid.has(k))routeGrid.set(k,[]);routeGrid.get(k).push([a,b]);
 }
}
const dot=(a,b)=>a.x*b.x+a.z*b.z;
const sub=(a,b)=>({x:a.x-b.x,z:a.z-b.z});
const cross=(a,b)=>a.x*b.z-a.z*b.x;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function pointSegment(p,a,b){const d=sub(b,a),l=dot(d,d),t=l?Math.max(0,Math.min(1,dot(sub(p,a),d)/l)):0;return dist(p,{x:a.x+d.x*t,z:a.z+d.z*t});}
function intersects(a,b,c,d){const u=sub(b,a),v=sub(d,c),denom=cross(u,v);if(Math.abs(denom)<1e-10)return false;const q=sub(c,a),t=cross(q,v)/denom,s=cross(q,u)/denom;return t>=0&&t<=1&&s>=0&&s<=1;}
function segmentDistance(a,b,c,d){return intersects(a,b,c,d)?0:Math.min(pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b));}
function inside(p,a,b,c){const d=cross(sub(b,a),sub(c,a));if(Math.abs(d)<1e-9)return false;const u=cross(sub(p,a),sub(c,a))/d,v=cross(sub(b,a),sub(p,a))/d;return u>=0&&v>=0&&u+v<=1;}
function triangleRoadDistance(a,b,c){
 let result=Infinity;
 for(let x=Math.floor((Math.min(a.x,b.x,c.x)-13)/32);x<=Math.floor((Math.max(a.x,b.x,c.x)+13)/32);x++)for(let z=Math.floor((Math.min(a.z,b.z,c.z)-13)/32);z<=Math.floor((Math.max(a.z,b.z,c.z)+13)/32);z++){
  for(const [p,q] of routeGrid.get(`${x},${z}`)??[]){
   if(inside(p,a,b,c)||inside(q,a,b,c))return 0;
   result=Math.min(result,segmentDistance(p,q,a,b),segmentDistance(p,q,b,c),segmentDistance(p,q,c,a));
  }
 }return result;
}
const worldVertex=(mesh,i,target)=>target.fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(mesh.matrixWorld);

test('mountain roadscape is an editable <=3MB visual-only spatial asset with shared opaque material',()=>{
 assert.ok(bytes.length>1_000_000&&bytes.length<=3_000_000);
 assert.ok(file('assets-sources/seongsamjae/roadscape.blend').length>100_000);
 assert.equal(hash(file('public/assets/rebuild/seongsamjae-route.json')),report.routeSha256);
 assert.equal(hash(file('public/assets/rebuild/seongsamjae.glb')),report.baseSha256);
 const materials=new Set();let triangles=0;
 root.traverse(o=>{assert.ok(!o.isLight&&!o.isCamera);assert.ok(!o.userData.unity_collider&&!o.userData.korea_collision);assert.ok(!/^(Road_Asphalt|Terrain|RaceBarrier)/.test(o.name));});
 for(const mesh of meshes){
  assert.equal(mesh.userData.visualOnly,true);assert.equal(mesh.userData.cellSize,96);assert.ok([1,2,3].includes(mesh.userData.qualityTier));
  assert.ok(mesh.geometry.attributes.color,'surface variation must be authored geometry colors');
  assert.ok(!mesh.material.map&&!mesh.material.transparent);materials.add(mesh.material);triangles+=mesh.geometry.index.count/3;
  const size=new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());assert.ok(size.x<=140&&size.z<=140,'small cells must support proximity culling');
 }
 assert.equal(materials.size,1);assert.equal(triangles,report.triangles);assert.ok(triangles<=35000);
});

test('every mountain scenery triangle keeps all route segments and +/-7m driving lanes clear',()=>{
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let closest=Infinity,checked=0;
 for(const mesh of meshes){const indices=mesh.geometry.index;
  for(let i=0;i<indices.count;i+=3){worldVertex(mesh,indices.getX(i),a);worldVertex(mesh,indices.getX(i+1),b);worldVertex(mesh,indices.getX(i+2),c);
   const d=triangleRoadDistance(a,b,c);closest=Math.min(closest,d);checked++;
   assert.ok(d>=12.5,`${mesh.name} triangle ${i/3} is only ${d}m from a road segment`);
  }
 }
 assert.equal(checked,report.triangles);assert.ok(closest<15,'features must actually be visible from the roadway');
});

test('rock skirts, rail posts and deck piers use actual original terrain elevations',async()=>{
 const base=await parse(file('public/assets/rebuild/seongsamjae.glb'));base.updateMatrixWorld(true);
 const groundGrid=new Map(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 base.traverse(o=>{if(!o.isMesh||!(Array.isArray(o.material)?o.material:[o.material]).some(m=>m.name.startsWith('Terrain')))return;
  const ix=o.geometry.index,count=ix?.count??o.geometry.attributes.position.count;
  for(let i=0;i<count;i+=3){worldVertex(o,ix?ix.getX(i):i,a);worldVertex(o,ix?ix.getX(i+1):i+1,b);worldVertex(o,ix?ix.getX(i+2):i+2,c);
   const triangle=[a.clone(),b.clone(),c.clone()];
   for(let x=Math.floor(Math.min(a.x,b.x,c.x)/32);x<=Math.floor(Math.max(a.x,b.x,c.x)/32);x++)for(let z=Math.floor(Math.min(a.z,b.z,c.z)/32);z<=Math.floor(Math.max(a.z,b.z,c.z)/32);z++){
    const k=`${x},${z}`;if(!groundGrid.has(k))groundGrid.set(k,[]);groundGrid.get(k).push(triangle);
   }
  }
 });
 assert.ok(report.supports.length>900);
 for(const p of report.supports){let top=-Infinity;
  for(const [a,b,c] of groundGrid.get(key(p.x,p.z))??[]){
   const den=cross(sub(b,a),sub(c,a));if(Math.abs(den)<1e-10)continue;
   const u=cross(sub(p,a),sub(c,a))/den,v=cross(sub(b,a),sub(p,a))/den;
   if(u>=-1e-6&&v>=-1e-6&&u+v<=1+1e-6)top=Math.max(top,a.y+u*(b.y-a.y)+v*(c.y-a.y));
  }
  assert.ok(Number.isFinite(top),`${p.feature} has no supporting ground`);
  assert.ok(Math.abs(top-p.groundY)<.02,`${p.feature} terrain mismatch ${top-p.groundY}`);
 }
});

test('mountain asset contains rock cuts, readable hairpin furniture and supported summit viewing deck',()=>{
 const features=new Set(meshes.flatMap(m=>m.userData.features.split(',')));
 for(const expected of ['layered-rock-cut','bedding-seam','catch-fence-mesh','valley-retaining-wall','W-guardrail','drain-channel','chevron-arrow','convex-mirror','deck-pier','overlook-planks','overlook-pavilion'])assert.ok(features.has(expected),expected);
 assert.equal(report.features['chevron-board'],24);assert.equal(report.features['convex-mirror'],6);
 assert.equal(report.features['deck-pier'],6);assert.ok(report.features['layered-rock-cut']>1000);
 assert.equal(report.referenceMode,'photo-informed Nogodan-ro roadside; fictional protected 5.83km race loop');
});

test('every bedding seam stays on an actual exported rock edge, including tapered cutting ends',()=>{
 // Blender/glTF positions are Float32; canonicalize the Float64 authoring
 // manifest to that exact storage type before comparing vertex identities.
 const key=v=>v.map(Math.fround).join(','),triKey=vs=>vs.map(key).sort().join('|');
 const triangles=new Set(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 for(const mesh of meshes){const ix=mesh.geometry.index;for(let i=0;i<ix.count;i+=3){
  worldVertex(mesh,ix.getX(i),a);worldVertex(mesh,ix.getX(i+1),b);worldVertex(mesh,ix.getX(i+2),c);
  triangles.add(triKey([a.toArray(),b.toArray(),c.toArray()]));
 }}
 assert.ok(report.seamContacts.length>100);
 const point=new THREE.Vector3(),closest=new THREE.Vector3();
 for(const contact of report.seamContacts){const [v0,v1,v2,v3]=contact.rockFace;
  assert.ok(triangles.has(triKey([v0,v1,v2]))&&triangles.has(triKey([v0,v2,v3])),'claimed rock support must be real exported triangles');
  const edgeFace=new THREE.Triangle(new THREE.Vector3(...v0),new THREE.Vector3(...v2),new THREE.Vector3(...v3));
  a.set(...contact.a);b.set(...contact.b);
  for(const t of [0,.25,.5,.75,1]){point.lerpVectors(a,b,t);edgeFace.closestPointToPoint(point,closest);assert.ok(point.distanceTo(closest)<.001,'seam is floating off its rock surface');}
 }
});

test('all exported chevrons point into the real turn when viewed by an approaching driver',()=>{
 const vertexKey=v=>v.map(Math.fround).join(','),vertices=new Set(),v=new THREE.Vector3();
 for(const mesh of meshes){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)vertices.add(vertexKey(worldVertex(mesh,i,v).toArray()));}
 assert.equal(report.chevrons.length,24);
 const seen=new Set();
 for(const marker of report.chevrons){
  const i=marker.routeIndex,n=route.points.length,p=route.points[i],before=route.points[(i-15+n)%n],after=route.points[(i+15)%n];
  const turn=Math.sign(before.dx*after.dz-before.dz*after.dx);assert.notEqual(turn,0);
  const tip=new THREE.Vector3(...marker.tip),tail=new THREE.Vector3(...marker.tailVertices[0]).add(new THREE.Vector3(...marker.tailVertices[1])).multiplyScalar(.5);
  for(const point of [marker.tip,...marker.tailVertices])assert.ok(vertices.has(vertexKey(point)),'arrow inspection must use actual exported geometry');
  const driverRight=new THREE.Vector3(-p.dz,0,p.dx);
  assert.equal(Math.sign(tip.clone().sub(tail).dot(driverRight)),turn,`route ${i}: arrow contradicts road turn`);
  const camera=new THREE.PerspectiveCamera(60,16/9,.1,100);
  camera.position.set(p.x-p.dx*12,p.y+3.05,p.z-p.dz*12);
  camera.lookAt(p.x+p.dx*25,p.y+3.05,p.z+p.dz*25);camera.updateMatrixWorld(true);
  assert.equal(Math.sign(tip.project(camera).x-tail.project(camera).x),turn,`route ${i}: rendered arrow points the wrong way`);
  assert.equal(marker.turn,turn>0?'right':'left');seen.add(marker.turn);
 }
 assert.deepEqual([...seen].sort(),['left','right']);
});
