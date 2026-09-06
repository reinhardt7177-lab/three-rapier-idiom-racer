# Garage quality round 28 — live telemetry wall

차고의 배경 시설이 단순 장식으로만 읽히지 않도록, 선택 차량에 맞는 3D 상태판을 후면 서비스 벽에 추가했다.

## 구현

- `LIVE TELEMETRY / BAY 01 / <machine>` CanvasTexture 스크린
- POWER·GRIP·SPEED 라벨과 3개 하단 상태 바
- 상단 red / yellow / cyan 상태 램프
- 차량 accent에 따라 상태판 프레임, 바, 램프 색을 자동 연결
- 쇼룸 idle 루프에서 바 길이·emissive·상태 램프를 서로 다른 위상으로 미세 애니메이션

중앙 차량과 기존 HUD의 정보를 중복 표시하되, 무대 안의 물리적 시설물로 표현해 차고가 실제 모터스포츠 팀의 점검 공간처럼 보이도록 했다.

## 검증

- `npm run check` 전체 통과(에셋·차량·진행도·Vite 빌드)
- CC0 201개 / 차량 10종 / 진행도 검사 통과
- `http://localhost:5173/src/racing-runtime.js`에서 telemetry panel·animation·urban props 서빙 확인
