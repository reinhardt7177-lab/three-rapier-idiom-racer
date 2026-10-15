import fs from 'node:fs';
import crypto from 'node:crypto';
const dir='artifacts/vehicle-finish-20261013',read=p=>JSON.parse(fs.readFileSync(`${dir}/${p}`,'utf8').replace(/^\uFEFF/,''));
const baseline=read('before-vehicle-manifest.json'),cars=[];
for(const id of Object.keys(baseline)){
 const b=fs.readFileSync(`public/assets/rebuild/${id}.glb`),g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
 cars.push({id,beforeBytes:baseline[id].bytes,afterBytes:b.length,beforeTriangles:baseline[id].triangles,afterTriangles:g.meshes.reduce((s,m)=>s+m.primitives.reduce((s,p)=>s+g.accessors[p.indices].count/3,0),0),beforePrimitives:baseline[id].primitives,afterPrimitives:g.meshes.reduce((s,m)=>s+m.primitives.length,0),sha256:crypto.createHash('sha256').update(b).digest('hex')});
}
const sum=k=>cars.reduce((s,c)=>s+c[k],0);
const layouts=[];for(const mode of ['garage','hud','result','menu'])for(const width of [1280,1024,844,667]){
 const file=`${mode}-${width}.json`;if(!fs.existsSync(`${dir}/${file}`))continue;const r=read(file);layouts.push({file,...r.layout,mode:r.state.mode,elapsed:r.state.elapsed,hasResult:!!r.state.result,paused:r.state.paused});
}
const frames=[];for(const file of fs.readdirSync(dir).filter(n=>/^perf-.*\.json$/.test(n))){const r=read(file);for(const result of r.state?.performanceTrial?.results??[])frames.push({file,...result,intervals:undefined,submission:undefined,gpu:r.gpu});}
const protectedCheck=read('before-manifest.json').protected.map(p=>({path:p.path,unchanged:crypto.createHash('sha256').update(fs.readFileSync(p.path)).digest('hex')===p.hash}));
const activeRide=fs.readFileSync('src/rebuild/activeRide.js');
const result={time:new Date().toISOString(),cars,totals:{beforeBytes:sum('beforeBytes'),afterBytes:sum('afterBytes'),savedBytes:sum('beforeBytes')-sum('afterBytes'),beforeTriangles:sum('beforeTriangles'),afterTriangles:sum('afterTriangles'),savedTriangles:sum('beforeTriangles')-sum('afterTriangles')},protectedCheck,activeRideSha256:crypto.createHash('sha256').update(activeRide).digest('hex'),layouts,frames};
fs.writeFileSync(`${dir}/summary.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({totals:result.totals,protected:protectedCheck,layoutFailures:layouts.filter(l=>l.clipped.length||l.overlaps.length),frames},null,2));
