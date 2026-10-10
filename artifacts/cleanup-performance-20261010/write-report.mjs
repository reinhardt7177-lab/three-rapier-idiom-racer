import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..');
const read=name=>JSON.parse(fs.readFileSync(path.join(import.meta.dirname,name),'utf8'));
const cleanup=read('cleanup-result.json'),before=read('before-driving.json'),after=read('after-driving.json');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const roundtrips=read('export-roundtrip.json');
if(roundtrips.some(r=>!r.renderEquivalent))throw new Error('Export changed rendered geometry/materials');
const manifest=fs.readdirSync(path.join(root,'public/assets/rebuild')).filter(f=>f.endsWith('.glb')).map(file=>({file,sha256:hash(path.join(root,'public/assets/rebuild',file)),distIdentical:hash(path.join(root,'public/assets/rebuild',file))===hash(path.join(root,'dist/assets/rebuild',file))}));
if(manifest.some(f=>!f.distIdentical))throw new Error('Build/runtime GLBs differ');
fs.writeFileSync(path.join(import.meta.dirname,'build-assets.json'),JSON.stringify(manifest,null,2));
fs.writeFileSync(path.join(root,'docs/CLEANUP_PERFORMANCE_20261010.md'),`# 현재 웹 파일 정리·렌더링 1차 개선 · 2026-10-10

## 삭제 범위와 보존

사용자가 현재 프로그램에 필요한 파일을 남기고 나머지를 삭제하도록 요청했다. 현재 앱 입구와 회귀 시험의 실제 상대경로 import를 따라 40개 소스 파일을 유지했다. 웹 배포 에셋, 최신 편집 원본, 현재 개발·검증 도구를 함께 보호했다.

- 삭제: **${cleanup.deletedFiles.toLocaleString('en-US')}개 파일, ${cleanup.deletedBytes.toLocaleString('en-US')}바이트 = ${(cleanup.deletedBytes/1e9).toFixed(2)}GB / ${(cleanup.deletedBytes/1024**3).toFixed(2)}GiB**. 빈 폴더 1,098개도 정리했다.
- 삭제 대상: 이전 Unity/WebGL·v54 배포 사본, Unity 추출·CLI 도구, 이전 휴대용 Blender, v2~v5 및 복구 차량 원본, 미사용 Kenney 다운로드와 런타임 에셋, 옛 캠페인·라이벌·첫 버전 코드, 예전 생성·검수 스크립트와 자료.
- 유지: 현재 8종 v6 Blender 원본, 전체 맵·차고 Blender 원본, 10개 GLB·현재 도로 경로·Draco 디코더, 현재 웹·회귀 시험·콜라이더 데이터, 기능·라이선스 기록, 의존성·잠금 파일·실행 빌드.
- Git 기록·원격 설정·비밀 설정 파일을 유지했다. 이전 배포 저장소의 Git 기록 약610MiB는 삭제 대상에 포함하지 않았다. 원격 GitHub Pages는 변경하지 않았다.

삭제 전 경로를 D:\\racing 내부로 확인하고 링크·Git 경로를 제외했다. 삭제 후 전체 후보가 사라졌는지 다시 확인했다. 보호 파일 ${cleanup.unchangedProtectedFiles}개는 SHA-256이 유지됐다. \`worldRendering.js\` 하나는 정리 도중 다음 작업인 셀 크기 변경을 적용해 최초 해시 검사에서 의도된 차이가 감지됐다. 별도 감사에서 이 한 파일의 이전·현재 해시와 변경 사유를 기록하고, 나머지는 모두 동일함을 확인했다. 검사 예외를 감추거나 전체 해시가 동일했다고 보고하지 않는다.

이전 차량·모델 원본의 고유 사본은 삭제됐으며 복구용 새 백업을 만들지 않았다. 앞으로 모델 편집은 남긴 v6 차량과 현재 맵·차고 원본을 사용한다.

## 현재 제작 도구

삭제한 v3 제작기에서 가져오던 메시 묶음 함수를 \`scripts/blender/web_meshes.py\`로 독립시켰다. 차량은 \`export_fleet_eight.py\`, 환경은 \`export_environment.py\`로 현재 저장 원본에서 수출한다. 환경 수출은 월드 물리 시험 데이터도 갱신한다. 과거 변환 때 쓰던 색 보정을 다시 적용하지 않는다.

Blender 5.2.1에서 수프라·차고를 임시 출력 경로로 실제 수출했다. 수프라는 현재 실행 GLB와 SHA-256이 동일했다. 차고는 파일 해시가 달랐지만, 현재·재수출 GLB를 Three.js로 읽고2,600개 삼각형의 변환된 위치·법선·UV·재질과 외곽 크기를 비교해 동일한 렌더링 데이터를 확인했다. 최신 제작 원본의 이전 버전 의존성이 없다. 최신 차량·맵 GLB 10개와 dist의 SHA-256이 모두 동일하다. 검증용 임시 GLB2개는 비교 후 제거했다.

\`Play.cmd\`는 5191 현재 게임을 열고, \`WebPreview.cmd\`는 현재 프로젝트의 웹 빌드 서버를 실행하도록 바꿨다. 삭제한 이전 배포 폴더로 가는 실행 경로와 옛 공유 이미지를 제거했다. \`npm run check\`는 현재 \`check:rebuild\`를 실행한다.

## 프레임 개선과 관찰

맵 장식의 공간 분할을 **256m → 128m**로 바꿨다. 더 작은 단위로 화면·그림자 영역 밖의 나무·건물 장식을 제외한다. 원래 삼각형·속성·재질을 유지하고 도로·충돌 데이터는 바꾸지 않는다. 총 객체는 755개에서 1,453개로 늘어 일부 장면의 CPU 비용은 증가할 수 있다.

인앱 브라우저 1280×720, DPR1.25, 우라칸·같은 출발 배치에서 재개 후 W키9초로 짧게 비교했다. 최근240프레임 값이며 각각 경과6.27초·6.62초의 인접한 위치다. 이 직진 조작은 코너를 따라 조향하지 않아 마지막 표본에서 도로 옆 잔디로 진입했다. 도로 위 같은 코너의 벤치마크가 아니다. 초기 로딩과 다른 프로그램 부하, 프레임 기록 구간 길이 차이가 있어 엄밀한 동일 위치 벤치마크나 모든 구간의 향상률로 해석하지 않는다.

| 계측 | 수정 전 | 수정 후 |
| --- | ---: | ---: |
| 표시 FPS | ${before.fps} | ${after.fps} |
| 평균 프레임 시간 | ${before.rendering.meanMs.toFixed(2)}ms | ${after.rendering.meanMs.toFixed(2)}ms |
| 95백분위 | ${before.rendering.p95Ms.toFixed(1)}ms | ${after.rendering.p95Ms.toFixed(1)}ms |
| 최대 | ${before.rendering.maxMs.toFixed(1)}ms | ${after.rendering.maxMs.toFixed(1)}ms |
| 마지막 프레임 드로 호출 | ${before.rendering.calls} | ${after.rendering.calls} |
| 마지막 프레임 삼각형 | ${before.rendering.triangles.toLocaleString('en-US')} | ${after.rendering.triangles.toLocaleString('en-US')} |
| 속도 | ${before.kmh}km/h | ${after.kmh}km/h |

정지된 출발 장면 표시 FPS는 45 → 41로 관찰됐다. 한 장면의 개선을 전체 성능 개선으로 단정하지 않는다.

## 검증과 다음 단계

- 삭제·셀 크기 수정 후 **99개 회귀 시험 통과, 실패0·웹 빌드 성공**: 8종 모델·피벗·접지·제동·바퀴 회전·고속 충돌·복귀·AI 전체코스·입력·VFX·리소스 해제·렌더링 삼각형 보존.
- 실제 브라우저: 에셋 로드, 차량8종 선택, 우라칸 출발·약140km/h 가속·일시 정지·차고 복귀. 수정 후4륜 접지·배기 입자 유지, 키 해제 후 입력0, 수집된 오류 로그 없음.
- 이번 검수는 휴대폰 실기기와 사람이 운전하는 전체 코스·10분 지속 성능을 대신하지 않는다. 현재 변경은 로컬 웹 제작본이다.
- 다음: 같은 고정 위치·카메라에서 반복 프레임 계측, 실제 휴대폰10분 운전·메모리·발열·동시 터치, 사람이8종으로 급코너·근접 충돌 체감 검수.

기록은 \`artifacts/cleanup-performance-20261010/\`의 \`cleanup-manifest.json\`, \`cleanup-result.json\`, \`check.log\`, \`before/after-driving.json\`, \`after-driving.png\`, \`eight-selection.json\`, \`export-roundtrip.json\`, \`build-assets.json\`에 있다.
`);
fs.writeFileSync(path.join(root,'docs/NEXT_STEPS.md'),`# 현재 상태와 다음 작업 · 2026-10-10

현재 제작은 Blender + Three.js + Rapier 순수 웹 게임이다. 차량8종 중1대를 선택하고 AI5대와6.84km 해안 레이스를 한다. Unity 실행·제작 파일을 사용하지 않는다.

## 이번 완료

- 이전 버전·미사용 파일8,105개 삭제: 약1.73GB /1.61GiB 확보. 최신 차량8종·맵·차고 Blender 원본과 현재 웹·검증 파일은 유지.
- 맵 장식 셀256m→128m. 짧은 주행에서43→53FPS 관찰; 위치·구간 차이가 있고 정지 장면은45→41FPS라 모든 구간 개선을 보장하지 않는다.
- 99개 회귀 검사·웹 빌드, Blender 차량·차고 실제 수출, 브라우저8종 선택·가속·정지·복귀 확인.
- [삭제 목록·계측·한계](CLEANUP_PERFORMANCE_20261010.md) · [현재 차량 외장](VEHICLE_POLISH_V6.md).

## 다음 우선순위

1. 같은 고정 위치·카메라·해상도로 반복 계측하여 항구·도심·산길의 병목을 분리한다. 주행 중 프레임 안정성을 우선한다.
2. 실제 휴대폰에서10분 이상 주행: 메모리·발열·프레임, 두 손가락 가속·조향, 메뉴·앱 전환·화면 회전 후 입력 해제를 확인한다.
3. 사람이 차량8종의 코너·연석·근접 충돌·복귀와 외형을 평가한다. 자동 전체 코스 완주를 사람의 체감 검수로 간주하지 않는다.

최신 편집 원본은 \`assets-sources/vehicles-v6/\`와 \`assets-sources/rebuilt-unity/world.blend\`, \`garage.blend\`다. 원본 편집·수출 명령은 [README](../README.md)를 따른다. 이전 버전 재생성 스크립트는 삭제되어 사용할 수 없다.

로컬 게임: [5191 웹](http://127.0.0.1:5191/). 공개 사이트는 이번 변경을 반영하지 않았다. 출시 완료·휴대폰 지원 완료로 선언하지 않는다.
`);
console.log(JSON.stringify({roundtrips,buildGLBs:manifest.length,allBuildGLBsIdentical:true}));
