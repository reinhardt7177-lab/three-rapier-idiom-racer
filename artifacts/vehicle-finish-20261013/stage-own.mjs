import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const dir='artifacts/vehicle-finish-20261013',git=(args,input)=>execFileSync('git',args,{input,maxBuffer:100000000}).toString();
if(git(['branch','--show-current']).trim()!=='codex/korea-circuits-progression-20261011')throw Error('Wrong branch');
if(git(['diff','--cached','--name-only']).trim())throw Error('Preserve existing index');
const check=JSON.parse(fs.readFileSync(`${dir}/vertex-check-summary.json`));if(check.exitCode!==0||check.changedInputs.length)throw Error('Final check not complete/inputs changed');
const ids=['supra','slk','mustang','porsche911','gtr','rx7','m3','huracan'];
const own=['src/rebuild/runtime.js','src/rebuild/surfacePolish.js','src/rebuild/vehicleStudio.js','scripts/vehicle-finish.test.mjs','scripts/blender/polish_vehicle_finish.py','docs/VEHICLE_FINISH_20261013.md',`${dir}/comparison.html`,...ids.flatMap(id=>[`assets-sources/vehicles-v6/${id}.blend`,`public/assets/rebuild/${id}.glb`])];
const evidence=[];
function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const f=path.posix.join(p,e.name);if(e.isDirectory()){if(e.name.startsWith('before')||e.name==='private-references')continue;walk(f);}else if(/\.(json|log|png|md)$/.test(f))evidence.push(f);}}
walk(dir);
for(const f of [...own,...evidence]){if(/\.key|\.env|private-references|before\//.test(f))throw Error(`Private path ${f}`);if(fs.statSync(f).size>100000000)throw Error('LFS required');}
git(['add','--',...own,...evidence]);
const base=JSON.parse(git(['show','HEAD:package.json']));
for(const key of ['check:race','check:rebuild'])base.scripts[key]=base.scripts[key].replace('node --test --test-concurrency=1 ','node --test --test-concurrency=2 scripts/vehicle-finish.test.mjs ');
const index=(file,text)=>{const hash=git(['hash-object','-w','--stdin'],text).trim();git(['update-index','--cacheinfo',`100644,${hash},${file}`]);};
index('package.json',JSON.stringify(base,null,2)+'\n');
const work=fs.readFileSync('docs/NEXT_STEPS.md','utf8'),paragraph=work.split(/\r?\n/).find(l=>l.startsWith('**8종 차량 마감 고도화 검증 완료:'));
if(!paragraph)throw Error('Missing completed next-steps paragraph');
let doc=git(['show','HEAD:docs/NEXT_STEPS.md']).replace(/\r\n/g,'\n');doc=doc.replace(/^#[^\n]+/,'# 현재 우선순위 · 2026-10-14').replace(/^(#[^\n]+\n)/,`$1\n${paragraph}\n`);index('docs/NEXT_STEPS.md',doc);
const staged=git(['diff','--cached','--name-only']).trim().split('\n');
if(staged.some(p=>/namakArchitecture|namak-architecture|namakVisuals|src\/rebuild\/assets\.js|NAMAK_ARCHITECTURE/.test(p)))throw Error('Foreign Namak changes staged');
fs.writeFileSync(`${dir}/staged-files.json`,JSON.stringify({time:new Date().toISOString(),staged,scope:'Own vehicle changes only; concurrent Namak files/registration/paragraph remain in working tree.'},null,2));
console.log(JSON.stringify({files:staged.length,own,evidence:evidence.length},null,2));
