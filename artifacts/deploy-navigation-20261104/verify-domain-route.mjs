// This is an HTTPS deployment probe, not a change to the PC/browser DNS settings.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const dist='D:/racing/.work/all-course-navigation-20261103/navigation-only/dist',out='D:/racing/three-rapier-idiom-racer/artifacts/deploy-navigation-20261104';
const host='racing.mumuworld.com',edge='216.198.79.67',marker=Buffer.from('\nMUMU_HTTP_META:');
const result={at:new Date().toISOString(),source:'0e477c6a6f396a78d05ac791a413278e02064d50',production:'dpl_6qAVo9w56dkjFceDaUAGhuAKP1Lv',base:'https://'+host,connection:{override:host+':443:'+edge,source:'Live A record of mumu-racing.vercel.app; official domain TLS probe succeeded at this edge',tlsVerification:true,hostAndSniPreserved:true,systemDnsChanged:false,limitation:'This PC normal DNS returned 127.0.0.1 and normal browser/Node connection was refused. The explicit connection override proves server routing and valid HTTPS, not normal access on this PC.'},files:[],tracks:[]};
async function request(p){
 const {stdout}=await run('curl.exe',['--silent','--show-error','--max-time','45','--resolve',host+':443:'+edge,'--write-out','\nMUMU_HTTP_META:%{http_code}|%{content_type}|%{remote_ip}|%{ssl_verify_result}','https://'+host+p],{encoding:'buffer',maxBuffer:32*1024*1024,windowsHide:true});
 const i=stdout.lastIndexOf(marker);if(i<0)throw Error('Missing response metadata');
 const [status,type,remoteIp,sslVerifyResult]=stdout.subarray(i+marker.length).toString().split('|');
 return {body:stdout.subarray(0,i),status:Number(status),type,remoteIp,sslVerifyResult:Number(sslVerifyResult)};
}
const files=[];
async function walk(d){for(const e of await fs.readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())await walk(p);else if(e.isFile())files.push(path.relative(dist,p).replaceAll('\\','/'));}}
await walk(dist);let next=0;
async function worker(){while(next<files.length){const name=files[next++],local=await fs.readFile(path.join(dist,name));try{const r=await request('/'+name.split('/').map(encodeURIComponent).join('/')),exact=local.equals(r.body),text=/\.(html|json|js|css|txt|svg)$/.test(name),crOnly=!exact&&text&&local.toString().replaceAll('\r','')===r.body.toString().replaceAll('\r','');result.files.push({name,status:r.status,type:r.type,remoteIp:r.remoteIp,sslVerifyResult:r.sslVerifyResult,localBytes:local.length,remoteBytes:r.body.length,localSha256:sha(local),remoteSha256:sha(r.body),exact,crOnly});}catch(e){result.files.push({name,error:e.message});}}}
await Promise.all([worker(),worker()]);
for(const track of ['coastal','namak','yeosu','seongsamjae']){try{const r=await request('/?track='+track+'&v=0e477c6'),html=r.body.toString();result.tracks.push({track,status:r.status,sslVerifyResult:r.sslVerifyResult,js:html.match(/index-[A-Za-z0-9_-]+\.js/g),css:html.match(/index-[A-Za-z0-9_-]+\.css/g)});}catch(e){result.tracks.push({track,error:e.message});}}
try{result.missingAssetStatus=(await request('/assets/rebuild/nonexistent-deploy-check.glb')).status;}catch(e){result.missingAssetError=e.message;}
result.files.sort((a,b)=>a.name.localeCompare(b.name));
result.summary={files:result.files.length,http200:result.files.filter(r=>r.status===200).length,exact:result.files.filter(r=>r.exact).length,crOnly:result.files.filter(r=>r.crOnly).length,unexplained:result.files.filter(r=>!r.exact&&!r.crOnly).length,tlsVerified:result.files.filter(r=>r.sslVerifyResult===0).length,remoteBytes:result.files.reduce((s,r)=>s+(r.remoteBytes??0),0)};
await fs.writeFile(out+'/official-server-route-verification.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({connection:result.connection,summary:result.summary,tracks:result.tracks,missingAssetStatus:result.missingAssetStatus}));
if(result.summary.http200!==files.length||result.summary.unexplained||result.summary.tlsVerified!==files.length||result.missingAssetStatus!==404)process.exitCode=1;
