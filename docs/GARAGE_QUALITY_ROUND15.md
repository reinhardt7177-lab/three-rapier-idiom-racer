# Garage Quality Round 15

## 이번 라운드

- 서비스 베이에 차량 액센트 컬러로 움직이는 스캔 라인을 추가했다.
- 스캔 라인은 서비스 카메라에서 좌우로 왕복하고, 차고지 펄스와 함께 밝기가 변한다.
- `buildGarageDistrict`가 차량 액센트를 받아 서비스 베이 연출과 분리된 월드 프롭을 안전하게 만든다.
- 선택 차량의 액센트를 `main`의 `--car-accent`로 유지하고, 선택 트랙의 액센트를 `--track-accent`로 추가했다.
- 레이스 결과 카드의 상단 라인·서킷명·기록 글로우는 트랙 액센트를 우선 사용한다. 결과 카드 내부의 차량 지표와 버튼은 차량 액센트를 유지해 “어떤 코스에서 어떤 차로 달렸는지”가 동시에 읽힌다.

## 확인 결과

- 차고지에서 `SERVICE` 카메라 전환과 서비스 베이 연출 확인.
- Alpine Sprint 선택 시 `--track-accent: #facc15`, RALLY R 선택 시 `--car-accent: #f2c94c`가 공존하는 것을 확인.
- 깨끗한 새 세션에서 Alpine Sprint 레이스 진입 확인: `RACE LIVE`, `SECTOR 01 / 03`, `LAP 1/2`, `POS 1/4`.
- 해당 세션 콘솔 오류 0건.
- 화면 캡처에서 골드 트랙·차량 액센트가 HUD의 섹터 바, 속도계, 니트로 버튼에 반영됨.

## 품질 게이트

- `npm.cmd run build -- --logLevel warn` 통과
- `node scripts/check-assets.mjs` 통과: CC0 201개 / 7.5 MB
- `node scripts/check-vehicle-assets.mjs` 통과: 차량 카탈로그 10개
- `node scripts/check-progression.mjs` 통과: 5 finishes / 4 wins / 430 gold / 10 cars unlocked

빌드에는 Rapier 번들로 인한 청크 크기 경고만 남아 있다. 기능 오류가 아니라 다음 최적화 라운드에서 `manualChunks` 또는 지연 로딩으로 분리할 대상이다.
