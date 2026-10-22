import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const task='artifacts/ai-impact-20261016',read=p=>JSON.parse(fs.readFileSync(p));
const sha=b=>createHash('sha256').update(b).digest('hex');
if(fs.readFileSync(`${task}/check-complete-exit.txt`,'utf8').trim()!=='0')throw Error('A successful final full check is required');
const inputs=read(`${task}/final-inputs.json`),changed=inputs.filter(f=>!fs.existsSync(f.path)||sha(fs.readFileSync(f.path))!==f.sha256).map(f=>f.path);
fs.writeFileSync(`${task}/final-inputs-verification.json`,JSON.stringify({checked:inputs.length,changed,verifiedAt:new Date().toISOString()},null,2));
if(changed.length)throw Error(`Changed inputs after final check began: ${changed.join(', ')}`);
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const before=read(`${task}/build-before.json`),beforeGzip=read(`${task}/build-before-gzip.json`);
const built=files('dist').map(p=>{const b=fs.readFileSync(p);return{path:p.replaceAll('\\','/'),bytes:b.length,sha256:sha(b),...(/\.(js|css|html)$/.test(p)?{gzipBytes:gzipSync(b).length}:{})};});
const old=new Map(before.files.map(f=>[f.path,f]));
const publicAssets=built.filter(f=>!(/\.(js|css|html)$/.test(f.path)));
const code=built.filter(f=>f.gzipBytes!==undefined);
const build={beforeBytes:before.totalBytes,afterBytes:built.reduce((s,f)=>s+f.bytes,0),files:built,codeBytes:code.reduce((s,f)=>s+f.bytes,0),codeGzipBytes:code.reduce((s,f)=>s+f.gzipBytes,0),beforeCodeGzipBytes:beforeGzip.gzipBytes,unchangedAssets:publicAssets.filter(f=>old.get(f.path)?.sha256===f.sha256).length,assetCount:publicAssets.length,note:'Whole static build and per-file gzip sum; not a cold network transfer measurement.'};
fs.writeFileSync(`${task}/build-after.json`,JSON.stringify(build,null,2));
const resultRoot=`${task}/generated-results/artifacts`;
const suites=[['personality',`${resultRoot}/content-resume-20261011/rival-personality-races.json`,24],['rain',`${resultRoot}/content-resume-20261011/rain-races.json`,14],['championship',`${resultRoot}/championship-20261011/physical-series.json`,3]];
const races=[];
for(const [suite,file,expected] of suites){const raw=read(file),rows=raw.results??raw.races;if(rows.length!==expected)throw Error(`${suite}: ${rows.length}/${expected} completed result rows`);for(const r of rows)races.push({suite,track:r.track,difficulty:r.difficulty,laps:r.laps??1,weather:r.weather,median:r.median,cars:r.cars.map(c=>({name:c.name,player:c.player,finish:c.finish,lowest:c.lowest}))});}
const unfinished=races.flatMap(r=>r.cars.filter(c=>!Number.isFinite(c.finish)||c.finish<=0));
if(unfinished.length)throw Error('A race did not finish');
const result={execution:'Local Windows CPU / Node 24.12.0 / Rapier WASM; no Colab',races:races.length,carFinishes:races.reduce((s,r)=>s+r.cars.length,0),minHeight:Math.min(...races.flatMap(r=>r.cars.map(c=>c.lowest))),details:races};
fs.writeFileSync(`${task}/race-summary.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify({inputs:inputs.length,changed:changed.length,buildBytes:[build.beforeBytes,build.afterBytes],codeGzipBytes:[build.beforeCodeGzipBytes,build.codeGzipBytes],assetsUnchanged:[build.unchangedAssets,build.assetCount],races:result.races,carFinishes:result.carFinishes,minHeight:result.minHeight}));
