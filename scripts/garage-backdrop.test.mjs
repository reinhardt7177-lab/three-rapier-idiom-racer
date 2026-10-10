import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Mesh,BoxGeometry,MeshBasicMaterial,PerspectiveCamera,Raycaster,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createGarageBackdrop} from '../src/rebuild/garageBackdrop.js';

const bytes=fs.readFileSync(new URL('../public/assets/rebuild/garage.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const garage=gltf.scene;garage.updateMatrixWorld(true);
const backdrop=createGarageBackdrop(garage);
const car=new Mesh(new BoxGeometry(1.8,1.1,4.5),new MeshBasicMaterial());car.position.y=.65;car.updateMatrixWorld(true);
const target=new Vector3(0,.85,0),ray=new Raycaster();
function firstVisible(camera){
 ray.set(camera.position,target.clone().sub(camera.position).normalize());ray.far=20;
 const visible=[car];garage.traverse(o=>{if(o.isMesh&&o.visible)visible.push(o);});
 return ray.intersectObjects(visible,false)[0]?.object;
}

test('actual showroom wall occlusion is removed for rear and diagonal vehicle views',()=>{
 const camera=new PerspectiveCamera();
 for(const position of [[0,2,-12],[7,2,-10]]){
  camera.position.set(...position);
  garage.traverse(o=>{o.visible=true;});
  assert.ok(firstVisible(camera)!==car,'reproduce wall blocking the vehicle');
  backdrop.update(camera);assert.ok(firstVisible(camera)===car,'rear camera must see the car through the cutaway');
 }
});
test('front and in-room rear views restore the real backdrop',()=>{
 const camera=new PerspectiveCamera();
 for(const position of [[5.8,2.8,7.6],[0,2,-4]]){
  camera.position.set(...position);backdrop.update(camera);
  assert.equal(garage.getObjectByName('Rear_wall').visible,true);
  assert.ok(firstVisible(camera)===car,'car must remain visible from front and inside the room');
 }
});
