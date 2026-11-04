import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createVehicleStudio} from '/src/rebuild/vehicleStudio.js';
import {VEHICLES} from '/src/rebuild/fleet.js';
import {createVehicleView} from '/src/rebuild/assets.js';
import {createVehicleView as oldView} from './baseline-assets.js';
const decoder=new DRACOLoader().setDecoderPath('/assets/rebuild/draco/'),loader=new GLTFLoader().setDRACOLoader(decoder);
const controls=document.querySelectorAll('select'),output=document.querySelector('pre'),status=document.querySelector('#status');
controls[0].innerHTML=VEHICLES.map(v=>`<option value="${v.id}">${v.name}</option>`).join('');
const entries=[],cache=new Map();let measuring=null,last=null,frames=[];
for(const target of ['before','after']){
 const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;
 const scene=new T.Scene();scene.background=new T.Color('#19202a');const camera=new T.PerspectiveCamera(35,1,.05,100);
 const pmrem=new T.PMREMGenerator(renderer),room=target==='before'?new RoomEnvironment():createVehicleStudio(),env=pmrem.fromScene(room,.035);pmrem.dispose();room.dispose();scene.environment=env.texture;scene.environmentIntensity=.85;
 const hemi=new T.HemisphereLight('#dbeeff','#413627',.6),sun=new T.DirectionalLight('#fff4e0',1.9);sun.position.set(4,7,5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-4;sun.shadow.camera.right=4;sun.shadow.camera.top=4;sun.shadow.camera.bottom=-4;sun.shadow.normalBias=.03;
 const fill=new T.DirectionalLight('#aacdff',.9);fill.position.set(-5,3,-2);scene.add(hemi,sun,fill);
 const floor=new T.Mesh(new T.PlaneGeometry(25,25),new T.MeshStandardMaterial({color:'#343e4a',roughness:.87}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
 document.querySelector(`#${target}`).append(renderer.domElement);entries.push({target,renderer,scene,camera,hemi,sun,fill,view:null});
}
async function load(){
 status.textContent='불러오는 중';
 for(const e of entries){
  const id=controls[0].value,key=`${e.target}-${id}`;
  if(!cache.has(key)){const prefix=e.target==='before'?'/artifacts/vehicle-finish-20261013/before/public/assets/rebuild/':'/assets/rebuild/';const g=await loader.loadAsync(`${prefix}${id}.glb`);cache.set(key,g.scene);}
  if(e.view){e.scene.remove(e.view.root);e.view.dispose();}
  e.view=(e.target==='before'?oldView:createVehicleView)(cache.get(key),id,{vivid:true});e.scene.add(e.view.root);
 }update();status.textContent='준비 완료';
}
function update(){for(const e of entries){
 const poses={front:[4.4,2.1,5.7],rear:[-4.4,2.0,-5.7],side:[7,1.6,0],wheel:[2.0,.65,2.2]};e.camera.position.fromArray(poses[controls[1].value]);e.camera.lookAt(controls[1].value==='wheel'?new T.Vector3(.78,.35,1.2):new T.Vector3(0,.65,0));
 const light=controls[2].value;e.renderer.toneMappingExposure=light==='night'?.7:.95;e.scene.environmentIntensity=light==='day'?.65:light==='night'?.38:.85;e.hemi.intensity=light==='day'?1.1:light==='night'?.35:.6;e.sun.intensity=light==='night'?.5:1.9;e.fill.intensity=light==='night'?1.25:.9;e.scene.background.set(light==='night'?'#080f20':'#19202a');
 const w=innerWidth/2,h=Math.round(Math.min(650,w*.85));e.renderer.setSize(w,h,false);e.camera.aspect=w/h;e.camera.updateProjectionMatrix();
 }requestAnimationFrame(renderReport);}
function renderReport(){output.textContent=JSON.stringify({car:controls[0].value,view:controls[1].value,light:controls[2].value,entries:entries.map(e=>{const materials=new Set();e.view?.root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});return {target:e.target,spec:e.view?.spec,draws:e.renderer.info.render,materials:[...materials].map(m=>({name:m.name,type:m.type,roughness:m.roughness,metalness:m.metalness,env:m.envMapIntensity}))};}),measurement:measuring===null&&frames.length?{frames:frames.length,mean:frames.reduce((a,b)=>a+b)/frames.length,p95:[...frames].sort((a,b)=>a-b)[Math.ceil(frames.length*.95)-1],max:Math.max(...frames),over50:frames.filter(x=>x>50).length}:null},null,2);}
controls[0].onchange=load;controls[1].onchange=controls[2].onchange=update;addEventListener('resize',update);
document.querySelector('button').onclick=()=>{measuring=performance.now();last=null;frames=[];status.textContent='측정 중 · 30초';};
function frame(t){requestAnimationFrame(frame);for(const e of entries)e.renderer.render(e.scene,e.camera);if(measuring!==null){if(last!==null)frames.push(t-last);last=t;if(t-measuring>=30000){measuring=null;status.textContent='측정 완료';renderReport();}}}requestAnimationFrame(frame);await load();
