# Physics regression round 75

시각 연출을 계속 추가해도 차량 주행 기반이 흔들리지 않도록 회귀 게이트를 강화했다.

검사 항목을 다음까지 확장했다.

- 휠 최대 서스펜션 힘
- 역주행용 `reverseForce`
- AI의 체크포인트 최근접 계산
- 플레이어 낙하 시 트랙 리스폰
- 기존 Rapier CCD·브레이크·접지력·드리프트·AI 공통 물리 경로

`node scripts/check-physics.mjs` 결과: 19개 Rapier/차량/AI 마커 통과.
