# Garage quality round 38 — restrained vehicle accent tint

차량 GLB가 흰색 위주로 보일 때에도 차고에서 선택 차량이 구분되도록 차체 재질에만 약한 accent tint를 적용했다.

## 적용 범위

- 차체·스포일러 등 일반 mesh material만 clone 후 약하게 tint
- wheel / tire / glass / window / light 이름은 제외
- 기존 texture map은 그대로 공유해 원본 에셋 디테일을 유지
- accent 언더글로우·카메라 UI·상태판과 같은 색 체계를 사용

## 검증

- `npm run check` 전체 통과
- 차량 10종 정규화 검사 통과
- 로컬 서버에서 tint·material clone·제외 규칙 서빙 확인
