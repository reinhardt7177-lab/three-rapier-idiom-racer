import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const dir='artifacts/release-curation-20261016',out='docs/blog/images';
const candidates=JSON.parse(await fs.readFile(`${dir}/image-candidates.json`,'utf8'));
const chosen=[
 [1,'01-early-driving','초기 웹 프로토타입의 주행 화면','이전 Git 기록에서 복구한 화면. 현재 출시 모습이 아니다.'],
 [2,'02-early-harbor-garage','초기 항구 차고','차량 선택과 항구 세계를 한 장면으로 묶던 초기 UI.'],
 [4,'03-eight-car-garage-v6','Blender 차량 8종과 차고','수프라를 포함한 8종 차량 선택 화면의 이전 v6 단계.'],
 [8,'04-namak-first-overview','남악 시티 첫 코스 구성','남악의 지형·건물·폐곡선 도로를 한눈에 본 제작 화면.'],
 [9,'05-namak-first-driving','남악 시티 초기 주행','현실 지역의 지명과 분위기를 게임 트랙으로 옮기던 단계.'],
 [11,'06-cockpit-first-model','초기 3D 운전석','초기 계기판·대시보드와 핸들 모델. 뒤에서 시야·배치를 다시 다듬었다.'],
 [14,'07-yeosu-night-before','여수 야경 개선 전','야간 도로의 색과 시야를 보완하기 전의 실제 검수 화면.'],
 [16,'08-mountain-first-hairpin','성삼재 초기 헤어핀','산길의 연속 코너와 도로 연결을 먼저 확인한 화면.'],
 [18,'09-championship-result','전남 챔피언십 결과','세 코스를 이어 달리는 시리즈의 점수·결과 화면.'],
 [19,'10-yeosu-lit-bridge','여수 다리 조명 개선','현실 사진과 지도에서 특징을 골라 반영한 조명·도로. 측량 복제는 아니다.'],
 [23,'11-mountain-roadscape','성삼재 도로 주변 개선','숲·경사면·능선과 커브의 색을 보완한 제작 검수 화면.'],
 [25,'12-namak-civic-detail','남악 도청 주변 상세화','도로와 건축 배치·광장·수목을 확인한 Blender 렌더. 실제 게임 화면과 구분한다.'],
 [27,'13-namak-waterfront','남악 수변 구간','수변 순환 도로와 주거지 배치를 확인한 Blender 렌더.'],
 [28,'14-coastal-lighthouse','해안 코스 등대 구간','해안의 지형·랜드마크와 도로 시인성을 보완한 검수 화면.'],
 [32,'15-current-garage','최신 차량 차고','2026-10-15 차량 폴리싱 이후의 차고 검수 화면.'],
 [33,'16-supra-polish-comparison','차량 실루엣·재질 비교','수프라의 이전/이후를 같은 시점에서 비교한 제작 검수 화면.'],
 [37,'17-current-cockpit','다듬은 1인칭 운전석','도로가 보이는 범위·핸들·계기판 배치를 조정한 최신 단계.'],
 [38,'18-current-race-hud','최신 주행과 HUD','차체·도로·순위·속도 정보를 실제 주행에서 확인한 화면.'],
 [39,'19-online-friend-lobby','친구와 온라인 1:1 대기실','방 만들기·준비·출발 흐름. 임의 상대 자동 매칭 화면은 아니다.'],
 [40,'20-qr-invitation','QR 친구 초대','2026-10-15 공식 배포의 QR 화면. 사진 속 검수 방은 종료됐으므로 게임에서 새 방을 만든다.'],
];
await fs.mkdir(out,{recursive:true});const selected=[];
for(const [id,name,title,caption] of chosen){const c=candidates.find(c=>c.id===id);if(!c)throw Error(`Missing ${id}`);const b=await fs.readFile(c.source),dest=`${out}/${name}${path.extname(c.source)}`;await fs.writeFile(dest,b);selected.push({order:selected.length+1,title,caption,path:dest,original:c.source,width:c.width,height:c.height,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex'),historicalCommit:id<=2?'3cc854b079ac559396b3c502ea3603e14d63efee^':null});}
await fs.writeFile('docs/blog/image-index.json',JSON.stringify({selectedAt:'2026-10-16',count:20,images:selected},null,2));
await fs.writeFile('docs/blog/IMAGES.md','# 블로그 대표 이미지 20장\n\n초기 웹 프로토타입부터 2026-10-15 QR 초대까지, 실제로 남아 있는 화면을 골랐습니다. Unity 시절 원본은 현재 폴더에 없어 복구했다고 주장하지 않습니다. 제3자 지도·관광 사진은 이 목록에 포함하지 않았습니다. 이미지 속 검수용 QR 방은 종료된 상태입니다.\n\n'+selected.map(i=>`## ${String(i.order).padStart(2,'0')}. ${i.title}\n\n${i.caption}\n\n![${i.title}](images/${path.basename(i.path)})\n`).join('\n'));
const inventory=JSON.parse(await fs.readFile(`${dir}/inventory.json`,'utf8'));
const extra=[...candidates.filter(c=>c.source.startsWith(dir+'/')).map(c=>c.source),...Array.from({length:3},(_,i)=>`${dir}/contact-${i+1}.jpg`)];
const targets=[...inventory.files.filter(f=>f.image).map(f=>f.path),...extra];const manifest=[];
for(const p of [...new Set(targets)]){const s=await fs.lstat(p);if(!s.isFile()||s.isSymbolicLink())throw Error('Expected regular file '+p);const b=await fs.readFile(p);manifest.push({path:p,bytes:s.size,mtime:s.mtime.toISOString(),sha256:createHash('sha256').update(b).digest('hex')});}
await fs.writeFile(`${dir}/image-removal-manifest.json`,JSON.stringify({root:process.cwd(),selected:20,files:manifest,totalBytes:manifest.reduce((n,f)=>n+f.bytes,0)},null,2));
console.log(JSON.stringify({kept:selected.length,keptBytes:selected.reduce((n,f)=>n+f.bytes,0),deleteFiles:manifest.length,deleteBytes:manifest.reduce((n,f)=>n+f.bytes,0)}));
