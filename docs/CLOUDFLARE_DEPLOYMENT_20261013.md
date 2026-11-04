# MUMU CIRCUIT Cloudflare 배포 · 2026-10-13

최신 네 맵 그래픽 버전을 **https://racing.mumuworld.com/** 에 공개했다. 사용자가 Cloudflare와 `mumuworld.com` 서브도메인 배포를 요청했고, `racing.mumuworld.com`을 선택했다.

## 배포 대상과 결과

| 항목 | 실제 값 |
| --- | --- |
| 호스팅 | Cloudflare Workers Static Assets |
| Worker 이름 | `mumu-circuit` |
| 공식 주소 | https://racing.mumuworld.com/ |
| 기본 호스트 | https://mumu-circuit.reinhardt7177.workers.dev/ |
| 게임 소스 | `c6c5a19a78e64e12f3505596b1d37702686906d6` (그래픽 구현 `d5e0691`) |
| 작업 브랜치 | `codex/korea-circuits-progression-20261011` |
| Cloudflare 버전 | `363659e7-b291-4616-96f8-3cae31966db2` |
| 배포 시각 | 2026-10-13 12:47:19 KST |
| 공개 파일 | 33개, 71,675,855 bytes (모든 코스·차량·음원을 합한 크기) |
| 가장 큰 파일 | 남악 GLB 19,885,452 bytes |

`wrangler.jsonc`가 `dist`만 업로드하도록 설정했다. 실제 모델·음원·JavaScript·CSS와 공개 버전 표식 `release.json`을 배포했으며, 개발 증거·Blender 원본·비밀키는 업로드 대상에 없다. Cloudflare 로그인은 기존 Wrangler OAuth 세션을 사용했다. 인증 파일이나 토큰을 열거나 저장소에 넣지 않았다.

도메인은 Cloudflare 네임서버를 사용하고 있었다. 배포 전 `racing.mumuworld.com`의 DNS 조회는 NXDOMAIN이었고 같은 이름의 Worker도 없었다. Custom Domain 설정으로 해당 서브도메인만 연결했다. 루트 사이트와 다른 서브도메인, 기존 GitHub Pages/Vercel 배포는 건드리지 않았다. main 병합·PR 생성은 없다.

## 이번에 실행한 검증

- 새 `npm run build`: **성공, 3.47초**. 기존 Rapier/Three 번들의 500KB 초과 경고는 남아 있으며 이를 숨기지 않았다.
- 기존 전체 검사 당시의 소스·모델·경로·검증 입력 **224개 SHA-256 일치**. 게임 구현이 바뀌지 않아 391개 전체 회귀를 다시 실행하지 않았다. 그 이전 결과와 이번 배포 검사를 구분한다.
- Wrangler 4.132.0의 `deploy --dry-run`: 성공. 모든 공개 파일이 개별 25MiB 제한 이내다.
- 실제 업로드: **33/33개 성공**, 도메인 연결 성공, 활성 버전 100% 확인.
- 공개 HTTPS에서 **33/33개 HTTP 200 및 크기·SHA-256 일치**. 전체 코스 모델, 차량, 음악, Draco 디코더, 앱 번들이 포함된다. 이는 전체 산출물 다운로드 검증이며 플레이어의 첫 로딩 용량 측정은 아니다.
- `?track=coastal`, `namak`, `yeosu`, `seongsamjae`: 진입 HTML HTTP 200 및 최신 번들 연결 확인. 없는 GLB는 HTTP 404로 응답한다.
- 공개 사이트를 격리된 headless Edge에서 실제 실행: **1280×720, DPR 1, 낮음 품질**, 남악 차고 → 출발 → 키보드 가속 → 메뉴 → 입력 해제 → 차고 복귀 성공. 앱/콘솔 오류 **0**, 실패한 네트워크 요청 **0**.
- HTTPS 요청은 일반 인증서 검증을 사용했고 인증서 검증을 끄지 않았다. 배포 후 DNS의 A 레코드는 Cloudflare 주소로 해석됐다.

원자료는 `artifacts/cloudflare-deploy-20261013/`의 `preflight.json`, `build.log`, `dry-run.log`, `deploy.log`, `public-assets.json`, `browser-smoke.json`에 있다. 공개 화면은 `public-garage.png`, `public-driving.png`에 보존했다. 변경 전 문서·Git 제외 설정과 파일 수정 시각도 같은 폴더에 남겼다.

## 재배포

로그인된 동일 Cloudflare 계정에서 아래 명령을 저장소 루트에서 실행한다. 게임 소스 변경이 있으면 먼저 변경 범위에 맞는 검사와 전체 회귀를 마쳐야 한다.

```powershell
npm run build
npx --yes wrangler@4.132.0 deploy --dry-run
npx --yes wrangler@4.132.0 deploy
```

`dist/release.json`은 이번 배포 증거용 표식이다. 이후 배포에서도 표식을 쓰려면 새 빌드 뒤 해당 시점의 소스 커밋과 빌드 시각으로 다시 생성한다. 이번 `preflight.mjs`는 2026-10-13 검증 입력을 확인하는 고정 증거 스크립트이므로 이후 변경된 게임의 일반 배포 도구로 그대로 사용하지 않는다.

## 남은 확인

이번 공개 브라우저 검사는 짧은 실제 실행 검사다. 네 코스의 전체 완주·성능 회귀는 앞선 그래픽 검증 결과이며 이번 공개 도메인에서 모두 다시 측정한 것은 아니다. 실물 휴대폰, 장시간 운전, 서로 다른 실제 통신망의 온라인 대전은 별도 확인이 필요하다. 기존 건물·산지형의 반복감도 남아 있다.

진행 기록은 브라우저의 사이트별 저장 공간을 사용하므로 기존 Pages/Vercel 기록을 새 도메인으로 자동 이전하지 않았다. 기존 주소의 저장 데이터를 삭제하지 않았다.

## 공식 자료

- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/): 빌드 산출물 디렉터리의 정적 배포·캐싱.
- [Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/): 도메인 연결과 DNS·인증서 자동 설정.
- [Workers 플랫폼 제한](https://developers.cloudflare.com/workers/platform/limits/): 정적 에셋별 크기 제한.
