# Game Studio 주행·그래픽 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 기존 레이스 안정성을 유지하면서 야간 차량 반사·노면·입력을 다듬는다. 사람용 물리 후보는 여수 교통 완주 악화로 보류했고, 사용자는 안정 물리를 유지하고 표현·입력 검수를 마무리하기로 결정했다.

**Architecture:** 현재 imperative Three.js renderer와 Rapier simulation 경계를 유지한다. 사람용 교정을 opt-in으로 분리하고 PMREM/공용 그레인을 재사용한다.

**Tech Stack:** JavaScript, React DOM, Three.js, Rapier, Vite, Node test.

**Spec:** `docs/GAME_STUDIO_DESIGN_20261103.md`

## Global Constraints

- 기존 브랜치, 사용자 자료와 비밀 파일 보존. 새 배포/PR/main 병합 없음.
- 기존 도로 지지/충돌/경로/메달 유지. AI 튜닝/온라인은 기존 물리 값 유지.
- 테스트 단언과 완주 제한을 느슨하게 바꾸지 않는다.

## Review Focus

- 실제 속도는 큰데 앞 속도만 작은 횡미끄러짐에서 저속 조향·보정 해제가 없어야 한다.
- 공중·후진·일시정지에서 보정이 의도치 않게 생기지 않아야 한다.
- 사람차 접촉 변화가 기존 AI 완주를 막지 않아야 한다.
- 노면 shader는 경사와 축소 화면에서 깜박이지 않고 기하·그레인 예산을 유지해야 한다.
- 메뉴/회전/포커스 변화 뒤 키보드·터치가 고착되지 않아야 한다.

## Task 1 · 전체 점검과 기준

- [x] 지침/현재 소스/이전 실패/파일 시각/메모리 확인, 수정 전 11파일 보존.
- [x] 같은 실제 Rapier 8종56조건을 새 파일에 실행한다.
- [x] 4코스와 두 카메라·핵심 UI/자산/온라인 계약을 점검하고 심각도별 보고를 남긴다. 실기기·서로 다른 네트워크 온라인 검수와 카메라 가림 재현은 잔여 항목으로 구분한다.

## Task 2 · 사람용 주행 교정

Files: `src/rebuild/vehicleDynamics.js`, `src/driving/physics.js`, `src/driving/arcadeAction.js`, `src/rebuild/runtime.js`, `scripts/race-sim.mjs`, `scripts/human-handling.test.mjs`, `package.json`.

Interfaces: `humanRaceTuning(id)` returns an independent SI calibration with explicit ground-speed policy. Existing tuning functions remain byte-compatible in returned legacy values. Runtime and race-sim use this only for non-online human cars.

- [x] 실패 시험: 8종 자연 가속→80km/h 선회/90km/h 드리프트, 속도 기준/부호/보정 끔/공중, AI 프리셋 불변。
- [x] 후보 18개 관련 시험과 8종 평지 목표를 통과했다. 제품 적용은 보류했다.
- [x] 4코스 보통1랩·해안쉬움3랩 통과, 여수쉬움/맑음/일반차6대1랩 실패를 이전 안정본과 대조했다. 312.19초 완주→420초 미완주로 악화되어 중단했다.
- [x] 후보와 나쁜 표본을 보존하고 물리4파일을 변경 전 바이트로 복원했다. 사용자 결정으로 이 계획에서 추가 물리 조정을 종료했다.

## Task 3 · 반사와 노면

Files: `src/rebuild/vehicleStudio.js`, `src/rebuild/surfacePolish.js`, `src/rebuild/runtime.js`, `scripts/studio-visuals.test.mjs`, `package.json`.

Interfaces: `createNightVehicleStudio()` returns a disposable no-light baking scene. World surfaces retain geometry identity, one 16,384B grain and no extra draw pass.

- [x] 실패 시험: 야간 반사의 따뜻한/청색 분리·조명0·자원 해제, 도로 기하/바탕색/공용 텍스처/주간 보존.
- [x] 최소 수정과 관련 렌더·차량·밤·자원 시험, 전후 캡처. 젖은 거칠기와 미분 이식성 검토 지적을 실패 시험으로 재현·수정했다.

## Task 3b · 안전 복귀·입력·메뉴

- [x] 일반 교통을 포함한 복귀 위치 시험, 실제 점유 위치를 피하는 탐색 연결.
- [x] 터치 DRIFT/키보드 동시 소유권·취소·clear 시험.
- [x] 메뉴 초기 초점·Tab 순환·화면변경/비활성 기본 버튼 대체.
- [x] 7버튼의 작은 화면 잘림을 재현하고 2줄 배치로 수정했다. 여섯 가로 크기/세로 복귀를 실제 DOM·화면으로 점검했다.

## Task 4 · 회귀와 실제 화면

- [x] 테스트 출력을 격리한 동일 입력본에서 전체 `npm run check`526/526·웹 빌드4.54초 통과. 첫 캐시 키 실패525/526를 보존하고 기준 변경 없이 원인 수정 후 전체 재실행했다.
- [x] 브라우저 차고→출발→주행→메뉴/시점→복귀와 네 가로/한 세로 크기, 오류/입력·시야. 최종 웹 빌드 네 크기7버튼/44px/히트7/7/잘림0·키보드48km/h/포인터35km/h·벽 접촉 뒤 복귀4접지/입력0도 확인했다.
- [x] 같은 조건 전후30초 A/B/A 프레임과 배포 파일 용량/자산 해시. 남악p95동일33.4ms. 여수 기준 편차/시간 손실로 GPU 비용 원인은 확정하지 못한 한계를 명시했다. 정적+3,669B·gzip+816B·첫로딩+820B, 공개29/블로그20/물리4파일 보존·229입력 일치.
- [x] 실패·수정·남은 위험을 새 docs와 NEXT_STEPS에 기록했다. 이번 승인 범위는 로컬 개선이므로 배포하지 않았다.
