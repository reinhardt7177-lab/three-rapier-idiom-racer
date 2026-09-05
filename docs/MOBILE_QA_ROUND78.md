# Mobile QA round 78

400px 이하 화면에서 차량 수집 레일이 화면 높이를 밀어내지 않도록 마지막 반응형 규칙을 보강했다.

- 4열 수집 레일은 최대 174px로 제한한다.
- 차량이 많아져도 세로 스크롤로 접근할 수 있다.
- `overscroll-behavior: contain`으로 게임 화면 전체가 함께 튀는 현상을 막는다.
- 기존 조작 버튼과 안전 영역(`env(safe-area-inset-bottom)`) 규칙은 유지한다.
