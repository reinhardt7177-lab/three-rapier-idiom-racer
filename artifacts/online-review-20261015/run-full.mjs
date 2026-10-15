import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
const root=process.cwd(),dir=path.join(root,'artifacts/online-review-20261015');
const hash=b=>createHash('sha256').update(b).digest('hex');
async function walk(relative){const found=[];for(const e of await fs.readdir(path.join(root,relative),{withFileTypes:true})){if(e.isSymbolicLink())continue;const p=path.join(relative,e.name);if(e.isDirectory())found.push(...await walk(p));else if(e.isFile()&&!/\.(blend1|blend2)$/.test(p))found.push(p);}return found;}
const files=[...(await walk('src')),...(await walk('scripts')),...(await walk('public')),'package.json','package-lock.json','vite.config.js','index.html','vercel.json'];
async function inputs(){const out={};for(const p of files){try{out[p]=hash(await fs.readFile(path.join(root,p)));}catch(e){if(e.code!=='ENOENT')throw e;}}return out;}
const before=await inputs();await fs.writeFile(path.join(dir,'inputs-before.json'),JSON.stringify(before,null,2));
const targets=JSON.parse(await fs.readFile(path.join(root,'artifacts/vehicle-polish-3pass-20261015/isolated-evidence-index.json'),'utf8')).reports.map(r=>r.path);
const saved=[];await fs.mkdir(path.join(dir,'regression-results'),{recursive:true});
for(const p of targets){const s=await fs.stat(path.join(root,p));saved.push({p,data:await fs.readFile(path.join(root,p)),mtime:s.mtime,atime:s.atime});}
const start=new Date(),log=await fs.open(path.join(dir,'full-check.log'),'w');
console.log(`Full npm run check started ${start.toISOString()}; local Windows CPU; ${Object.keys(before).length} hashed inputs.`);
const child=spawn('cmd.exe',['/d','/s','/c','npm run check'],{cwd:root,windowsHide:true,stdio:['ignore',log.fd,log.fd]});
const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});await log.close();
const reports=[];
for(const old of saved){const p=path.join(root,old.p),b=await fs.readFile(p),s=await fs.stat(p);const destination=path.join(dir,'regression-results',old.p.replaceAll('/','__'));await fs.writeFile(destination,b);reports.push({path:old.p,sha256:hash(b),bytes:b.length,writtenDuringRun:s.mtime>=start});await fs.writeFile(p,old.data);await fs.utimes(p,old.atime,old.mtime);}
const after=await inputs(),changed=Object.keys(before).filter(p=>before[p]!==after[p]);
const text=await fs.readFile(path.join(dir,'full-check.log'),'utf8');
const summary={startedAt:start.toISOString(),finishedAt:new Date().toISOString(),seconds:(Date.now()-start.getTime())/1000,execution:'Local Windows CPU / Rapier WASM; no Colab',command:'npm run check',exitCode:code,inputCount:Object.keys(before).length,changedInputs:changed,counts:text.split(/\r?\n/).filter(x=>/^[ℹ#] (tests|pass|fail|cancelled|skipped|duration_ms)/.test(x)),reports};
await fs.writeFile(path.join(dir,'full-check-summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));process.exitCode=code||changed.length?1:0;
