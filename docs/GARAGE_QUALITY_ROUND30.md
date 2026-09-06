# Garage quality round 30 — vehicle contact shadow

쇼룸 차량이 무대 위에 떠 보이지 않도록 accent 언더글로우와 별도의 contact shadow를 분리했다.

## 구현

- 차량 중심에 부드러운 타원형 흑색 radial shadow 추가
- reflection은 additive highlight, contact shadow는 depth grounding 역할로 분리
- idle pulse에 맞춰 shadow opacity와 크기를 아주 작게 변화
- 차종별 정규화 크기와 관계없이 공통 무대 기준으로 안정적인 접지감 유지

## 검증

- `npm run check` 전체 통과
- CC0 201개 / 차량 10종 / 진행도 데이터 통과
- Rapier 청크 용량 경고 외 빌드 오류 없음
