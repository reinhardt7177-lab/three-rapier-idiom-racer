# Garage quality round 36 — live stat fidelity

차고 후면 `LIVE TELEMETRY`가 장식용 숫자가 아니라 선택 차량의 실제 스탯을 반영하도록 연결했다.

## 변경점

- `POWER` ← `car.stats.acceleration`
- `GRIP` ← `car.stats.grip`
- `SPEED` ← `car.stats.topSpeed`
- CanvasTexture 상태 바 길이와 숫자를 차량마다 다시 생성
- 차량을 바꾸면 런타임 차고와 UI 스탯이 같은 카탈로그 값을 사용

## 검증

- `npm run check` 전체 통과
- CC0 201개 / 차량 10종 / 진행도 데이터 통과
- 로컬 서버에서 telemetry values와 `car.stats` 연결 확인
