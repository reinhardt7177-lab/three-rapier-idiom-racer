# Garage Quality Round 20

## 레이스 시작 체감 개선

- `setMenuMode("tracks")` 진입 시 `loadPhysics()`를 백그라운드에서 미리 호출하도록 연결했다.
- 물리 초기화는 `physicsReady`·`physicsPromise` 가드로 한 번만 실행되며, 사용자가 차고지에서 바로 레이스를 누르는 기존 흐름도 그대로 유지한다.
- 트랙 선택 화면에서 물리 런타임이 준비되는 동안 사용자는 코스·차량을 확인할 수 있어 `ENTER RACE` 이후 첫 프레임 지연을 줄인다.

## 검증

- 차고지 → `SELECT CIRCUIT` → 1.2초 prewarm → `ENTER RACE` 흐름 확인.
- 하버 링에서 race handoff 약 1.8초 내 `RACE LIVE`, `SECTOR 01 / 03`, `LAP 1/3` 표시.
- 해당 세션 콘솔 오류 0건.
- 기존 Rapier dynamic import와 `manualChunks` 분리 유지.
- `npm.cmd run build -- --logLevel warn` 통과.
- `node scripts/check-assets.mjs` 통과: CC0 201개 / 7.5 MB.
- `node scripts/check-vehicle-assets.mjs` 통과: 차량 카탈로그 10개.
- `node scripts/check-progression.mjs` 통과: 5 finishes / 4 wins / 430 gold / 10 cars unlocked.

Rapier 청크 크기 경고는 남아 있지만, 물리 모듈은 차고지 초기 화면이 아니라 트랙 선택 단계에서만 준비된다.
