# 모바일 조작 버튼·주행 수정 운영 배포 · 2026-10-22

## 결과

- 사용자 요청으로 GitHub 작업 브랜치에 현재 검증본을 올리고 기존 Vercel `mumu-racing`의 Production을 갱신했다.
- 소스: [`85a34eaff55417b6b7e14ff5133868c5aa851c14`](https://github.com/reinhardt7177-lab/three-rapier-idiom-racer/commit/85a34eaff55417b6b7e14ff5133868c5aa851c14).
- 브랜치: `codex/korea-circuits-progression-20261011`. main 수정·PR·병합은 없다. 브랜치 Git 자동 배포 차단은 유지한다.
- 공식 주소: [racing.mumuworld.com](https://racing.mumuworld.com/?track=yeosu&v=85a34ea).
- 실제 공개 접속·검수를 마친 같은 운영 배포 주소: [mumu-racing.vercel.app](https://mumu-racing.vercel.app/?track=yeosu&v=85a34ea).
- Production 배포: `dpl_5F2n8G8At37aYY3b2dvfZKKaNwYy`, **Ready**, 대시보드 생성 시각 **2026-10-22 12:15:24 KST**, 빌드 약 16초, 도메인 할당 1초.
- 배포 고유 주소: `mumu-racing-hripqrr6y-reinhardt7177-labs-projects.vercel.app`.
- Preview `dpl_5Ct4n7QgyPCQ5PJXVmH6XWkZ41gV`에서 정확한 Git 커밋을 빌드한 뒤, 일반 **Redeploy → Production**으로 같은 소스를 다시 빌드했다. 프로젝트의 도메인·보호·승격 검사 설정은 수정하지 않았다. 대시보드 검사 2개는 Skipped로 표시되며 CI 연결 성공으로 표현하지 않는다.

## 포함한 수정과 검증 범위

- [휴대폰·태블릿 버튼 표시, 혼합 포인터 인식, 저장형 수동 표시](MOBILE_CONTROLS_20261022.md).
- [AI 코너 정체 해소와 실제 solver 접촉에 따른 충돌 반응](AI_IMPACT_POLISH_20261016.md).
- [공유 물리 상태 중복 조회 제거와 출발 준비/포커스 순서 수정](LAG_PERFORMANCE_20261016.md).
- 관련 20/20 시험, 마지막 정책 11/11, 로컬 빌드 성공은 직전 동일 코드 검증이다. 전체 491건의 첫 실행은 484 통과·7건 보고서 파일 열기 오류였고, assertion을 그대로 둔 격리 출력 재검사 7/7이 통과했다. 이번 배포 중 전체 검사를 또 실행했다고 표현하지 않는다.
- 업로드 전 201개 staged 파일/12,073,719B에서 제외 경로·100MiB 초과 파일·고신뢰 비밀키 패턴을 검사했고 발견 0. 임시 `before/` 사본은 로컬 보존했다. 배포에는 정적 빌드만 사용되며 원본·검증 자료는 공개 게임 파일에 들어가지 않는다.

## 공개 배포 검증

### 운영 파일

실제 확인 주소는 **Vercel 기본 운영 주소**다. 아래 수치를 공식 커스텀 도메인에 대한 성공으로 확대하지 않는다.

- 정적 파일 **37/37 HTTP 200**. 전송 본문 합계 **80,113,570B**.
- **35개 바이트·SHA-256 일치**. 코드 JS/CSS·모든 GLB·음원은 이 범주다.
- 남악 지명 JSON은 CRLF/LF 차이만 있다. HTML은 로컬 Vite 출력에 중복된 CR이 있어 첫 정규화 비교가 실패했다. 원본 실패를 보존하고 별도 비교로 **CR을 제외한 모든 문자가 동일**함을 확인했다(로컬 1,946B/CR26, 공개 1,920B/CR0). 설명하지 못한 내용 차이는 없다.
- 네 코스 HTML HTTP 200, 모두 최신 `index-B9pijuSq.js`와 `index-B6XPmKo6.css`를 연결한다. 존재하지 않는 GLB는 404.

### 실제 공개 브라우저

Windows/Codex IAB, **여수 / 낮음 / 보통 / 1랩 / 6대**. 실제 휴대폰을 시험한 것은 아니다.

| 화면 크기 | 버튼 수 | 버튼 크기 | 버튼 중심 클릭 대상 |
| --- | ---: | ---: | --- |
| 1280×720 | 6 | 68px | 6/6 |
| 1024×768 | 6 | 57.6px | 6/6 |
| 844×390 | 6 | 44px | 6/6 |
| 667×375 | 6 | 44px | 6/6 |

- 844×390에서는 **자동 모드**로 6개 버튼 표시를 확인했다. 큰 화면의 터치 스타일 검사는 메뉴의 ‘항상 표시’로 수행했다. 하드웨어 터치 인식을 에뮬레이션한 것으로 세지 않는다.
- 실제 GAS 포인터 누름 1.5초 후 **44km/h**, 놓은 뒤 throttle/brake/reverse/steer 0, handbrake/boost false.
- 차고 → 출발 → 메뉴 → 표시 설정 변경 → 화면 크기 변경/재개 → 차고 복귀를 확인했다. 마지막에 표시 선택은 자동, 그래픽은 원래 높음, 화면 크기 강제 설정은 해제했다. 기존 진행 기록은 지우지 않았다.
- 게임 콘솔 오류 0, 기존 Three.js 셰이더 부동소수점 정밀도 경고 1. 개발용 QA 버튼은 배포에 포함하지 않았다.
- 첫 검수 탭에는 화면 크기 강제 설정이 적용되지 않아 1280×720으로 표시됐다. 실제 DOM 크기를 확인하고, 반응형 설정이 적용되는 기존 탭에서 위 네 크기를 다시 측정했다. 제어 도구 응답 지연과 그래픽 설정 초기 로딩 중 이름 변화도 실제 앱 실패와 구분한다.

## 공식 주소 접속 제한

- Vercel Production에 `racing.mumuworld.com` 할당을 확인했고, Domains에서 새로 검사한 뒤에도 **Valid Configuration / Production**이었다.
- 이 PC의 DNS는 공식 주소를 **127.0.0.1**로 반환한다. Node HTTPS는 `ECONNREFUSED`, IAB는 `ERR_CONNECTION_REFUSED`였으므로 공식 주소에서 실제 게임까지 접속 성공했다고 보고하지 않는다.
- 같은 운영 배포의 `mumu-racing.vercel.app`은 공개 HTTPS·실제 게임 모두 성공했다. 이 두 사실만으로 DNS 문제의 원인이나 다른 기기의 접속 결과를 확정하지 않는다. 외부 Google DNS 조회 도구도 응답 자료를 얻지 못했다.
- OS/브라우저의 조직 관리 DNS, hosts, 인증서·보호 설정은 변경하지 않았다. Cloudflare DNS와 다른 서비스도 건드리지 않았다.
- 다음 확인은 사용자의 **실제 휴대폰/태블릿·다른 통신망에서 공식 주소 접속과 동시 터치**다. 공식 주소가 열리지 않으면 위 같은 배포의 예비 주소로 우선 조작을 확인할 수 있다. 두 호스트의 브라우저 진행 기록은 별도다.

## 증거

- `artifacts/deploy-mobile-20261022/`: preflight, Vercel Production/도메인 DOM, 공식 주소 실패, 기본 운영 주소 37파일, HTML 비교, 실제 브라우저 수치.
- 캡처는 블로그 20장 제한을 유지하려고 `D:/racing/.work/deploy-mobile-20261022/screens/`에 저장했다.
- 이번 보고서의 Git 반영은 문서/검증 자료만 추가하며, 실제 배포한 게임 소스는 위 `85a34ea`다.
