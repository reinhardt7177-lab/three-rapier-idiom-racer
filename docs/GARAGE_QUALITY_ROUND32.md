# Garage quality round 32 — ambient light motes

차고의 조명이 단순히 밝은 오브젝트로만 보이지 않도록, 천장과 상태판 주변에 저비용 ambient motes를 추가했다.

## 구현

- 72개의 저밀도 additive point mote를 차고 영역에만 배치
- 차량 accent 색으로 tint해 쇼룸의 색 체계와 연결
- idle 루프에서 아주 느린 회전·opacity·size 변화를 적용
- 레이스 트랙과 충분히 떨어진 차고 좌표계에 생성해 레이스 렌더 비용과 시야를 분리

## 검증

- `npm run check` 전체 통과
- CC0 201개 / 차량 10종 / 진행도 데이터 통과
- Rapier 청크 용량 경고 외 빌드 오류 없음
