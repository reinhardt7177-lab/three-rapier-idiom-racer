import fs from 'node:fs';
import {spawn} from 'node:child_process';
const dir='artifacts/graphics-parallel-20261013';
const results=[];
for(const track of ['coastal','yeosu','seongsamjae']){
 const log=fs.openSync(`${dir}/quiet-scene-${track}.log`,'w');
 const child=spawn(process.execPath,[`${dir}/probe-render.mjs`,track,'high','quiet-scene','measure'],{stdio:['ignore',log,log],windowsHide:true});
 const exitCode=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});fs.closeSync(log);results.push({track,exitCode});console.log(JSON.stringify({track,exitCode}));if(exitCode!==0)break;
}
if(results.length===3&&results.every(r=>r.exitCode===0)){
 const log=fs.openSync(`${dir}/actual-flow-final.log`,'w');const child=spawn(process.execPath,[`${dir}/game-flow.mjs`,'actual-flow-final'],{stdio:['ignore',log,log],windowsHide:true});
 const exitCode=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});fs.closeSync(log);results.push({flow:true,exitCode});console.log(JSON.stringify({flow:true,exitCode}));
}
fs.writeFileSync(`${dir}/final-verification.json`,JSON.stringify(results,null,2));process.exitCode=results.every(r=>r.exitCode===0)?0:1;
