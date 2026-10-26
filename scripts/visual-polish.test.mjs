import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {routeBends,routeGuidance} from '../src/rebuild/routeGuidance.js';
import {polishVehicleMaterial,polishWorldSurfaces} from '../src/rebuild/surfacePolish.js';
import {createSceneDisposer} from '../src/rendering/sceneResources.js';

function circle(sign=1,n=126,radius=100){
  const length=2*Math.PI*radius;
  return {length,points:Array.from({length:n},(_,i)=>{const a=i*2*Math.PI/n;return {distance:length*i/n,dx:sign*Math.sin(a),dz:Math.cos(a)};})};
}
const coast=JSON.parse(fs.readFileSync(new URL('../public/assets/rebuild/world-route.json',import.meta.url)));

test('right/left bends follow world heading, including the circular route seam',()=>{
  for(const [sign,direction] of [[1,'right'],[-1,'left']]){
    const route=circle(sign);
    for(const index of [0,60,125])assert.equal(routeGuidance(route,index).direction,direction);
  }
});
test('bend detection uses metres and survives a fourfold change in point density',()=>{
  for(const n of [63,252]){
    const guide=routeGuidance(circle(1,n),0);
    assert.equal(guide.direction,'right');assert.equal(guide.distance,0);assert.equal(guide.sharp,false);
    assert.equal(routeGuidance(circle(1,n,35),0).sharp,true);
  }
});
test('finish, reverse driving and recovery distances follow actual race progress',()=>{
  assert.equal(routeGuidance(coast,25,coast.length).direction,'finish');
  assert.equal(routeGuidance(coast,25,coast.length+10).remaining,0);
  const finish=routeGuidance(coast,25,coast.length-10);
  assert.equal(finish.direction,'finish');assert.equal(finish.remaining,10);
  assert.equal(routeGuidance(coast,25,coast.length-50).direction,'finish');
  assert.equal(routeGuidance(coast,25,coast.length-51).direction,'left');
  assert.equal(routeGuidance(coast,25,400).remaining+100,routeGuidance(coast,25,300).remaining);
  assert.equal(routeGuidance(coast,25,-100).remaining,coast.length);
});
test('actual city approach previews its left bend and cached guidance stays pure',()=>{
  const index=coast.points.findIndex(p=>p.region==='City'),before=JSON.stringify(coast);
  const guide=routeGuidance(coast,index,coast.points[index].distance);
  assert.equal(guide.direction,'left');assert.ok(guide.distance>0&&guide.distance<150);
  assert.equal(routeBends(coast),routeBends(coast));assert.equal(JSON.stringify(coast),before);
});
test('isolated heading errors never become a persistent corner warning',()=>{
  const route={length:1000,points:Array.from({length:100},(_,i)=>({distance:i*10,dx:0,dz:1}))};
  route.points[10].dx=1;route.points[10].dz=0;
  assert.equal(routeBends(route).filter(Boolean).length,0);
});
test('world surface polish preserves collision vertices and shares one releasable grain texture',()=>{
  const scene=new THREE.Scene(),geometry=new THREE.PlaneGeometry(),vertices=geometry.attributes.position.array.slice();
  const road=new THREE.MeshStandardMaterial({name:'Asphalt'}),ground=new THREE.MeshStandardMaterial({name:'Terrain'});
  scene.add(new THREE.Mesh(geometry,road),new THREE.Mesh(geometry,ground));
  polishWorldSurfaces(scene);
  assert.deepEqual(geometry.attributes.position.array,vertices);assert.equal(road.surfaceGrain,ground.surfaceGrain);
  assert.ok(road.surfaceGrain.generateMipmaps);assert.equal(road.surfaceGrain.image.data.length,16384);
  let disposed=0;road.surfaceGrain.addEventListener('dispose',()=>disposed++);
  const dispose=createSceneDisposer(scene);dispose();dispose();assert.equal(disposed,1);
});
test('paint and glass finish preserve authored colours and maps, without changing rubber',()=>{
  const map=new THREE.Texture(),paint=new THREE.MeshPhysicalMaterial({name:'supra_Exterior_NewPaint',color:'#3c99d0',map});
  const colour=paint.color.clone();polishVehicleMaterial(paint);
  assert.ok(paint.color.equals(colour));assert.equal(paint.map,map);assert.ok(paint.clearcoat>.55);
  const glass=new THREE.MeshPhysicalMaterial({name:'Detail_Glass_Tinted',roughness:.23});polishVehicleMaterial(glass);assert.ok(glass.roughness<.23);
  const rubber=new THREE.MeshStandardMaterial({name:'V6 Rubber',roughness:.78});polishVehicleMaterial(rubber);assert.equal(rubber.roughness,.78);
  [paint,glass,rubber,map].forEach(r=>r.dispose());
});
