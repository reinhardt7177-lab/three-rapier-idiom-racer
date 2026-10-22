import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
const paths=execFileSync('git',['diff','--cached','--name-only','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const findings=[];let bytes=0;
for(const p of paths){
 if(/(^|\/)(\.env(?:\..*)?|\.meshy\.key|auth\.json|node_modules|dist|\.vercel)(\/|$)|\/before\//i.test(p))findings.push({path:p,reason:'excluded path'});
 const data=execFileSync('git',['show',`:${p}`],{maxBuffer:128*1024*1024});bytes+=data.length;
 if(data.length>100*1024*1024)findings.push({path:p,reason:'oversized Git object'});
 const text=data.toString('utf8');
 if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:github_pat_|ghp_|gho_)[A-Za-z0-9_]{24,}|\bsk_live_[A-Za-z0-9]{20,}/.test(text))findings.push({path:p,reason:'credential pattern; value suppressed'});
}
const build=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
 const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else{
  const data=fs.readFileSync(p);build.push({path:path.relative('dist',p).replaceAll('\\','/'),bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')});
 }
}}
walk('dist');
const result={at:new Date().toISOString(),stagedFiles:paths.length,stagedBytes:bytes,findings,buildFiles:build.length,buildBytes:build.reduce((n,f)=>n+f.bytes,0),build};
fs.writeFileSync(new URL(process.argv[2]||'preflight.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({stagedFiles:paths.length,stagedBytes:bytes,findings,buildFiles:result.buildFiles,buildBytes:result.buildBytes}));
if(findings.length)process.exitCode=1;
