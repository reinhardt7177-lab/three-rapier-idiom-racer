# MUMU CIRCUIT

Blender 차량 8종을 선택하고 플레이어 1대 + AI 5대가 **해안 월드 6.84km 또는 남악 시티 2.93km**를 달리는 순수 웹 게임입니다. 화면은 Three.js, 주행·충돌은 Rapier, UI는 React를 사용합니다.

## 실행과 검증

- 현재 로컬 웹: [게임 실행](http://127.0.0.1:5191/)
- 새 맵: [남악 시티 실행](http://127.0.0.1:5191/?track=namak) · 차고에서 코스 선택
- 개발: `npm run dev -- --host 127.0.0.1 --port 5190 --strictPort`
- 검증·빌드: `npm run check` 또는 `npm run check:rebuild`
- 빌드 실행: `npm run preview -- --host 127.0.0.1 --port 5191 --strictPort`
- 5191 서버 재실행: 상위 폴더의 `WebPreview.cmd`. `Play.cmd`는 실행 중인 로컬 게임을 엽니다.

## 현재 유지하는 파일

[남악 시티 트랙](docs/NAMAK_CITY_20261010.md): 항공·거리 사진을 참고한 도청대로·상가·아파트·영산강 수변·공원 순환 코스. 실제 도시 전체의 측량 복제는 아닙니다. 원본은 `assets-sources/namak/namak.blend`, 재생성은 `scripts/blender/build_namak.py`, 전체 미리보기는 `scripts/blender/preview_namak.py`입니다.

[남악 도로 주변·조향 개선](docs/NAMAK_POLISH_20261010.md): 정류장·상가 쇼윈도·보도 포장·화단·주차 차량과 재질·조명을 보강했습니다. 터치 브레이크는 오래 눌러도 후진하지 않습니다.

[코너 조향·접지 보강](docs/STEERING_TURN_20261010.md): 이전 조향에 추가1.3배(기본 대비1.69)를 적용하고 플레이어 접지를30% 보강했습니다. 저속 최대 각도는 유지하며 약90km/h의 실제 물리 시험에서 차량8종의 회전반경이21~23% 감소했습니다.

[해변 BGM · Blender 3D 운전석 · 빠른 라이벌](docs/RACE_EXPERIENCE_20261010.md): `V`로 시점 전환, 메뉴에서 음악 설정. 실제 조향·속도·RPM이 핸들/계기판에 연결됩니다. 운전석은 8종 공통 커스텀 모델입니다.

[음악 2곡 선택](docs/MUSIC_SELECTION_20261010.md): `ESC → 배경음악 선택`에서 해변 힙합 **Seven Mile Horizon** 또는 신스웨이브 **Slipstream Pursuit**를 선택합니다. 선택은 새로고침 후에도 유지됩니다.

| 경로 | 용도 |
| --- | --- |
| `src/rebuild/main.jsx` | 현재 앱 입구·차고·레이스 UI |
| `src/rebuild/` | 차량 선택·주행·맵·VFX·렌더링 |
| `src/driving/`, `src/garage/`, `src/rendering/`, `src/scenery/` | 현재 앱과 회귀 시험이 사용하는 공유 모듈·검증용 차량 |
| `public/assets/rebuild/` | 차량 8종·맵·차고 GLB, 경로와 Draco 디코더 |
| `assets-sources/vehicles-v6/` | 현재 차량 8종 Blender 편집 원본 |
| `assets-sources/cockpit-v1/cockpit.blend` | 1인칭 3D 운전석 Blender 편집 원본 |
| `public/assets/audio/*.mp3` | 해변 힙합·신스웨이브 BGM 2곡 |
| `assets-sources/rebuilt-unity/world.blend`, `garage.blend` | 현재 맵·차고의 Blender 편집 원본; 폴더명은 복구 이력 |
| `scripts/*.test.mjs` | 현재 차량·주행·충돌·카메라·입력·메모리·렌더링 회귀 시험 |
| `scripts/blender/` | 최신 저장 원본에서 웹 GLB 수출 |
| `artifacts/unity-recovery/colliders.bin`, `colliders.json` | 전체 코스 물리 시험의 실제 충돌 데이터 |
| `docs/` | 현재 기능·검증·라이선스 기록 |

Blender 5.2는 Windows에 설치된 프로그램을 사용합니다. 작업 폴더의 이전 휴대용 Blender와 Unity 도구는 제거했습니다. 최신 원본은 지우지 않고 편집 후 수출합니다.

`blender -b --python scripts/blender/export_fleet_eight.py -- --only huracan`

맵·차고는 `scripts/blender/export_environment.py`로 수출합니다. 이전 제작 단계의 색 보정 스크립트를 다시 적용하지 않습니다.

## 정리와 현재 상태

2026-10-10 요청에 따라 구버전 실행본·차량 원본·미사용 코드·에셋·도구·시험 자료 8,105개, **1.61GiB**를 삭제했습니다. 최신 모델·맵·차고와 현재 검사에 필요한 자료를 남겼습니다. Git 기록·원격 저장소 설정·비밀 설정 파일은 보존합니다.

[정리·성능 검증](docs/CLEANUP_PERFORMANCE_20261010.md) · [차량 외장 v6](docs/VEHICLE_POLISH_V6.md) · [다음 작업](docs/NEXT_STEPS.md)

[오픈소스 차량 제어 비교 분석](docs/RACING_REPOSITORY_COMPARISON_20261010.md): 현재 튜닝의 적용 여부와 접지·조향·카메라 설계, 다음 구현 제안.

[주행 설계 적용·실제 맵 계측](docs/RIDE_DESIGN_20261010.md): 중복 바닥 지지 수정, 차량별 구동·제동·접지력 연결, 고정 물리 시간과 회귀 검증.

[1차 그래픽·코스 안내 폴리싱](docs/VISUAL_POLISH_20261010.md): 차량 페인트·유리 마감, 하늘·노면 표현, 커브 방향과 남은 거리 HUD. 113개 회귀 시험·웹 빌드 통과. 차량 형상과 주행 물리는 이번 변경에서 유지합니다.

[AI 라이벌 추월·회피](docs/RIVAL_AI_20261010.md): 실제 도로 포장과 차량 간격을 확인해 차선 이동·추월·복귀합니다. 차량 8종의 실제 직선 추월과 6대 전체 코스 완주, 브라우저 주행 흐름을 확인했습니다. 최신 전체 회귀 시험 131개·웹 빌드 통과.

[차량별 엔진 소리·가속 응답](docs/ENGINE_FEEL_20261010.md): 합성 음색 8종, 실제 RPM·변속 연결, 차량별 가속 응답과 음소거 유지·터치 제어. 최신 전체 회귀 시험 136개·웹 빌드 통과. 수프라는 검증된 기존 주행 설정을 유지했습니다.

현재 변경은 로컬 웹 제작본입니다. 기존 GitHub Pages는 이전 배포 상태이며 이번 작업에서는 공개 배포를 갱신하지 않았습니다. 휴대폰 실기기와 사람의 전체 코스 운전 검증은 남아 있습니다.

[남악 지명·길찾기 표식](docs/NAMAK_LANDMARKS_20261010.md): Blender 안내판·도로명·입구 표식22개, 출처와 게임 좌표·편집 원본·검증 기록.
