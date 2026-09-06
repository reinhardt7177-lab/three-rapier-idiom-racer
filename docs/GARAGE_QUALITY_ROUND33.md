# Garage quality round 33 — camera intent labels

쇼룸 카메라 버튼이 각도 이름만 보여 주는 대신, 버튼을 눌렀을 때 어떤 확인 목적을 제공하는지 함께 표시하도록 보정했다.

## 변경점

- `FRONT` → `SILHOUETTE / FRONT`
- `ORBIT` → `HERO / ORBIT`
- `SERVICE` → `INSPECTION / SERVICE`
- 활성 모드 라벨은 차량 accent 색으로 표시
- 기존 `aria-pressed` 상태와 카메라 transition은 그대로 유지

## 검증

- `npm run check` 전체 통과
- 로컬 서버에서 camera intent label·motes·focus style 서빙 확인
