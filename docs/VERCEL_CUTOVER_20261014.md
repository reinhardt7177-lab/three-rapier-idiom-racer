# 게임 호스팅을 Vercel로 이전 · 2026-10-14

## 결과

사용자 요청에 따라 GitHub 저장소와 기존 Vercel 프로젝트 `mumu-racing`을 유지하고, `racing.mumuworld.com`을 Vercel 운영 배포에 연결했다. 게임용 Cloudflare Worker `mumu-circuit`은 Wrangler의 일반 삭제 명령으로 삭제했다. Cloudflare는 해당 주소의 DNS만 담당한다.

| 항목 | 현재 값 |
| --- | --- |
| 공식 게임 | https://racing.mumuworld.com/ |
| 코드 저장소 | https://github.com/reinhardt7177-lab/three-rapier-idiom-racer |
| 작업 브랜치 | `codex/korea-circuits-progression-20261011` |
| Vercel 프로젝트 | `mumu-racing` |
| 운영 배포 | `dpl_7W4e1KMBeYcMChDVETFnYpZ1Mubf` · Ready · 15초 |
| 배포 커밋 | `1ef0c2472a871552331e7792e5a6e8033c99e9a4` |
| 게임 변경 기준 | `4359d7d` · 차량 `8a79d5d` · 도로 주변 `437b2c2` |
| DNS | CNAME `racing` → `ae78a070341de006.vercel-dns-016.com` |
| 프록시 / TTL | DNS only / Auto, 공개 조회 TTL 300초 |
| Vercel 인증 | Valid Configuration / Production |

Vercel 대시보드가 실제 표시한 프로젝트별 CNAME을 사용했다. 도메인 이동은 리다이렉트가 아니므로 게임 주소는 `racing.mumuworld.com`을 유지한다. HTTPS 공개 요청과 실제 Chrome 게임 로딩을 확인했으며 인증서 상세 만료일 검사는 별도로 실행하지 않았다.

## 변경 범위와 보존

1. 기존 기본 Workers 주소를 `workers_dev:false`로 먼저 비활성화했다. 공개 HTTP 404를 확인했다.
2. GitHub의 정확한 커밋으로 Vercel Preview를 새로 만들고, 사용자 승인을 받은 운영 승격으로 Production을 재빌드했다. main 병합과 PR은 없다.
3. Vercel에 공식 도메인을 등록하고 기존 Worker의 해당 도메인만 해제했다. 다른 서비스 의존 수는 모두 0이었다.
4. Cloudflare DNS에 공식 CNAME 한 개를 등록했다. 계정·상위 도메인·다른 앱 레코드는 변경하지 않았다.
5. 공식 게임과 공개 파일을 확인한 뒤 Wrangler `delete mumu-circuit`을 실행했다. `--force`는 사용하지 않았다. 성공 메시지와 Worker 도메인 목록 0개를 확인했다.
6. 실수로 Worker를 재생성하거나 공식 주소를 다시 가져가지 않도록 루트 `wrangler.jsonc`를 제거했다. 변경 전 사본은 `artifacts/vercel-cutover-20261014/before/`에 남겼다.
7. README의 대표 주소와 저장소 홈페이지를 공식 주소로 정리했다. 기존 GitHub Pages의 이전 빌드와 Vercel 배포 이력은 유지한다.

게임 소스·Blender 원본·비밀키·다른 편집자의 미커밋 남악 작업은 삭제하거나 반영하지 않았다. 최신 전체 게임 검사 428개 통과 기록을 재사용했다. 이번에는 게임 코드를 바꾸지 않았으므로 장시간 전체 레이스를 다시 실행했다고 주장하지 않는다.

## 실제 검증

| 검증 | 결과 |
| --- | --- |
| 공개 정적 파일 | 34/34 HTTP 200 · 바이트와 SHA-256 일치 |
| 전체 정적 파일 용량 | 78,686,282B (첫 로딩 전송량이 아닌 배포 전체 크기) |
| 코스 진입 HTML | 해안·남악·여수·성삼재 모두 200, 같은 최신 JS 진입점 |
| 존재하지 않는 모델 | 404 |
| 이전 기본 Worker URL | 404 |
| 공개 DNS | Cloudflare·Google 모두 위 CNAME과 Vercel IP 반환 |
| 실제 사용자 Chrome | 공식 주소 남악 차고 → 레이스 시작 → 키보드 가속 67km/h → 1인칭 → 메뉴 → 차고 복귀 |
| 일시정지 입력 | `W` 700ms 중 레이스 31.08초·표시 속도 45km/h·남은 거리 2.79km 그대로 |
| 실행 콘솔 | 오류 0 · 셰이더 정밀도 경고 1 |
| Worker 삭제 이후 | 공식 주소 새로고침 후 차량·남악 차고 로딩 재확인 |

공개 파일 검증은 임시 Wrangler 원격 preview에서 공개 Vercel 주소에 요청했다. 영구 진단 서비스·공개 route는 만들지 않았고 실행 종료 시 해당 로컬 proxy 프로세스를 종료했다. 게임 검수는 사용자 Chrome에서 했다. 다른 기기/통신망의 온라인 1:1과 휴대폰 실기기 검증은 이번에 실행하지 않았다.

## 실패·차이와 처리

- Vercel CLI `whoami`/프로젝트 조회가 버전 배너만 표시하고 종료했다. 인증 파일이나 토큰을 읽지 않고 정상 로그인한 Vercel 대시보드로 배포했다.
- 운영 승격 UI는 Lint·TypeCheck 승격 요구사항 우회를 표시했다. 사용자에게 정확한 커밋과 사유를 알린 후 **이 빌드의 운영 승격 허용** 응답을 받고 실행했다. 기존 전체 검사 통과와 Vercel의 두 요구사항 연결은 별개다.
- Worker 기본 상태 API helper가 TypeError로 실패했다. CLI triggers 성공과 공개 URL 404로 비활성화를 검증했다.
- 도메인 해제 helper는 DELETE 이후 APIError를 반환했다. 삭제를 반복하지 않고 Cloudflare DNS에서 해당 Worker 레코드가 사라진 것을 확인했다. 이후 독립 Wrangler 조회에서 Worker 도메인 목록 0개를 확인했다. 실패 자료는 보존했다.
- Windows 터미널의 공식 hostname 조회는 아직 `127.0.0.1`이고 HTTP 연결 거부였다. 해당 실패 34개 표본을 보존했다. 사용자 Chrome과 외부 공개 DNS·HTTPS 결과와 구분하며 OS/조직 정책이 원인이라고 확정하지 않았다. 시스템 DNS·hosts·보안 설정은 바꾸지 않았다.
- 최초 Windows 배포 파일과의 정확한 비교는 30/34였다. 나머지 4개는 줄바꿈 차이였다. Draco JS 2개·남악 표식 JSON·HTML에서 Windows CR 바이트 33/116/336/26개를 제거한 내용이 공개 파일의 길이와 SHA-256에 정확히 일치했다. HTML은 기존 빌드에 `\r\r\n`이 한 곳 있어 첫 CRLF-only 비교도 실패했다. 최초 자료와 분석을 보존한 뒤 LF 빌드 기준으로 34/34를 다시 검증했다. 모델·게임 JS/CSS·경로 파일은 변경되지 않았다.
- 수동 Cloudflare 배포에만 추가했던 `release.json` 201B는 Git 기반 Vercel 빌드에 없으며 404다. 이를 게임 누락으로 감추거나 35개 통과라고 보고하지 않는다.
- 주행 검사 중 브라우저 응답 지연 1회가 있었다. 상태를 다시 읽어 1인칭·일시정지·복귀 결과를 확인했다.

## 근거 파일

모두 `artifacts/vercel-cutover-20261014/` 아래에 있다.

- `before/` : README·NEXT_STEPS·Wrangler·Vercel 설정 사본
- `dns-before.png`, `dns-after.png`, `vercel-domain-valid.png` : 연결 변경 전후
- `official-chrome-garage.png`, `official-chrome-paused.png` : 실제 Chrome 게임 화면
- `public-verification.json` : OS DNS/터미널 실패 포함 전체 표본
- `remote-public-assets-first.json`, `eol-analysis-first.json` : 최초 불일치와 첫 분석 실패
- `eol-analysis.json`, `remote-public-assets.json` : 정확한 LF 일치와 재검증
- `domain-before-detach.json`, `domain-detach-error.json`, `worker-delete.json`, `inspect-deleted.json` : 해제·삭제·확인
- `disable-default.log` : 기본 주소 비활성화

이전 Worker의 35개 파일 복구 사본은 `artifacts/cloudflare-recreate-20261014/backup-dist/`에 보존한다. 원격 호스팅 삭제를 로컬 사용자 자료 삭제로 확대하지 않았다.

## 다음 우선순위

1. 사용자가 공식 주소에서 실제 운전과 두 기기 온라인 1:1을 확인한다.
2. 다음 배포 전에 Vercel의 Lint·TypeCheck 승격 요구사항을 프로젝트 검사와 연결할지 정한다. 브랜치 자동 배포 비활성 설정은 유지했으므로 운영 갱신은 명시적인 수동 배포로 한다.
3. 터미널 자동 배포 검사를 위해 이 PC의 `127.0.0.1` DNS 응답 출처를 관리자가 확인한다. 현재 사용자 Chrome 공식 게임 접속은 성공했다.

참고: [Vercel 도메인 연결](https://vercel.com/docs/domains/working-with-domains/add-a-domain) · [Cloudflare DNS 레코드 관리](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/).
