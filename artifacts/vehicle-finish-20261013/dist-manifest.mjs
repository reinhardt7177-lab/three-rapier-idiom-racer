import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
const files=[];function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,e.name);if(e.isDirectory())walk(f);else{const b=fs.readFileSync(f);files.push({path:f.replaceAll('\\','/'),bytes:b.length,hash:crypto.createHash('sha256').update(b).digest('hex'),...(/\.(js|css)$/.test(f)?{gzipBytes:zlib.gzipSync(b).length}:{})});}}}walk('dist');
fs.writeFileSync(`artifacts/vehicle-finish-20261013/dist-${process.argv[2]}.json`,JSON.stringify({time:new Date().toISOString(),rawBytes:files.reduce((s,f)=>s+f.bytes,0),files},null,2));
