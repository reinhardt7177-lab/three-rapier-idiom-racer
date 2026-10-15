import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..'),workspace=path.dirname(root);
const result=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'cleanup-result.json'),'utf8'));
const saved=(result.deletedBytes/1024**3).toFixed(2);
const readme=`# MUMU CIRCUIT · Coastal Six

Blender 차량 8종을 선택하고 플레이어 1대 + AI 5대가 6.84km 해안 코스를 달리는 순수 웹 게임입니다. 화면은 Three.js, 주행·충돌은 Rapier, UI는 React를 사용합니다.

## 실행과 검증

- 현재 로컬 웹: [게임 실행](http://127.0.0.1:5191/)
- 개발: \`npm run dev -- --host 127.0.0.1 --port 5190 --strictPort\`
- 검증·빌드: \`npm run check\` 또는 \`npm run check:rebuild\`
- 빌드 실행: \`npm run preview -- --host 127.0.0.1 --port 5191 --strictPort\`
- 5191 서버 재실행: 상위 폴더의 \`WebPreview.cmd\`. \`Play.cmd\`는 실행 중인 로컬 게임을 엽니다.

## 현재 유지하는 파일

| 경로 | 용도 |
| --- | --- |
| \`src/rebuild/main.jsx\` | 현재 앱 입구·차고·레이스 UI |
| \`src/rebuild/\` | 차량 선택·주행·맵·VFX·렌더링 |
| \`src/driving/\`, \`src/garage/\`, \`src/rendering/\`, \`src/scenery/\` | 현재 앱과 회귀 시험이 사용하는 공유 모듈·검증용 차량 |
| \`public/assets/rebuild/\` | 차량 8종·맵·차고 GLB, 경로와 Draco 디코더 |
| \`assets-sources/vehicles-v6/\` | 현재 차량 8종 Blender 편집 원본 |
| \`assets-sources/rebuilt-unity/world.blend\`, \`garage.blend\` | 현재 맵·차고의 Blender 편집 원본; 폴더명은 복구 이력 |
| \`scripts/*.test.mjs\` | 현재 차량·주행·충돌·카메라·입력·메모리·렌더링 회귀 시험 |
| \`scripts/blender/\` | 최신 저장 원본에서 웹 GLB 수출 |
| \`artifacts/unity-recovery/colliders.bin\`, \`colliders.json\` | 전체 코스 물리 시험의 실제 충돌 데이터 |
| \`docs/\` | 현재 기능·검증·라이선스 기록 |

Blender 5.2는 Windows에 설치된 프로그램을 사용합니다. 작업 폴더의 이전 휴대용 Blender와 Unity 도구는 제거했습니다. 최신 원본은 지우지 않고 편집 후 수출합니다.

\`blender -b --python scripts/blender/export_fleet_eight.py -- --only huracan\`

맵·차고는 \`scripts/blender/export_environment.py\`로 수출합니다. 이전 제작 단계의 색 보정 스크립트를 다시 적용하지 않습니다.

## 정리와 현재 상태

2026-10-10 요청에 따라 구버전 실행본·차량 원본·미사용 코드·에셋·도구·시험 자료 ${result.deletedFiles.toLocaleString('en-US')}개, **${saved}GiB**를 삭제했습니다. 최신 모델·맵·차고와 현재 검사에 필요한 자료를 남겼습니다. Git 기록·원격 저장소 설정·비밀 설정 파일은 보존합니다.

[정리·성능 검증](docs/CLEANUP_PERFORMANCE_20261010.md) · [차량 외장 v6](docs/VEHICLE_POLISH_V6.md) · [다음 작업](docs/NEXT_STEPS.md)

현재 변경은 로컬 웹 제작본입니다. 기존 GitHub Pages는 이전 배포 상태이며 이번 작업에서는 공개 배포를 갱신하지 않았습니다. 휴대폰 실기기와 사람의 전체 코스 운전 검증은 남아 있습니다.
`;
fs.writeFileSync(path.join(root,'README.md'),readme);
fs.writeFileSync(path.join(workspace,'README.md'),`# MUMU CIRCUIT · 현재 웹 게임

현재 작업 프로젝트는 [three-rapier-idiom-racer](three-rapier-idiom-racer/README.md)입니다. Blender + Three.js + Rapier로 차량 8종, 플레이어 1대 + AI 5대 레이스를 제작합니다.

- [로컬 게임](http://127.0.0.1:5191/)
- \`WebPreview.cmd\`: 현재 웹 빌드 서버 실행
- \`RebuildPreview.cmd\`: 개발 서버 5190 실행
- \`Play.cmd\`: 실행 중인 5191 게임 열기
- [정리 기록](three-rapier-idiom-racer/docs/CLEANUP_PERFORMANCE_20261010.md)
- [다음 작업](three-rapier-idiom-racer/docs/NEXT_STEPS.md)

사용자 요청으로 이전 버전 파일 ${result.deletedFiles.toLocaleString('en-US')}개, ${saved}GiB를 삭제했습니다. 최신 차량 8종·전체 맵·차고의 Blender 원본, 웹 소스·검증 도구·Git 기록을 보존합니다. Unity 제작·실행 파일은 현재 작업 폴더에서 사용하지 않습니다. 공개 사이트는 이번 작업에서 변경하지 않았습니다.
`);
let index=fs.readFileSync(path.join(root,'index.html'),'utf8');
index=index.replace(/^.*<meta (?:property="og:image[^"\n]*"|name="twitter:image[^"\n]*")[^\n]*\r?\n/gm,'');
fs.writeFileSync(path.join(root,'index.html'),index);
// Replace links to deliberately removed historical files with honest plain text.
for(const file of fs.readdirSync(path.join(root,'docs')).filter(f=>f.endsWith('.md'))){
 const target=path.join(root,'docs',file);let content=fs.readFileSync(target,'utf8');
 content=content.replace(/\[([^\]]+)\]\(([^)]+)\)/g,(all,label,link)=>{
  if(/^(https?:|#|mailto:)/.test(link))return all;
  const actual=path.resolve(path.dirname(target),link.split('#')[0]);
  return fs.existsSync(actual)?all:`${label} (이전 파일 정리됨)`;
 });
 fs.writeFileSync(target,content);
}
console.log('Current READMEs, launch references and historical links updated.');
