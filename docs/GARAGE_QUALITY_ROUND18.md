# Garage Quality Round 18

## Adaptive 렌더링

- 모바일(뷰포트 760px 이하)에서 WebGL pixel ratio를 최대 1.2로 제한했다.
- 모바일 그림자 맵을 2048²에서 1024²로 낮추고, 네온 Bloom 강도를 0.36→0.30, 일반 트랙은 0.14→0.10으로 조절했다.
- 데스크톱의 조명·Bloom 품질은 기존 값을 유지한다.
- Rapier는 이미 별도 `manualChunks`로 분리돼 있으며, 현재 산출물에서 2.85 MB 청크로 남는다. 다음 단계는 물리 런타임 자체를 더 작은 worker/지연 로딩 단위로 나누는 작업이다.

## 검증

- 390×844 모바일 차고지: 차량 그리드·`SELECT CIRCUIT` 버튼 노출, 오류 0건.
- 390×844 모바일 Alpine Sprint 레이스: `RACE LIVE`, `SECTOR 01 / 03`, `LAP 1/2`, 오류 0건.
- 데스크톱 차고지 새 세션: 오류 0건.
- `npm.cmd run build -- --logLevel warn` 통과.
- `node scripts/check-assets.mjs` 통과: CC0 201개 / 7.5 MB.
- `node scripts/check-vehicle-assets.mjs` 통과: 차량 카탈로그 10개.
- `node scripts/check-progression.mjs` 통과: 5 finishes / 4 wins / 430 gold / 10 cars unlocked.

빌드에는 Rapier 청크 크기 경고만 남아 있으며, 기능·화면 검증에는 영향이 없다.
