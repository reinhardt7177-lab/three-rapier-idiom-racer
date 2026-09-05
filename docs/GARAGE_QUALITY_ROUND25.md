# Garage quality round 25 — vehicle identity lighting

이번 라운드는 차량의 원본 텍스처를 바꾸지 않고도 차고와 레이스에서 선택 차량을 즉시 구분할 수 있게 하는 시각 패스다.

## 적용 내용

- `src/racing-runtime.js`
  - 차량 정규화 후 모델 아래에 accent 언더글로우를 추가했다.
  - 언더글로우는 정규화된 차체 폭·길이를 기준으로 생성되어 차량별 크기 차이를 따라간다.
  - `MeshBasicMaterial` + additive blending으로 텍스처 색을 덮지 않고 바닥 반사만 강화한다.
  - 차고 idle pulse와 함께 opacity를 미세하게 호흡시켜 정차 상태에서도 쇼룸 생동감을 유지한다.
  - 플레이어와 AI 차량 모두 같은 방식으로 적용되어 레이스 중에도 차량 식별성이 유지된다.

## 확인 결과

- APEX GT: 레드 accent 스테이지 반사
- VOLT X: 시안 accent 스테이지 반사
- 차고 → 트랙 선택 → 레이스 진입 정상
- `RACE LIVE 001`, `SECTOR 01 / 03`, `LAP 1/3` 확인
- 브라우저 오류·경고 없음
- 데스크톱 viewport overflow 없음
- 프로덕션 빌드 성공 (Rapier 청크 용량 경고만 존재)
- CC0 에셋 201개 / 차량 카탈로그 10개 / 진행도 검사 통과
