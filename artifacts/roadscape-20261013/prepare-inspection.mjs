import fs from 'node:fs';
const dir='artifacts/roadscape-20261013';
let html=fs.readFileSync('artifacts/graphics-parallel-20261013/inspection.html','utf8');
html=html.replace("from './staticWorld.candidate.mjs'","from '/src/rebuild/staticWorld.js'");
html=html.replace("import {createDaylightSky}","import {createRoadscape} from '/src/rebuild/roadscape.js';\nimport {createDaylightSky}");
const start=html.indexOf(' async function setEnhanced('),end=html.indexOf(' function summary(',start);
if(start<0||end<0)throw Error('inspection shape changed');
html=html.slice(0,start)+` async function setEnhanced(value){
 enhanced=value;roadscape?.update(camera,0,elapsed,value);
 document.getElementById('title').textContent=track.name+' · '+(value?'도로 환경 개선':'현재 배포 기준')+' · '+quality.label;
 await renderer.compileAsync(scene,camera);
 }
`+html.slice(end);
html=html.replace('const decor=createDecorationQuality(world);',`const paths={namak:'/src/rebuild/namakVisuals.js',yeosu:'/src/rebuild/yeosuVisuals.js',seongsamjae:'/src/rebuild/seongsamjaeVisuals.js',coastal:'/src/rebuild/coastalVisuals.js'},fn={namak:'createNamakVisuals',yeosu:'createYeosuVisuals',seongsamjae:'createSeongsamjaeVisuals',coastal:'createCoastalVisuals'};
 const module=await import(/* @vite-ignore */paths[track.id]),visuals=module[fn[track.id]](scene,world,route,{quality});
 const decor=createDecorationQuality(world);`);
html=html.replace('visuals=null,staticWorld=null,daylight=null,enhanced=false,sampling=null;',`enhanced=false,sampling=null;
 const extension=track.roadscape?(await loader.loadAsync('/assets/rebuild/'+track.roadscape)).scene:null;
 if(extension){extension.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=false;});world.add(extension);}
 const roadscape=createRoadscape(extension,{quality}),staticWorld=freezeStaticWorld(world),daylight=track.night?null:createDaylightSky(sky,track.id,quality);`);
html=html.replace('visuals?.update(camera,dt,elapsed,true);const cpu=','visuals?.update(camera,dt,elapsed,true);roadscape?.update(camera,dt,elapsed,enhanced);daylight?.update(dt,elapsed);const cpu=');
html=html.replaceAll('visuals:visuals?.stats','visuals:visuals?.stats,roadscape:roadscape?.stats');
fs.writeFileSync(dir+'/inspection.html',html);
for(const script of ['probe-render.mjs','gallery.mjs']){
 let source=fs.readFileSync('artifacts/graphics-parallel-20261013/'+script,'utf8').replaceAll('artifacts/graphics-parallel-20261013',dir);
 source=source.replace('CPU regression concurrently running; captures only, no performance acceptance.','Before/after screenshots of the exact same route positions; scene-only, not physical driving.');
 fs.writeFileSync(dir+'/'+script,source);
}
// Keep previous complete-flow evidence writers isolated in this task folder.
for(const script of ['game-flow.mjs','game-benchmark.mjs']){
 const source=fs.readFileSync('artifacts/graphics-parallel-20261013/'+script,'utf8').replaceAll('artifacts/graphics-parallel-20261013',dir);
 fs.writeFileSync(dir+'/'+script,source);
}
console.log('Created an inspection page where A and B differ only by the new Blender roadscape.');
