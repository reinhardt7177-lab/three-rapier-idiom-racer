# 차량 마감 최신 버전 Cloudflare 배포 · 2026-10-14

> **최신 정정:** 사용자 Chrome의 공식 주소는 연결 거부가 재현되어 접속 해결 미완료다. 아래 내장 브라우저의 성공을 사용자 Chrome 성공으로 확대할 수 없다. [현재 조사·완료 기준](CHROME_ACCESS_20261014.md)을 따른다.

> **후속 검증 완료:** Wrangler 도메인 연결 재등록 후 공식 주소의 35/35 공개 파일 일치와 실제 브라우저 차고·주행·1인칭·차고 복귀를 확인했다. 아래 ‘공식 주소 접속 미확인’은 최초 배포 당시의 이력이다. 현재 상태와 남은 로컬 CLI DNS 차이는 [후속 보고](DOMAIN_REPAIR_20261014.md)를 따른다.

사용자가 이미지로 요청한 `racing.mumuworld.com` 최신 버전 배포를 실행했다.
기존 Cloudflare Worker를 갱신했으며 main 병합·PR·Vercel 배포는 하지 않았다.
**업로드/활성화는 완료됐지만 이 검증 환경에서 공식 도메인의 접속은 확인하지 못했다.**
동일 Worker의 기본 공개 주소에서 정확한 파일과 실제 게임을 확인했다.

## 배포 결과

| 항목 | 값 |
| --- | --- |
| 배포 소스 | `4359d7dee328e94b6dc2c11d2e278bbaf6167043` |
| 차량 구현 | `8a79d5d` |
| 작업 브랜치 | `codex/korea-circuits-progression-20261011` |
| Worker | `mumu-circuit` / Workers Static Assets |
| 공식 도메인 연결 | `racing.mumuworld.com` custom domain (CLI 배포 결과 확인) |
| 실제 접속 검증 주소 | https://mumu-circuit.reinhardt7177.workers.dev/?track=namak&v=4359d7d |
| 활성 버전 | `156f359b-4940-4d49-9df3-c767bd880d9f` / 100% |
| 활성화 시각 | 2026-10-14 10:36:07 KST |
| 공개 파일 | 35개 / 78,686,994 bytes |
| 실제 업로드 | 변경16개, 기존19개 재사용 |
| 최대 파일 | 남악 GLB / 19,885,452 bytes |

8종 차량 마감·반사 스튜디오·휠 비용 개선과 최근 여수/성삼재 도로 주변 자산을
포함한다. 파일 합계는 모든 코스·차량·음원의 합이며 첫 방문 다운로드 크기가 아니다.
변경 내용은 [차량 보고서](VEHICLE_FINISH_20261013.md), [도로 주변 보고서](ROADSCAPE_20261013.md)를 따른다.

## 재현 가능한 배포본과 보존

작업 폴더를 그대로 배포하지 않고 위 커밋의 tracked 파일을 `git archive`로
`artifacts/cloudflare-car-deploy-20261014/build-source/`에 내보내 새 빌드를 만들었다.
기존 node_modules만 junction으로 공유했다. 별도의 미커밋 남악 건축 레이어,
Blender 원본·검증 자료·비밀키·개발 파일은 공개 `dist`에 넣지 않았다.
사전 검사에서 일반 파일만 허용하고 비밀/원본/개발 경로와 25MiB 초과 파일을 차단했다.
OAuth는 기존 Wrangler 로그인을 사용했으며 인증 파일/토큰을 읽거나 저장소에 넣지 않았다.

이전 428개 전체 검사의 로컬 입력244개가 그대로인지 raw SHA-256으로 확인했다.
배포 커밋과 비교할 때 텍스트 줄바꿈만 정규화했다. 차이는 별도 남악 건축의
미커밋 `assets.js`/`namakVisuals.js` 연결, `namakArchitecture.js`/GLB 및 package 등록이다.
그 밖의 차량·runtime·물리·도로/경로·게임 균형 입력은 일치했다. 로컬 전용
미커밋 authoring/helper/cache 파일은 `preflight.json`에 별도 열거했다.
같은 폴더의 사용자 변경과 별도 남악 작업은 보존했다.

## 이번에 실제 실행한 검증

- 커밋 배포본의 차량/재질/자원/남악·여수·성삼재 시각/도로 주변 **65/65 시험 통과**, 3.71초.
- 새로운 production 빌드 **성공, 3.11초**. 기존 500KB 초과 번들 경고를 유지했다.
- 전체428검사·핵심41레이스246대완주는 직전 차량 검증이다. 이번 배포에서 전체 레이스를 다시 실행한 것으로 세지 않는다.
- Wrangler4.132.0 `deploy --dry-run` 성공. 물리 파일35개와 사전 검사 목록이 일치했다(CLI는 내부 자산 목록39개로 표시).
- 실제 업로드 성공. `deployments list`로 새 활성 버전100%를 확인했다. 계정 작성자 정보는 공개 기록에서 제외했다.
- 기본 Workers 공개 HTTPS의 **35/35 파일 HTTP200·크기·SHA-256 일치**. cache-control/ETag도 기록했다.
- 기본 주소의 네 코스 진입 HTML HTTP200/최신 번들 연결 확인. 없는 GLB는 HTTP404다. `release.json` 소스는4359d7d다.
- 기본 주소를 실제 IAB **1280×720**에서 실행했다. 차고→출발→native 키보드W3.5초 가속(표시90km/h)→입력 해제 후 감속/정지→1인칭→Esc메뉴→메뉴 중W입력→차고 복귀를 확인했다. 콘솔 오류/경고0건.
- 실제 공개 화면은 `public-garage.png`, `public-driving.png`, `public-first-person.png`에 저장했다.

이번 배포에서는 새 네 크기 UI/프레임/전체 완주/온라인 네트워크 측정을 하지 않았다.
그 수치는 차량 보고서의 이전 로컬 검사와 구분한다. 실물 휴대폰 검증은 아니다.

## 접속 확인의 제한

공식 도메인 HTTPS 검사와 IAB 열기는 연결 거부였다. 이 환경의 Windows DNS에서
`racing.mumuworld.com`이 **127.0.0.1**로 나왔다. 명시적으로1.1.1.1을 지정한
read-only 질의도 같은 값을 반환했다. hosts 파일에서 해당 이름의 항목은 찾지 못했다.
Cloudflare/Google DoH도 이 환경에서 연결 실패여서 독립적인 공개 DNS 확인 근거가 없다.
따라서 원인이 PC/DNS/검증 환경 중 어디인지, 다른 기기에서도 공식 주소가 실패하는지는
확정하지 않는다. 도메인 정상 접속 완료로 보고하지 않는다.

hosts·OS DNS·인증서 검증·네트워크 보호 설정은 변경하지 않았다. 공식 도메인
연결은 기존 설정으로 CLI에서 갱신됐고, 기본 Workers 주소는 정상 동작했다.
공식 주소가 열리지 않으면 위 실제 검증 주소로 게임을 테스트할 수 있다.
두 호스트는 브라우저 진행 기록을 공유하지 않으며 기존 기록을 삭제하지 않았다.

가장 중요한 다음 확인은 **다른 기기/통신망에서 공식 주소의 DNS와 실제 접속**이다.
공식 주소가 계속127.0.0.1이면 Cloudflare DNS 화면에서 해당 레코드/Worker custom-domain
상태를 직접 확인해야 한다. 높은 품질 p9533.3ms와 기존1024차고의 메달표시1px
상자 겹침은 이전 차량 보고서의 알려진 한계로 남아 있다.

## 실패와 수정

첫 배포용 archive는 두 도로 주변 시험의 golden fixture를 빠뜨려 51통과/2실패였다.
커밋의 해당 fixture를 추가한 뒤 **같은 시험65/65**가 통과했다. 첫 사전 해시 검사는
비공개 authoring/cache 파일과 collider/calibration 검사 fixture까지 포함하는 원래
목록을 전부 앱 입력으로 취급해 실패했다. tracked 검사 fixture를 복원하고
미커밋 비제품 파일을 별도 분류했으며, src/public의 예상 밖 차이는 계속 차단했다.
실패 로그·공식 주소 연결 실패는 보존한다. 시험 단언/예산/레이스 기준은 바꾸지 않았다.

원자료: `artifacts/cloudflare-car-deploy-20261014/`의 `start.json`, `source-snapshot.json`,
`packing-corrections.json`, `focused-tests*.log`, `build.log`, `preflight.json`, `dry-run.log`,
`deploy.log`, `deployment-status.log`, `public-assets*.json`, `worker-check.log`, `dns.json`,
`browser-smoke.json`, `browser-logs.json`.
