# Garage Quality Round 17

## 바닥 접지감

- 차량 아래에 액센트 컬러 기반의 소프트 라이트 반사 프리셋을 추가했다.
- 캔버스 radial gradient를 additive 재질로 사용해 별도 에셋 없이 바닥에 은은한 차체·언더글로 반사를 만들었다.
- 쇼룸 펄스에 맞춰 반사 강도와 미세 회전이 변해 차량이 바닥에 떠 보이지 않도록 했다.

## 결과 시네마틱

- `harbor-ring`, `neon-eight`, `alpine-sprint` 결과 카메라의 높이·후방 거리·초기 틸트를 분리했다.
- 네온은 더 넓은 시야와 후방 거리, 알파인은 높은 축하 앵글을 사용해 트랙 성격이 완주 화면에서도 유지된다.
- 결과 카드의 `--track-accent` 테마와 카메라 구도를 같은 트랙 데이터에서 파생시켰다.

## 검증

- 새 브라우저 세션에서 차고지 바닥 반사 확인.
- VOLT X 쇼룸에서 시안 액센트와 반사 확인.
- Alpine Sprint 레이스 진입 확인: `RACE LIVE`, `SECTOR 01 / 03`, `LAP 1/2`, 콘솔 오류 0건.
- `npm.cmd run build -- --logLevel warn` 통과.
- `node scripts/check-assets.mjs` 통과: CC0 201개 / 7.5 MB.
- `node scripts/check-vehicle-assets.mjs` 통과: 차량 카탈로그 10개.
- `node scripts/check-progression.mjs` 통과: 5 finishes / 4 wins / 430 gold / 10 cars unlocked.

빌드에는 Rapier 번들 청크 크기 경고만 남아 있다. 기능 오류가 아니라 다음 성능 라운드의 분리 대상이다.
