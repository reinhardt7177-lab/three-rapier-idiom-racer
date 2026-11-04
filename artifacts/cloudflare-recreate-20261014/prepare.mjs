import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const dir=path.resolve('artifacts/cloudflare-recreate-20261014');
const source=path.resolve('artifacts/cloudflare-car-deploy-20261014/build-source/dist');
const expected=JSON.parse(fs.readFileSync('artifacts/cloudflare-car-deploy-20261014/preflight.json'));
assert.equal(expected.release.sourceCommit,'4359d7dee328e94b6dc2c11d2e278bbaf6167043');
const results=expected.files.map(file=>{
 const target=path.resolve(source,file.path);assert.ok(target.startsWith(source+path.sep));
 const data=fs.readFileSync(target),sha256=crypto.createHash('sha256').update(data).digest('hex');
 assert.equal(data.length,file.bytes);assert.equal(sha256,file.sha256);
 return {path:file.path,bytes:data.length,sha256};
});
const backup=path.resolve(dir,'backup-dist');assert.ok(backup.startsWith(dir+path.sep));
assert.ok(!fs.existsSync(backup),'Backup already exists: stop before overwriting');
fs.cpSync(source,backup,{recursive:true,errorOnExist:true,force:false});
for(const file of results){const data=fs.readFileSync(path.join(backup,file.path));assert.equal(crypto.createHash('sha256').update(data).digest('hex'),file.sha256);}
const config={name:'mumu-circuit',compatibility_date:'2026-10-13',workers_dev:true,preview_urls:false,assets:{directory:'./backup-dist'},routes:[{pattern:'racing.mumuworld.com',zone_name:'mumuworld.com',custom_domain:true}]};
fs.writeFileSync(path.join(dir,'recreate-wrangler.jsonc'),JSON.stringify(config,null,2)+'\n');
fs.writeFileSync(path.join(dir,'backup-manifest.json'),JSON.stringify({checkedAt:new Date().toISOString(),sourceCommit:expected.release.sourceCommit,files:results,totalBytes:results.reduce((n,f)=>n+f.bytes,0),backupVerified:true},null,2));
console.log(JSON.stringify({backupVerified:true,files:results.length,totalBytes:results.reduce((n,f)=>n+f.bytes,0)}));
