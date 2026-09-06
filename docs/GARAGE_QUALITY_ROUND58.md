# Garage quality round 58 — 모바일 쇼룸 노출 패스

작은 화면에서 차가 UI 패널에 묻히지 않도록 차고의 유리 패널과 배경 대비를 다시 조정했다.

- 모바일 차고 배경에 차량 위치를 읽을 수 있는 accent radial light를 추가했다.
- 프로필·선택 차량·최근 기록 패널을 반투명 glass surface로 바꿔 3D 차체 실루엣을 유지했다.
- 하단 차량 컬렉션 dock도 blur/투명 계층으로 낮춰 차고 바닥과 조명 반사를 살렸다.
- 서비스 비콘의 렌즈·로터·광원 크기를 줄여 작은 화면에서 과도한 bloom으로 번지는 현상을 완화했다.
- Three.js 최신 shadow 경고가 발생하던 `PCFSoftShadowMap` 분기를 제거하고 `PCFShadowMap`으로 통일했다.
- 기존 데스크톱 계층과 접근성 focus 스타일은 유지했다.

## 검증

- Garage quality validation: 30 runtime markers / 7 UI markers / 9 curated assets
- Physics validation: 13 Rapier/vehicle/AI markers
- Circuit quality validation: 11 circuit markers
- Vite production build passed
