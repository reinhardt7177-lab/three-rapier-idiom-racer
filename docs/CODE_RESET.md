# 기존 코드 초기화 기록

일자: 2026-09-05  
근거: 사용자 “기존 코드 삭제 ㄱㄱ” 요청.

## 변경

- 기존 src 파일 12개 제거: App.jsx, car-body.js, car-data.js, city-dressing.js, garage-theme.css, main.jsx, race-grid.js, race-theme.css, racing-runtime.js, styles.css, track-data.js, track-theme.css.
- 기존 전용 검사 스크립트 12개 제거: check-assets, check-bundle-budget, check-circuit-quality, check-drive-dynamics, check-flow, check-garage-quality, check-physics, check-progression, check-race-audio, check-start-grid, check-vehicle-assets, check-visual-quality (모두 .mjs).
- main.jsx와 styles.css는 이전 코드와 무관한 재구축 안내 화면으로 새로 작성.
- Vite의 강제 Three.js/Rapier 번들 분할 제거. 필요한 새 코드에서 import할 때만 포함하도록 구성.
- HTML의 없는 favicon 참조와 이전 설명 제거. 확대 제한 해제.
- package.json의 check를 현재 상태에 맞는 빌드 검사로 변경. 새 동역학·게임 테스트는 아직 없다.

## 보존

Git 이력과 기존 미커밋 변경 중 삭제 범위 밖의 파일, docs, public/assets, assets-sources, 라이선스와 원본 에셋, 의존성 및 잠금 파일을 보존한다. 브라우저 저장 데이터는 읽거나 삭제하지 않는다. Git 커밋·push·Vercel 배포는 수행하지 않는다.

기존 dist는 소스가 아니라 생성물이다. 새 빌드로 갱신하며 예전 게임 번들을 실행 기준으로 남기지 않는다. 공개 에셋은 새 빌드에서도 복사될 수 있지만 안내 화면에서 로딩하지 않는다.

## 복구용 백업

- 위치: `D:\racing\backups\legacy-code-20260905-192743.zip`
- 내용: 삭제 직전 src, scripts 및 package.json, package-lock.json, index.html, vite.config.js, README.md, .gitignore.
- 검증: ZIP에 든 30개 파일을 원본과 SHA256으로 비교했고 모두 일치했다.
- 비밀 키, node_modules, Git 디렉터리, 에셋은 이 ZIP에 넣지 않았다.

복구할 때는 ZIP을 별도 임시 폴더에 풀어 비교한 후 필요한 파일만 가져온다. 새로 만든 코드를 덮어쓰는 일괄 복원을 기본 절차로 삼지 않는다. Git에 없던 로컬 코드도 ZIP에 포함되어 있다.

## 현재 기능과 다음 작업

현재는 “재구축 준비 중” 화면뿐이며 주행·차고·차량 선택은 없다. 다음 목표는 RACING_REBUILD_PLAN.md 16절의 **해안 서킷 + 레퍼런스 분위기의 독립 항구 차고**다. 빌드 성공은 신규 게임 구현 또는 시각 검증 완료를 뜻하지 않는다.
