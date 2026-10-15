import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),dir='artifacts/release-curation-20261016';
await fs.mkdir(dir,{recursive:true});
const tracked=new Set(execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean)),untracked=new Set(execFileSync('git',['ls-files','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean));
const files=[],links=[];
async function walk(base=''){
 for(const e of await fs.readdir(path.join(root,base),{withFileTypes:true})){
  const p=path.posix.join(base,e.name);if(['.git','node_modules','dist','.wrangler'].includes(e.name))continue;
  const s=await fs.lstat(path.join(root,p));if(s.isSymbolicLink()){links.push({path:p});continue;}
  if(s.isDirectory())await walk(p);else if(s.isFile())files.push({path:p,bytes:s.size,mtime:s.mtime.toISOString(),tracked:tracked.has(p),untracked:untracked.has(p),image:/\.(png|jpe?g|webp|gif|svg)$/i.test(p)});
 }
}
await walk();await fs.writeFile(`${dir}/inventory.json`,JSON.stringify({at:new Date().toISOString(),root,files,links},null,2));
const images=files.filter(f=>f.image),groups={};for(const f of images){const key=f.path.split('/').slice(0,2).join('/');const g=groups[key]??={count:0,bytes:0};g.count++;g.bytes+=f.bytes;}
console.log(JSON.stringify({files:files.length,images:images.length,imageBytes:images.reduce((s,f)=>s+f.bytes,0),imageGroups:groups,links,large:files.filter(f=>f.bytes>5e7).map(f=>({path:f.path,bytes:f.bytes,tracked:f.tracked})),untrackedOutsideArtifacts:files.filter(f=>f.untracked&&!f.path.startsWith('artifacts/')).map(f=>({path:f.path,bytes:f.bytes}))},null,2));
