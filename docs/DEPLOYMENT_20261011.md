# MUMU CIRCUIT 정식 배포 · 2026-10-11

## 결과와 공개 주소

- 사용자 최신 요청: “깃허브에 올리고 배포해주세요”. 이전 배포 금지 범위는 이 요청에 따라 이번 배포에 한해 변경했다.
- 게임: https://mumu-racing.vercel.app/
- GitHub: https://github.com/reinhardt7177-lab/three-rapier-idiom-racer/tree/codex/korea-circuits-progression-20261011
- 배포 소스: `18ec2d3c41ec04e0e923c5196d5c49670e98972a`.
- Vercel Production: `dpl_5n6oB5aj9TSQKrj3MMErzhS2XyF2`, 2026-10-11 16:52 KST 생성, Ready 확인, 대시보드 빌드 약12초.
- main 직접 커밋, PR 생성·병합은 하지 않았다. 기존 GitHub 연동 Preview를 일반 Redeploy → Production으로 다시 빌드했다.
- 배포 범위는 현재 웹 빌드다. 비밀키·사용자 자료·미사용 원본 MP4를 새로 공개하지 않았다.

## 실제 실행한 검증

1. 현재 소스139개의 SHA-256을 기존 전체 회귀 통과 입력 목록과 비교했다. 불일치0.
2. 해당 입력의 기존 `npm run check`: 실제 Colab CPU257시험, 실패0, 전체200.503초. 동일 입력이므로 무거운 전체 검사를 반복하지 않았다. 근거: `artifacts/ghost-pass-20261011/full-check-result.json`, `hash-verification.json`.
3. 이번 로컬 `npm run build` 성공. Vite 기록1분24초. 빌드 로그: `artifacts/deploy-20261011/build.log`. 총 정적 파일31개, 64,691,034바이트. 큰 Three/Rapier 청크 경고는 남아 있다.
4. 정식 주소의 여수 코스를 브라우저로 열어 차고 로딩 → 싱글 레이스 → 플레이어1+AI5 → W1.5초 가속 → 키 해제 → 메뉴 → 차고 복귀를 실제 확인했다. 가속 후44km/h, 해제 후 throttle/brake/reverse/steer0, AI5대 모두 도로 접촉4, 관측한 콘솔 error0.
5. 화면·원자료: `artifacts/deploy-20261011/yeosu-live.png`, `yeosu-live.json`, `vercel-production.png`. 저장한 여수 주행240프레임 창은 평균33.403ms/p9533.5ms/최대66.8ms/>50ms1이었다. 전체559개 구간에서는233.5ms를 포함한 지연2건을 보존했다. 고정 조건 성능 비교나 지연 해결 증거로 쓰지 않는다.
6. 여수 초기 요청19개: 인코딩4,609,544바이트, 전송4,615,244바이트. 이후 BGM 스트리밍 전체 용량과 다른 코스는 이 수치에 포함하지 않는다.
7. 공개 주소의 해안·남악·여수·성삼재 GLB와 새 코스 경로JSON에 HTTP HEAD를 실행해6개 모두200 응답을 확인했다. 근거: `artifacts/deploy-20261011/assets-http.json`. HEAD 응답에는 Content-Length가 없어 서버 파일 용량이 일치한다고 주장하지 않는다.

## 실패와 처리

- npm 캐시 잠금 `ECOMPROMISED`와 설치된 Vercel CLI의 Windows 프로세스 종료가 발생했다. 비밀 설정을 읽거나 출력하지 않고, 이미 로그인된 Vercel 대시보드로 배포했다.
- 기존 Preview의 Force Promote는 Lint/TypeCheck 승격 요건 우회 안내가 있어 취소했다. 일반 Production 재배포가 Ready로 완료됐다. Lint/TypeCheck가 별도로 실행되어 통과했다고 주장하지 않는다.
- 변경 전 README/NEXT_STEPS 사본을 `artifacts/deploy-20261011/`에 남겼다. 편집 전 tracked 작업 폴더가 깨끗하고 두 파일의 수정 시각이 이전 작업 기록과 일치함을 확인했다.

## 남은 문제와 다음 작업

- 배포는 현재 검증본 공개다. 남악 프레임 지연, 추가 여수·성삼재 Blender 그래픽 고도화, 해금·라이벌 개성·추가 시간대는 완료하지 않았다.
- 맵별 Gemini 음악4곡은 로컬 생성본이며 아직 현재 게임에 연결되지 않았다. 배포 게임에서는 기존 선택곡2개가 재생된다.
- 이번 배포 확인에서 새 전체 코스 완주와 네 화면 크기 검수를 반복하지 않았다. 이전 동일 입력에서 확인한 검증과 이번 공개 주소의 단기 주행을 구분한다. 휴대폰 실기기 검증은 하지 않았다.
- 기능 개발 중단 조건과 자동 작업6의 PAUSED 상태를 유지한다. 다음으로 중요한 작업은 사용자 결정 후 남악 성능 병목 조사 재개 여부를 정하는 것이다.
