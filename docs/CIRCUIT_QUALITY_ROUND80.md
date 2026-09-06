# Circuit quality round 80

이번 라운드는 서킷이 단순한 도로가 아니라 실제 레이스 시설로 읽히도록 피트 레인을 보강했다.

- `buildPitLaneBoxes()`가 BOX 01~07 바닥, 조명 라인, PIT CONTROL 벽을 생성한다.
- 기존 연석·가드레일·섹터 게이트·PIT ENTRY·스타트 그리드와 연결해 피트 동선을 만든다.
- 모바일에서는 주변 나무를 155개에서 92개로 줄이고 그림자 계산을 꺼서 반복 오브젝트 비용을 낮춘다.
- `check-circuit-quality.mjs`에 피트 박스와 모바일 수량 검증 마커를 추가했다.

검증: `npm run check` 통과.
