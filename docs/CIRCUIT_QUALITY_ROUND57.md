# Circuit quality round 57 — 경기장 구조 패스

이번 라운드는 차량 외형보다 실제 주행 서킷의 읽힘과 경기장 밀도를 우선했다.

- 코너 외곽에 Rapier 충돌선과 같은 기준(`ROAD_HALF + 1.38`)의 안전 레일을 추가했다.
- 레일에 상·하단 반사 스트립과 간격 포스트를 넣어 야간/석양 테마 모두 코스 경계를 읽을 수 있게 했다.
- 각 트랙의 주요 코너 안쪽에 3단 에이펙스 커브와 마커를 추가했다.
- 기존 중간 스플릿 게이트에 더해 `SECTOR 01`, `SECTOR 03` 게이트를 구성해 한 바퀴의 구간감이 생겼다.
- 마지막 코너 밖에 `PIT ENTRY` 안내 화살표와 라벨을 추가했다.
- 기존 Kenney 배리어·표지판·조명 프롭 배치는 유지하고, 즉시 생성되는 구조물로 로딩 전에도 경기장 실루엣이 보이도록 했다.

## 검증

- Circuit quality validation: 11 markers
- Garage quality validation: 29 runtime markers / 6 UI markers / 9 curated assets
- Physics validation: 13 Rapier/vehicle/AI markers
- CC0 asset validation: 201 files / 7.5 MB
- Vehicle asset validation: 10 catalog entries
- Progression validation: 5 finishes / 4 wins / 430 gold / 10 cars unlocked
- Vite production build passed

빌드 경고는 기존 Rapier 청크 크기(압축 전 약 2.86 MB) 안내만 남아 있다.
