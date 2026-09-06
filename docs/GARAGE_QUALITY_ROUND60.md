# Garage quality round 60 — 라이브 계기판 신호 패스

차고의 차량 스펙이 정적인 막대처럼 보이지 않도록 쇼룸 계기판의 신호감을 보강했다.

- POWER / GRIP / TOP SPEED 막대에 아주 작은 brightness·scale pulse를 추가했다.
- READY TO RUN 상태등을 기존 레이스 상태등과 같은 호흡으로 연결했다.
- `prefers-reduced-motion`에서는 두 애니메이션을 모두 정지한다.
- 수치와 차체를 먼저 읽는 정보 계층은 유지하고, 장식 애니메이션은 낮은 진폭으로 제한했다.

## 검증

- Garage quality validation: 30 runtime markers / 9 UI markers / 9 curated assets
- Circuit quality validation: 21 circuit markers
- Physics validation: 13 Rapier/vehicle/AI markers
- Vite production build passed
