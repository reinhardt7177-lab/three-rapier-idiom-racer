import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
const root=process.cwd(),dir=path.join(root,'artifacts/roadscape-20261013');
const label=process.argv[2]||'coastal';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const oldReport=JSON.parse(fs.readFileSync('artifacts/race-duel-20261012/full-check-summary.json','utf8').replace(/^\uFEFF/,''));
const reportPaths=[...oldReport.reports.map(r=>r.path),'artifacts/race-duel-20261012/duel-races.json','artifacts/race-duel-20261012/online-headless.json','artifacts/release-repair-20261012/traffic-races.json'];
const preserved=new Map(reportPaths.map(p=>[p,fs.existsSync(p)?fs.readFileSync(p):null]));
const inputs=[];
function walk(p){for(const entry of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,entry.name);if(entry.isDirectory())walk(f);else inputs.push({path:f,sha256:sha(fs.readFileSync(f))});}}
for(const p of ['src','scripts','public/assets/rebuild'])walk(p);
for(const p of ['package.json','package-lock.json','vite.config.js','index.html','artifacts/unity-recovery/colliders.bin','artifacts/unity-recovery/colliders.json'])inputs.push({path:p,sha256:sha(fs.readFileSync(p))});
for(const fixture of ['namak-20261010','yeosu-map-traffic-20261012/yeosu','korea-circuits-20261011/seongsamjae'])for(const name of ['colliders.bin','colliders.json']){const p=`artifacts/${fixture}/${name}`;inputs.push({path:p,sha256:sha(fs.readFileSync(p))});}
const calibration='artifacts/release-repair-20261012/yeosu-medal-calibration.json';
if(fs.existsSync(calibration))inputs.push({path:calibration,sha256:sha(fs.readFileSync(calibration))});
fs.writeFileSync(path.join(dir,`${label}-check-inputs.json`),JSON.stringify(inputs,null,2));
const logPath=path.join(dir,`${label}-check.log`),log=fs.openSync(logPath,'w'),started=performance.now();
const child=spawn('cmd.exe',['/d','/s','/c','npm run check'],{cwd:root,stdio:['ignore',log,log],windowsHide:true});
const exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
fs.closeSync(log);
const reports=[];
for(const [p,before] of preserved){
 if(fs.existsSync(p)){const output=fs.readFileSync(p),raw=path.join(dir,`${label}-check-evidence`,p);fs.mkdirSync(path.dirname(raw),{recursive:true});fs.writeFileSync(raw,output);reports.push({path:p,rawEvidence:raw,sha256:sha(output)});}
 if(before!==null)fs.writeFileSync(p,before);
}
const changedInputs=inputs.filter(i=>!fs.existsSync(i.path)||sha(fs.readFileSync(i.path))!==i.sha256);
const rawLog=fs.readFileSync(logPath,'utf8'),counts=Object.fromEntries(['tests','pass','fail','skipped'].map(k=>[k,Number(rawLog.match(new RegExp('(?:#|ℹ) '+k+' (\\d+)'))?.[1]??-1)]));
const report={execution:'Local Windows CPU / Rapier WASM, no Colab connection',label,exitCode,seconds:(performance.now()-started)/1000,counts,changedInputs,reports,previousEvidenceRestored:true,note:'Raw old writers may say Colab CPU. This run was local Windows CPU. No failures were filtered.'};
fs.writeFileSync(path.join(dir,`${label}-check-summary.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));process.exitCode=exitCode;
