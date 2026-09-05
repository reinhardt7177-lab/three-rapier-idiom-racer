# Garage quality round 31 — normalized contact shadow

차량마다 다른 차체 비율이 쇼룸 접지감에 반영되도록 contact shadow 크기를 차량 정규화 데이터와 연결했다.

## 변경점

- `normalizedSize.x` 기준으로 shadow 폭 자동 조정
- `normalizedSize.z` 기준으로 shadow 길이 자동 조정
- 카트·세단·SUV·트럭처럼 차체 비율이 달라도 공통 무대에서 자연스러운 무게감 유지
- 기존 accent 언더글로우와 shadow를 별도 레이어로 유지해 빛과 접지의 역할을 분리

## 검증

- `npm run check` 전체 통과
- 차량 10종 정규화 검사 통과
- CC0 201개 및 진행도 검사 통과
