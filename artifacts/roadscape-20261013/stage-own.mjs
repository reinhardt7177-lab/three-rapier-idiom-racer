import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import crypto from 'node:crypto';
const git=(args,input)=>execFileSync('git',args,{input,maxBuffer:10000000}).toString();
if(git(['branch','--show-current']).trim()!=='codex/korea-circuits-progression-20261011')throw Error('unexpected branch');
if(git(['diff','--cached','--name-only']).trim())throw Error('preserve an existing index');
const sources=['.gitattributes','src/rebuild/roadscape.js','src/rebuild/runtime.js','src/rebuild/tracks.js','scripts/roadscape.test.mjs','scripts/yeosu-roadscape.test.mjs','scripts/seongsamjae-roadscape.test.mjs','scripts/blender/build_yeosu_roadscape.py','scripts/blender/yeosu_land_geometry.py','scripts/blender/build_seongsamjae_roadscape.py','assets-sources/yeosu/roadscape.blend','assets-sources/seongsamjae/roadscape.blend','public/assets/rebuild/yeosu-roadscape.glb','public/assets/rebuild/seongsamjae-roadscape.glb','docs/ROADSCAPE_20261013.md','docs/YEOSU_ROADSCAPE_20261013.md','docs/SEONGSAMJAE_ROADSCAPE_20261013.md'];
const dir='artifacts/roadscape-20261013',evidence=[];
const unused=new Set(['capture.mjs','gallery.mjs','probe-render.mjs','game-flow.mjs','game-benchmark.mjs','flag-one.test.mjs','flag-two.test.mjs','stage-own.mjs']);
function walk(base){for(const e of fs.readdirSync(base,{withFileTypes:true})){const p=path.posix.join(base,e.name);if(e.isDirectory()){
 if(['private-references','references','before','before-land'].includes(e.name)||e.name.startsWith('before-'))continue;walk(p);
 }else if(!unused.has(e.name)&&!/\.blend\d?$/.test(p)&&/\.(json|log|png|html|mjs|jsx|js|py)$/.test(p))evidence.push(p);}}
walk(dir);
evidence.push(`${dir}/before/src/rebuild/runtime.js`,`${dir}/yeosu/before-land/yeosu-roadscape.glb`,`${dir}/yeosu/before/protected-hashes.json`);
for(const p of [...sources,...evidence]){if(/private-references|\.key|\.env/.test(p))throw Error('private file');if(fs.statSync(p).size>100000000)throw Error('LFS required');}
git(['add','--',...sources,...evidence]);
const originalPackage=JSON.parse(git(['show','HEAD:package.json']));
for(const key of ['check:race','check:rebuild'])originalPackage.scripts[key]=originalPackage.scripts[key].replace('scripts/map-materials.test.mjs','scripts/map-materials.test.mjs scripts/roadscape.test.mjs scripts/yeosu-roadscape.test.mjs scripts/seongsamjae-roadscape.test.mjs');
const indexFile=(name,text)=>{const blob=git(['hash-object','-w','--stdin'],text).trim();git(['update-index','--cacheinfo',`100644,${blob},${name}`]);};
indexFile('package.json',JSON.stringify(originalPackage,null,2)+'\n');
const workNext=fs.readFileSync('docs/NEXT_STEPS.md','utf8'),paragraph=workNext.split(/\r?\n/).find(line=>line.startsWith('**여수·성삼재 도로 주변 고도화 검증 완료:'));
if(!paragraph)throw Error('missing own next-steps paragraph');
const baseNext=git(['show','HEAD:docs/NEXT_STEPS.md']).replace(/\r\n/g,'\n');
indexFile('docs/NEXT_STEPS.md',baseNext.replace(/^(#[^\n]+\n)/,`$1\n${paragraph}\n`));
const names=git(['diff','--cached','--name-only']).trim().split('\n');
if(names.some(n=>/namakArchitecture|namak-architecture|namakVisuals\.js|src\/rebuild\/assets\.js|NAMAK_ARCHITECTURE/.test(n)))throw Error('foreign Namak change included');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const staged=names.map(p=>({path:p,sha256:sha(execFileSync('git',['show',`:${p}`],{maxBuffer:100000000}))}));
fs.writeFileSync(`${dir}/staged-files.json`,JSON.stringify({time:new Date().toISOString(),staged,scope:'Own roadscape only. Working package and NEXT_STEPS retain concurrent Namak edits.'},null,2));
console.log(JSON.stringify({files:names.length,sources,evidenceFiles:evidence.length}));
