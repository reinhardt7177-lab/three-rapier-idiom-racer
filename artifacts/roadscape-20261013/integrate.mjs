import fs from 'node:fs';
const runtime='src/rebuild/runtime.js';let source=fs.readFileSync(runtime,'utf8');
for(const [a,b] of [
 ['mapVisuals:mapVisuals?.stats,staticWorld:','mapVisuals:mapVisuals?.stats,roadscape:roadscape?.stats,staticWorld:'],
 ['mapVisuals?.dispose();staticWorld.dispose();','mapVisuals?.dispose();roadscape?.dispose();staticWorld.dispose();'],
]){if(!source.includes(a))throw Error('Unexpected runtime change');source=source.replace(a,b);}fs.writeFileSync(runtime,source);
const tracks='src/rebuild/tracks.js';source=fs.readFileSync(tracks,'utf8');
for(const id of ['yeosu','seongsamjae']){
 const a=`world:'${id}',route:`;if(!source.includes(a))throw Error('Unexpected tracks change');
 source=source.replace(a,`world:'${id}',roadscape:'${id}-roadscape.glb',route:`);
}source=source.replace('화엄사 아래 출발, 성삼재 전망과 연속 헤어핀을 돌아 내려옵니다.','지리산 풍경의 산악 순환 코스. 연속 헤어핀과 전망 구간을 달립니다.');fs.writeFileSync(tracks,source);
const p=JSON.parse(fs.readFileSync('package.json'));
for(const key of ['check:race','check:rebuild'])p.scripts[key]=p.scripts[key].replace('scripts/map-materials.test.mjs','scripts/map-materials.test.mjs scripts/roadscape.test.mjs scripts/yeosu-roadscape.test.mjs scripts/seongsamjae-roadscape.test.mjs');
fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');
