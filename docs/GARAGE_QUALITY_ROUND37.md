# Garage quality round 37 — physical stat bars

차고 후면 telemetry panel의 3D 막대도 차량 데이터의 실제 비율을 반영하도록 마무리했다.

## 변경점

- 각 3D 바에 POWER·GRIP·SPEED 기준값을 저장
- 바의 기본 길이를 `telemetryValues / 80`으로 정규화
- idle pulse는 기준 길이 주변에서만 미세하게 변하도록 제한
- CanvasTexture의 숫자·2D 바·3D 바가 동일한 카탈로그 값에서 생성

## 검증

- `npm run check` 전체 통과
- CC0 201개 / 차량 10종 / 진행도 데이터 통과
- 로컬 서버에서 `bar.userData.base`와 pulse 로직 서빙 확인
