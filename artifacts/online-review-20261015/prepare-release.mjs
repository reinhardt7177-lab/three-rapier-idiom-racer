import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const dir='artifacts/online-review-20261015',root=process.cwd(),git=args=>execFileSync('git',args,{encoding:'utf8'}).trim();
if(git(['branch','--show-current'])!=='codex/korea-circuits-progression-20261011')throw Error('Unexpected branch');
const summary=JSON.parse(await fs.readFile(`${dir}/full-check-summary.json`,'utf8'));
if(summary.exitCode!==0||summary.changedInputs.length)throw Error('Full verification is not current');
const old=JSON.parse(await fs.readFile(`${dir}/inputs-before.json`,'utf8'));
for(const [p,digest] of Object.entries(old)){const hash=createHash('sha256').update(await fs.readFile(p)).digest('hex');if(hash!==digest)throw Error(`Input changed: ${p}`);}
const pending=git(['-c','core.quotepath=false','diff','--name-only','--','src','scripts','README.md','package.json']).split('\n').filter(p=>p&&!/onlineRace|onlineProtocol|online-race\.test/.test(p));
pending.push(...[
 'src/rebuild/namakArchitecture.js','src/rebuild/rivalRacecraft.js',
 'scripts/driving-five-pass.test.mjs','scripts/steering-final.test.mjs','scripts/rival-racecraft.test.mjs','scripts/namak-architecture.test.mjs','scripts/fixtures/steering-baseline-20261015.json',
 'scripts/blender/polish_namak_architecture.py','scripts/blender/preview_namak_architecture.py',
 'public/assets/rebuild/namak-architecture.glb','assets-sources/namak/namak-highdetail.blend','artifacts/namak-highdetail-20261013/architecture-report.json',
 'docs/DRIVING_FIVE_PASS_20261015.md','docs/RIVAL_AI_3PASS_20261015.md','docs/NAMAK_ARCHITECTURE_20261013.md','docs/STEERING_FIVE_PASS_20261015.md','docs/STEERING_TEST_CONTRACT_20261015.md'
]);
const paths=[...new Set(pending)];
for(const p of paths){if(p.includes('..')||/\.key$|(^|\/)\.env|credentials|auth\.json/i.test(p))throw Error('Forbidden stage path');const s=await fs.stat(p);if(!s.isFile()||s.size>=100*1024*1024)throw Error('Unexpected large file');}
await fs.writeFile(`${dir}/pending-polish-paths.txt`,paths.join('\n')+'\n');
const build=[];
async function walk(dirPath){for(const e of await fs.readdir(dirPath,{withFileTypes:true})){const p=path.join(dirPath,e.name);if(e.isDirectory())await walk(p);else {const b=await fs.readFile(p);build.push({path:path.relative('dist',p).replaceAll('\\','/'),bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')});}}}
await walk('dist');build.sort((a,b)=>a.path.localeCompare(b.path));
await fs.writeFile(`${dir}/validated-build-manifest.json`,JSON.stringify({files:build,totalBytes:build.reduce((n,f)=>n+f.bytes,0),inputCount:summary.inputCount,changedInputs:0,fullCheckExitCode:0},null,2));
console.log(JSON.stringify({stagingPolishFiles:paths.length,buildFiles:build.length,totalBytes:build.reduce((n,f)=>n+f.bytes,0),validatedInputs:summary.inputCount}));
