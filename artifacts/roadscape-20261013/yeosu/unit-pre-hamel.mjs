import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const root = new URL('../', import.meta.url);
const read = p => fs.readFileSync(new URL(p, root));
const json = p => JSON.parse(read(p).toString().replace(/^\uFEFF/, ''));
const sha = p => crypto.createHash('sha256').update(read(p)).digest('hex');
const path = 'public/assets/rebuild/yeosu-roadscape.glb';
const bytes = read(path);
const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength), '');
const route = json('public/assets/rebuild/yeosu-route.json');
const report = json('artifacts/roadscape-20261013/yeosu/asset-report.json');
scene.updateMatrixWorld(true);
const meshes=[];
scene.traverse(o=>{if(o.isMesh)meshes.push(o);});

test('Yeosu additive scene is < 3 MB, texture-free, light-free and uses shared materials',()=>{
  assert.ok(bytes.length <= 3_000_000, `${bytes.length} bytes`);
  assert.equal(report.bytes,bytes.length);
  assert.equal(report.glbSha256,sha(path));
  const materials=new Set(); let triangles=0;
  scene.traverse(o=>{assert.ok(!o.isLight&&!o.isCamera&&!o.isSkinnedMesh);});
  for(const mesh of meshes){
    assert.ok(!mesh.castShadow);
    assert.ok(!Array.isArray(mesh.material));materials.add(mesh.material);
    for(const value of Object.values(mesh.material))assert.ok(!value?.isTexture);
    triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;
  }
  assert.ok(materials.size<=8);assert.ok(triangles<=65_000, `${triangles} triangles`);
  assert.equal(triangles,report.triangles);assert.equal(meshes.length,report.objects);
});

test('source world, route, original Blender and map bytes are preserved',()=>{
  for(const p of json('artifacts/roadscape-20261013/yeosu/before/protected-hashes.json'))assert.equal(sha(p.path),p.sha256.toLowerCase(),p.path);
  assert.equal(sha('public/assets/rebuild/yeosu-route.json'),report.routeSha256);
  assert.equal(sha('public/assets/rebuild/yeosu.glb'),report.sourceWorldSha256);
});

test('all new scene nodes are visual-only, identity-aligned and spatially grouped',()=>{
  assert.ok(scene.matrix.equals(new THREE.Matrix4()));
  for(const mesh of meshes){
    assert.ok(mesh.name.startsWith('YeosuRoadscape_'));
    assert.equal(mesh.userData.roadscapeVisualOnly,true);
    assert.ok([1,2].includes(mesh.userData.roadscapeTier));
    assert.equal(mesh.userData.roadscapeCell.length,2);
    for(const key of ['unity_collider','korea_collision','collider'])assert.ok(!mesh.userData[key]);
    assert.ok(!/Road_Asphalt|Terrain|RaceBarrier/.test(mesh.name));
    const box=new THREE.Box3().setFromObject(mesh);
    assert.ok(box.max.x-box.min.x<190 && box.max.z-box.min.z<190,mesh.name);
    assert.ok(box.min.y>=-6.01 && box.max.y<80,mesh.name);
  }
});

const cross=(a,b,c)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
function pointSegment(p,a,b){const x=b.x-a.x,z=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*x+(p.z-a.z)*z)/(x*x+z*z||1)));return Math.hypot(p.x-a.x-t*x,p.z-a.z-t*z);}
function inside(p,a,b,c){if(Math.abs(cross(a,b,c))<1e-7)return false;const x=cross(a,b,p),y=cross(b,c,p),z=cross(c,a,p);return (x>=0&&y>=0&&z>=0)||(x<=0&&y<=0&&z<=0);}
function distanceSegments(a,b,c,d){
  const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
  if(x*y<0&&z*w<0)return 0;
  return Math.min(pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b));
}
const segments=route.points.map((p,i)=>({a:p,b:route.points[(i+1)%route.points.length],width:Math.max(p.roadWidth,route.points[(i+1)%route.points.length].roadWidth)}));
const grid=new Map(),size=32;
for(let i=0;i<segments.length;i++){
  const {a,b,width}=segments[i],r=width/2+2;
  for(let x=Math.floor((Math.min(a.x,b.x)-r)/size);x<=Math.floor((Math.max(a.x,b.x)+r)/size);x++)
    for(let z=Math.floor((Math.min(a.z,b.z)-r)/size);z<=Math.floor((Math.max(a.z,b.z)+r)/size);z++){
      const key=`${x},${z}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(i);
    }
}

test('every triangle clears every road segment by full asphalt half-width + 1 m, including flyovers',()=>{
  let minimum=Infinity, tested=0;
  const v=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
  for(const mesh of meshes){
    const p=mesh.geometry.attributes.position,ix=mesh.geometry.index;
    for(let i=0;i<(ix?.count??p.count);i+=3){
      for(let k=0;k<3;k++)v[k].fromBufferAttribute(p,ix?ix.getX(i+k):i+k).applyMatrix4(mesh.matrixWorld);
      const minx=Math.floor(Math.min(...v.map(p=>p.x))/size),maxx=Math.floor(Math.max(...v.map(p=>p.x))/size);
      const minz=Math.floor(Math.min(...v.map(p=>p.z))/size),maxz=Math.floor(Math.max(...v.map(p=>p.z))/size);
      const ids=new Set();for(let x=minx;x<=maxx;x++)for(let z=minz;z<=maxz;z++)for(const id of grid.get(`${x},${z}`)??[])ids.add(id);
      for(const id of ids){
        const {a,b,width}=segments[id];
        let d=inside(a,...v)||inside(b,...v)?0:Math.min(distanceSegments(a,b,v[0],v[1]),distanceSegments(a,b,v[1],v[2]),distanceSegments(a,b,v[2],v[0]));
        const clear=d-width/2;minimum=Math.min(minimum,clear);tested++;
        assert.ok(clear>=1,`${mesh.name} triangle ${i/3}, road ${id}: ${clear.toFixed(4)}m`);
      }
    }
  }
  assert.ok(tested>10000);assert.ok(minimum>=1);
  console.log(JSON.stringify({roadscape:'yeosu',triangleSegmentPairs:tested,minimumAsphaltEdgeClearance:minimum}));
});

test('both bridge structures and real OSM quay foundation, walkway and mooring details exist',()=>{
  for(const role of ['QuaySeaWall','QuayCoping','PromenadeFoundation','PromenadeSurface','MooringBollard','BollardCrossbar','QuayRubberFender'])assert.ok(report.counts[role]>20,role);
  for(const bridge of ['Dolsan','Geobukseon'])for(const role of ['DeckEdge','Pier','PierCap','GirderFlange','Rail','Marker'])assert.ok(report.counts[bridge+role]>0,bridge+role);
  assert.ok(report.anchors.filter(a=>a.source.wayId===568320091).length>100);
  assert.equal(report.extraLights,0);assert.equal(report.extraTextures,0);assert.equal(report.extraShadows,0);
});

test('Hamel red lighthouse uses official coordinates and 10 m above its platform, with supported base',()=>{
  const anchors=report.anchors.filter(a=>a.role.startsWith('Hamel'));
  assert.ok(anchors.length>=4);
  const o=route.mapSource.origin,x=(127.74710-o.lon)*111320*Math.cos(o.lat*Math.PI/180),z=(o.lat-34.73644)*111320;
  for(const a of anchors){assert.equal(a.source.latitude,34.73644);assert.equal(a.source.longitude,127.74710);assert.equal(a.source.heightMeters,10);assert.ok(Math.hypot(a.x-x,a.z-z)<.001);}
  assert.equal(report.counts.HamelFoundation,1);assert.equal(report.counts.HamelTaperedTower,1);assert.equal(report.counts.HamelFinial,1);
  assert.ok([...new Set(meshes.map(m=>m.material.name))].includes('YeosuRoadscape_HamelRed'));
});
