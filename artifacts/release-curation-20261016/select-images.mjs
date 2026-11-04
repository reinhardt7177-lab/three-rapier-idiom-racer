import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const sharp=createRequire(path.resolve(process.argv[2],'package.json'))('sharp'),dir='artifacts/release-curation-20261016';
const oldCommit='3cc854b079ac559396b3c502ea3603e14d63efee^';
const historic=[['artifacts/vehicle-stage1/test-drive.png','early-car.png'],['artifacts/garage-evolution/garage-overview.jpg','early-garage.jpg'],['public/social/harbor-garage-v1.png','early-harbor.png']];
for(const [old,name] of historic){await fs.writeFile(`${dir}/${name}`,execFileSync('git',['show',`${oldCommit}:${old}`],{maxBuffer:20e6}));}
const candidates=[...historic.map(x=>`${dir}/${x[1]}`),
 'artifacts/vehicle-polish-v6-20261009/final-supra.png','artifacts/vehicle-polish-v6-20261009/final-gtr.png','artifacts/vehicle-polish-v6-20261009/final-huracan.png','artifacts/vehicle-polish-v6-20261009/drive-clean.png',
 'artifacts/namak-20261010/track-overview.png','artifacts/namak-20261010/namak-street.png','artifacts/namak-polish-20261010/after-street.png','artifacts/namak-landmarks-20261010/final-drive.png',
 'artifacts/race-experience-20261010/blender-cockpit-desktop.png','artifacts/cockpit-polish-20261010/cockpit-final.png','artifacts/landscape-20261010/wide-final.png',
 'artifacts/korea-circuits-20261011/yeosu-night-before.png','artifacts/korea-circuits-20261011/yeosu-night-after.png','artifacts/korea-circuits-20261011/seongsamjae-hairpin-static.png','artifacts/korea-circuits-20261011/seongsamjae-summit-fixed.png',
 'artifacts/championship-20261011/browser-series-final.png','artifacts/content-resume-20261011/rain-final-drive.png',
 'artifacts/roadscape-20261013/final-yeosu-846-after.png','artifacts/roadscape-20261013/final-yeosu-1811-after.png','artifacts/roadscape-20261013/final-land-yeosu-4100-after.png',
 'artifacts/roadscape-20261013/final-seongsamjae-250-after.png','artifacts/roadscape-20261013/final-seongsamjae-880-after.png','artifacts/roadscape-20261013/final-seongsamjae-1900-after.png',
 'artifacts/namak-highdetail-20261013/renders-final/civic-after.png','artifacts/namak-highdetail-20261013/renders-final/housing-v2-after.png','artifacts/namak-highdetail-20261013/renders-final/river-after.png',
 'artifacts/graphics-parallel-20261013/final-gallery-fixed-coastal-1938-after.png','artifacts/graphics-parallel-20261013/final-gallery-fixed-coastal-1274-after.png',
 'artifacts/graphics-parallel-20261013/final-gallery-fixed-yeosu-3249-after.png','artifacts/graphics-parallel-20261013/final-gallery-fixed-seongsamjae-1398-after.png',
 'artifacts/vehicle-finish-20261013/gallery-after.png','artifacts/vehicle-polish-3pass-20261015/garage-1280.png','artifacts/vehicle-polish-3pass-20261015/safe-supra-front.png','artifacts/vehicle-polish-3pass-20261015/safe-huracan-front.png','artifacts/vehicle-polish-3pass-20261015/safe-gtr-front.png','artifacts/vehicle-polish-3pass-20261015/safe-slk-front.png',
 'artifacts/vehicle-polish-3pass-20261015/cockpit-active-1280.png','artifacts/vehicle-polish-3pass-20261015/hud-1280.png','artifacts/driving-five-pass-20261015/final-driving.png',
 'artifacts/online-review-20261015/production-host-lobby.png','artifacts/online-qr-20261015/production-lobby-1280.png','artifacts/online-qr-20261015/production-qr-1280.png','artifacts/online-qr-20261015/production-drive-paused.png'];
const usable=[];for(const source of candidates){try{const m=await sharp(source).metadata();usable.push({id:usable.length+1,source,width:m.width,height:m.height});}catch{console.log('Missing candidate',source);}}
await fs.writeFile(`${dir}/image-candidates.json`,JSON.stringify(usable,null,2));
for(let start=0;start<usable.length;start+=16){const batch=usable.slice(start,start+16),composite=[];for(let i=0;i<batch.length;i++){
 const c=batch[i],x=(i%4)*300,y=Math.floor(i/4)*195;
 composite.push({input:await sharp(c.source).resize(294,166,{fit:'contain',background:'#111'}).png().toBuffer(),left:x+3,top:y+3});
 composite.push({input:Buffer.from(`<svg width="300" height="23"><rect width="300" height="23" fill="#222"/><text x="8" y="17" fill="white" font-size="14">${c.id}. ${c.source.split('/').at(-1).slice(0,32)}</text></svg>`),left:x,top:y+170});
 }await sharp({create:{width:1200,height:Math.ceil(batch.length/4)*195,channels:3,background:'#222'}}).composite(composite).jpeg({quality:84}).toFile(`${dir}/contact-${start/16+1}.jpg`);}
console.log(JSON.stringify({candidates:usable.length,sheets:Math.ceil(usable.length/16)}));
