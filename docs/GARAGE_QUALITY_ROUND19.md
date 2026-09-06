# Garage Quality Round 19

## 라이브 UI 모션

- 차고지 전용 `garage-theme.css`를 추가했다.
- 프로필·최근 기록 패널에 차량 액센트 기반 스캔 글로우를 넣었다.
- PIT CREW ONLINE 상태 점을 펄스시키고, 선택 차량 카드 하단에 이동하는 액센트 레일을 추가했다.
- 쇼룸 카메라 컨트롤에도 선택 차량 색상의 약한 외곽광을 연결했다.
- `prefers-reduced-motion`에서는 모든 장식 애니메이션을 자동 비활성화한다.
- 화면 전환 때 동일한 `setMenuMode`를 두 번 호출하던 중복 effect를 제거해 런타임 handoff를 한 번만 수행한다.

## 검증

- 데스크톱 차고지에서 VOLT X 시안 패널 모션 확인.
- 390×844 모바일 차고지에서 `SELECT CIRCUIT` 버튼 하단 `836px`, 폭 `366.4px`, 콘솔 오류 0건 확인.
- 기존 모바일 레이스 진입 흐름과 차량 그리드 유지 확인.
- `npm.cmd run build -- --logLevel warn` 통과.
- `node scripts/check-assets.mjs` 통과: CC0 201개 / 7.5 MB.
- `node scripts/check-vehicle-assets.mjs` 통과: 차량 카탈로그 10개.
- `node scripts/check-progression.mjs` 통과: 5 finishes / 4 wins / 430 gold / 10 cars unlocked.

빌드에는 Rapier 청크 크기 경고만 남아 있다. 다음 최적화 라운드에서는 물리 런타임을 더 세밀하게 분리한다.
