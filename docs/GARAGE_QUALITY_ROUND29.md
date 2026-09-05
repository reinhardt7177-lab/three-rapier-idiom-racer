# Garage quality round 29 — service inspection lighting

쇼룸 카메라의 `SERVICE` 모드가 단순히 각도만 바꾸는 상태에서 실제 차량 점검 모드로 느껴지도록 조명 상태를 분리했다.

## 변경점

- SERVICE 모드에서 차량 fill light와 pit light를 증폭
- 서비스 스캔 바의 opacity와 emissive를 높여 차체 검사 라인을 명확하게 표시
- FRONT 모드에서는 key light를 조금 더 올려 차체 실루엣과 전면 형태를 우선
- ORBIT 모드는 기존 균형 조명을 유지
- 카메라 전환은 기존 transition easing을 그대로 사용해 조명 변화가 튀지 않도록 처리

## 검증

- `npm run check` 통과
- 201개 CC0 에셋, 차량 10종, 진행도 데이터 통과
- 로컬 Vite 서버에서 `serviceMode`, `carFill`, `garageTelemetryPanel` 코드 서빙 확인
