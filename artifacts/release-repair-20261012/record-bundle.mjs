import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {gzipSync} from 'node:zlib';
const label=process.argv[2];if(!label)throw Error('Label required');
const dir=path.resolve('artifacts/release-repair-20261012'),out=path.join(dir,`${label}-bundle.json`);
if(fs.existsSync(out))throw Error('Preserve earlier bundle measurements');
const files=[];
function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,e.name);if(e.isDirectory())walk(f);else files.push(f);}}
walk('dist');
const code=files.filter(p=>/\.(js|css)$/.test(p)).map(p=>{const b=fs.readFileSync(p);return {path:p,bytes:b.length,gzipBytes:gzipSync(b).length,sha256:crypto.createHash('sha256').update(b).digest('hex')};});
const publicAssets=files.filter(p=>!p.endsWith('.js')&&!p.endsWith('.css')&&!p.endsWith('.html')).map(p=>{const b=fs.readFileSync(p);return {path:p,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};});
const report={measuredAt:new Date().toISOString(),scope:'Static production build byte counts and gzip estimates. This is not a browser cold-loading/network measurement or a frame benchmark.',codeBytes:code.reduce((s,f)=>s+f.bytes,0),codeGzipBytes:code.reduce((s,f)=>s+f.gzipBytes,0),allStaticBytes:files.reduce((s,f)=>s+fs.statSync(f).size,0),code,publicAssets};
fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify({codeBytes:report.codeBytes,codeGzipBytes:report.codeGzipBytes,allStaticBytes:report.allStaticBytes}));
