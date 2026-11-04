import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import jsQR from 'jsqr';
const sharp=createRequire(path.resolve(process.argv[2],'package.json'))('sharp');
const dir='artifacts/online-qr-20261015',prefix=process.argv[3]||'local',results=[];
for(const width of [1280,1024,844,667,390]){
 const file=`${dir}/${prefix}-qr-${width}.png`,{data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const start=performance.now(),qr=jsQR(new Uint8ClampedArray(data),info.width,info.height,{inversionAttempts:'dontInvert'});
 results.push({file,width:info.width,height:info.height,decoded:qr?.data||null,version:qr?.version,decodeMs:performance.now()-start});
}
await fs.writeFile(`${dir}/${prefix}-decoded.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
if(results.some(r=>!r.decoded)||new Set(results.map(r=>r.decoded)).size!==1)process.exitCode=1;
