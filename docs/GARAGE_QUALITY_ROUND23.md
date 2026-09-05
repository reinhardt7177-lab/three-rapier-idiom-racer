# Garage quality round 23 — vehicle handoff and responsive guardrails

이번 라운드는 차량을 바꿀 때의 화면 전환과 차고 정보 계층을 마무리했다.

## 적용 내용

- `src/App.jsx`
  - 차량 선택 시 짧은 screen wipe를 실행해 이전 차량의 렌더 트리와 새 차량의 showroom 진입이 끊겨 보이지 않도록 했다.
  - 전환 타이머를 별도로 관리해 차고→트랙 화면 전환 타이머와 충돌하지 않게 했다.
- `src/garage-theme.css`
  - 차량 accent를 screen wipe 색상에 연결해 차량 선택 색상과 UI 전환이 일관되게 보인다.
- 차고 패널·도크·최근 기록의 z-index를 명시해 telemetry가 하단 도크에 가려지지 않도록 했다.
- 760px 이하에서 배지·패널 그림자·도크 패딩을 줄여 좁은 화면의 정보 밀도를 낮췄다.
- 400px 이하 레이스 컨트롤의 버튼 폭과 간격을 줄여 390×844에서 오른쪽 24px overflow를 제거했다.

## 확인

- 차량 선택: APEX GT ↔ VOLT X 전환 후 선택 상태·차량명·accent 패널 동기화
- 차고 카메라: FRONT / ORBIT / SERVICE
- 차고→트랙→레이스: 정상 진입, `RACE LIVE`, `SECTOR 01 / 03`, `LAP 1/3`
- 모바일 390×844: 차고·트랙 선택·레이스 모두 overflow 없음, 레이스 컨트롤 전체가 viewport 안에 위치
- 브라우저 로그: Vite/React 안내 로그 외 오류 없음

## 다음 품질 게이트

- 실제 390px 디바이스에서 터치 타깃과 세로 스크롤 여부 확인
- 저속 환경에서 차량 전환 wipe와 `BOOTING CIRCUIT`가 과하게 겹치지 않는지 확인
