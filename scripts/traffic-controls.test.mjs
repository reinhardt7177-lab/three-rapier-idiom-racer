import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTrafficViews} from '../src/rebuild/trafficView.js';
import {TRAFFIC_BUDGET} from '../src/rebuild/roadTraffic.js';
import {aiInput} from '../src/rebuild/course.js';
import {difficultyById} from '../src/rebuild/raceDifficulty.js';

const route={length:2000,points:Array.from({length:1000},(_,i)=>({x:0,z:i*2,y:0,dx:0,dz:1,distance:i*2}))};
const state={position:{x:0,y:1,z:0},rotation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:20},speed:20,kmh:72,steeringLimit:.3};
test('rival steering keeps its physical direction and brakes for civilian traffic on the same road level',()=>{
 const profile=difficultyById('normal').profile;
 const offset=aiInput(route,state,0,3.2,1,[],{speedProfile:profile});
 assert.ok(offset.steer<0&&offset.steer>=-1,'+X lane correction uses the existing negative input convention');
 const blocked=aiInput(route,state,0,0,1,[{position:{x:0,y:1,z:10},velocity:{x:0,y:0,z:0},kmh:0}],{speedProfile:profile});
 assert.ok(blocked.targetKmh<30);assert.ok(blocked.brake>0);
 const upperRoad=aiInput(route,state,0,0,1,[{position:{x:0,y:15,z:10},velocity:{x:0,y:0,z:0},kmh:0}],{speedProfile:profile});
 assert.ok(upperRoad.targetKmh>72);assert.equal(upperRoad.brake,0,'an unrelated flyover car cannot block this road');
});
test('civilian visual wheels turn/rotate with physics and budgets stay bounded',()=>{
 assert.deepEqual(TRAFFIC_BUDGET,{high:6,medium:4,low:2});
 const c={previous:{position:{x:0,y:1,z:0},rotation:{x:0,y:0,z:0,w:1}},state:{position:{x:0,y:1,z:2},rotation:{x:0,y:0,z:0,w:1},wheels:Array.from({length:4},()=>({steering:.2,rotation:1}))}};
 const view=createTrafficViews([c]);view.update(.5);assert.equal(view.root.children[0].position.z,1);
 const wheel=view.root.children[0].children.find(o=>o.isInstancedMesh&&o.count===4),matrix=new THREE.Matrix4();wheel.getMatrixAt(0,matrix);
 assert.ok(Math.abs(matrix.elements[6])>.5,'wheel rotation is driven by the live axle');
 assert.equal(view.stats.drawCalls,5);view.dispose();assert.equal(view.root.children.length,0);
});
