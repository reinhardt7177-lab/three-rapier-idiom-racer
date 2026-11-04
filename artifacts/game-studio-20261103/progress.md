# 현재 실행 기록 · Game Studio 2026-11-03

브랜치 codex/korea-circuits-progression-20261011 / HEAD26fd4d5. 현재 제품 변경은 로컬만이다.

## 결정

- 사용자 새 답변: **안정 물리를 유지하고 표현·입력 검수 마무리**. 저접지 후보 추가 시도 금지.
- 후보 8종56조건/18단언은 목표를 만족했지만 여수easy/clear/traffic6/1lap에서YOU4967m·420초미완주. 기존동일조건YOU312.19초완주. 후보와실패모두보존, physical/action/tuning/race-sim4파일은before바이트동일복구.
- 새 복귀 안전검사는 일반차까지 검사한다. 이는 주행계수 변경이 아니며 사용자가 요청한 전체 점검의 P1 수정이다.

## 구현 완료 / 최종 검증 대기

- 밤 주행 PMREM을 차고용흰반사에서 청색/따뜻한수변광으로 분리. 기존두 render target예산유지.
- 기존64px/16,384B grain으로 노면normal/roughness, 원거리요철fade. 새텍스처/정점/패스없음; 남악외도로픽셀당sample1개증가.
- 밤배기증기색만더어둡게. 양·수명·입자예산/주간·타이어연기는유지.
- 복귀검사에일반차추가, 미래1초진로도기존6mclearance적용.
- 터치DRIFT버튼/포인터소유권, 좌3+빈공간+우4,320/360px은2행44px.
- PitMenu dialog/focus/tabwrap, 온라인disabled fallback/화면회전focus복원.

## 실제 검증

- 신규RED기록: human18실패, visual4실패, wet .65!=.48, nested derivative실패, controls3실패. GREEN18·32·23·15·마지막관련35통과. 기준을낮추지않았다.
- 독립코드리뷰에서 젖은roughness하한과중첩미분2개발견/수정, 좁은UI잘림·메뉴포커스2개발견/수정/재리뷰완료. 출시차단새지적없음.
- DEV 실제남악85.73초6대완주·복귀0·동메달/해금→차고저장확인. fullCPU와동시실행이므로프레임평가자료아님.
- CUA 키보드1.2초W뒤32~33km/h와1인칭전환확인;직후입력표본은이전throttle1이므로즉시해제증거로사용하지않음. 다음정상publish에서입력전부0.
- UI1280/1024/844/667/360/320 가로:7버튼·최소44px·잘림/버튼/속도HUD겹침0. 최초844표본은layoutpause상태여서hit0이고삭제안함. 별도844재검사7/7·활성/입력0.
- 메뉴14Tab모두panel안.390×844세로에서도입력0·paused·menu초점내부. 실제휴대폰/멀티터치검증아님.
- 소스/시험입력229개가validation-final과일치, 공개29자산SHA변경0·물리4파일before일치. blog20검사남음.

## 실행 중 / 다음

- **최종 npm run check**: exec session21894, parentchild7124, 2026-11-03T11:33:50Z시작. root artifacts/game-studio-20261103/npm-check.log/result.json. cwd D:/racing/.work/game-studio-20261103/validation-final. 새코드수정없이완료확인할것.
- 초기잘못된workspace전체실행은22.6초중단, review전전체실행은217.995초중단. wrong-workspace/pre-review log/result로보존. 성공으로쓰지말것.
- root wall-recovery related시험이옛namak-lap출력을덮어썼으나새결과는taskout/namak-recovery-lap.json으로보존하고처음입력hash일치사본으로복원. 테스트최종실행은격리copy에서만한다.
- fullcheck뒤:같은IAB1280×720/낮음/표준/남악·여수/맑음/보통6대의30초DEV제품기준 측정. baseline oldsource DEV5212(아직미시작)와current5211, 같은탭A/B/A. GPUtimer/profile/frozen끄고 CPU검사끝낸뒤실행.
- fourcourse시각검수/정상최종productionpreview(빌드후)·깨끗한화면캡처,량/asset/blogSHA확인,docs보고/NEXT_STEPS업데이트.

## 서버/브라우저

- baselinepreview5210:exec36627(이전안정dist). currentDEV5211:exec86829(root현재소스).
- IAB2, tab5 `studioTab`, viewport변수studioViewport;현재844×390·남악/깨끗한URL·1인칭일시정지. studioFs(노드fs),studioScreens D:/racing/.work/game-studio-20261103/screens.
- 다음컨텍스트CUA는rewriteDocumentation부터. 임시viewport마지막reset.
- screenshot은private.work에만,블로그20장늘리지말것.
# 최종 상태 · 2026-11-03 21:25:49 KST 검사 완료

- 사용자 결정: 안정 물리를 유지하고 표현·입력을 마무리. 새 접지/드리프트 후보는 여수 교통 완주 악화로 보류했고 제품에 적용하지 않았다.
- 최종 npm run check **526/526·실패0·웹 빌드4.54초 통과**, 전체1326.788초. `npm-check-result.json` 참조. 첫 캐시 이름 실패525/526는 `npm-check-cache-failure.*`로 보존했다.
- 핵심41레이스246대 완주·추락/이탈0. 공개29자산·블로그20장·물리4파일 보존, 최종229제품/시험입력 일치.
- 최종 웹 빌드 네 화면 크기7버튼·44px·히트7/7·잘림0·입력0. 키보드48km/h/포인터35km/h·1인칭·벽 접촉→복귀4접지 확인. 실제 휴대폰/두 기기 온라인은 미검증.
- 전후30초 A/B/A와 불안정한 기준본 표본을 모두 보존. 남악p95 33.4ms 동일, 여수 기준 편차로 GPU 개선 원인을 확정 못함. 긴 프레임 해결로 보고하지 않는다.
- 최종37파일80,126,943B(+3,669B), 같은text gzip+816B, 실제 여수 첫20리소스+820B.
- 현재 로컬 미리보기 `http://127.0.0.1:5213/?track=yeosu`, 실행session25060. 비교서버5210/5212/5214와DEV5211은 정리했다. 새 커밋·푸시·PR·main·운영배포 없음.
- 완료 문서 `docs/GAME_STUDIO_REVIEW_20261103.md`, `docs/NEXT_STEPS.md`, 구현 계획의 체크 항목을 갱신했다.

---

아래는 중간 진행 기록이다. 당시 실행 중 상태·다음 단계·서버 핸들은 위 최종 상태로 대체되었다.

