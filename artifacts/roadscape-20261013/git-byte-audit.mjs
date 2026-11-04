import {execFileSync} from 'node:child_process';import fs from 'node:fs';import crypto from 'node:crypto';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const files=['public/assets/rebuild/yeosu-route.json','public/assets/rebuild/seongsamjae-route.json','assets-sources/yeosu/map/mapped-scenery.json'];
const report=files.map(path=>{const a=execFileSync('git',['show',`HEAD:${path}`],{maxBuffer:10000000}),b=fs.readFileSync(path);return {path,headHash:sha(a),workingHash:sha(b),equal:a.equals(b)};});
fs.writeFileSync('artifacts/roadscape-20261013/git-byte-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
