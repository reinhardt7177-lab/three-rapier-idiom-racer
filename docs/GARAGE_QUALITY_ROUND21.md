# Garage quality round 21 — physics handoff feedback

이번 라운드는 트랙 선택 화면에서 Rapier 준비 상태를 숨기지 않고 레이스 진입 흐름에 연결했다.

## 적용 내용

- `src/racing-runtime.js`
  - 트랙 선택 진입 시 Rapier 동적 import를 prewarm한다.
  - HUD 상태를 `prewarming`으로 노출해 물리 준비 중임을 구분한다.
  - 레이스 진입 직후에는 `loading` → `RACE LIVE`로 상태가 이어진다.
- `src/App.jsx`
  - 트랙 선택의 `ENTER RACE` 버튼이 prewarm 중 `WARMING PHYSICS`로 바뀐다.
  - `aria-busy`를 함께 노출해 보조기기에서도 준비 상태를 알 수 있다.
- `src/track-theme.css`
  - 준비 중 버튼에 짧은 에너지 스윕 애니메이션과 `RAPID 3D` 보조 라벨을 적용했다.
  - `prefers-reduced-motion`에서는 애니메이션을 끈다.

## 검증

- 브라우저: 트랙 선택 → 레이스 진입 성공
- 진입 후 확인: `LIVE / 하버 링`, `RACE LIVE`, `SECTOR 01 / 03`, `LAP 1/3`
- 콘솔 오류: 0
- CC0 에셋: 201 files / 7.5 MB
- 차량 에셋: 10 catalog entries, wheels 4~5개 및 정규화 데이터 확인
- 진행도: 5 finishes / 4 wins / 430 gold / 10 cars unlocked
- 빌드: 성공
- 빌드 참고: Rapier 물리 청크가 700 kB 경고 기준을 넘는 경고만 남아 있으며 실행 오류는 없다.

## 다음 품질 게이트

1. 실제 저속 네트워크에서 `WARMING PHYSICS`가 충분히 읽히는지 확인
2. 모바일 세로 화면에서 트랙 선택 버튼의 터치 영역 재확인
3. Rapier 청크를 초기 로딩에서 더 분리할 필요가 있는지 번들 분석으로 판단
