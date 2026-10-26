import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const dir='artifacts/online-qr-20261015',files=[];
const summary=JSON.parse(await fs.readFile(`${dir}/full-check-summary.json`,'utf8'));
if(summary.exitCode!==0||summary.changedInputs.length)throw Error('Final source must pass the complete check without changes');
async function walk(base=''){
 for(const e of await fs.readdir(path.join('dist',base),{withFileTypes:true})){
  const p=path.join(base,e.name);if(e.isDirectory())await walk(p);else if(e.isFile()){
   const b=await fs.readFile(path.join('dist',p));files.push({path:p.replaceAll('\\','/'),bytes:b.length,sha256:createHash('sha256').update(b).digest('hex'),...(/\.js$/.test(p)?{gzipBytes:gzipSync(b).length}:{})});
  }
 }
}
await walk();files.sort((a,b)=>a.path.localeCompare(b.path));
const old=JSON.parse(await fs.readFile('artifacts/online-review-20261015/validated-build-manifest.json','utf8'));
const qr=files.find(f=>/^assets\/inviteQr-.*\.js$/.test(f.path));
const result={at:new Date().toISOString(),files,totalBytes:files.reduce((n,f)=>n+f.bytes,0),previousTotalBytes:old.totalBytes,qrLazyChunk:qr,main:files.find(f=>/^assets\/index-.*\.js$/.test(f.path))};result.deltaBytes=result.totalBytes-old.totalBytes;
await fs.writeFile(`${dir}/validated-build-manifest.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,files:files.length}));
