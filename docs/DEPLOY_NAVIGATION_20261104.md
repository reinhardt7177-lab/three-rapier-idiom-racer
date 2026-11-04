# 좌우 안내 수정 GitHub·운영 배포 · 2026-11-04

사용자가 좌우 수정본의 GitHub 업로드와 `racing.mumuworld.com` 배포를 요청했다.

**현재 상태: GitHub 업로드와 Vercel Production 배포 완료. `racing.mumuworld.com`은 Vercel의 Valid Configuration이며, 공식 도메인 서버에서 새37파일·인증서 검증을 통과했다.** 이 PC의 일반 DNS 조회는127.0.0.1이므로 정상 주소를 통한 직접 브라우저 접속은 확인하지 못했다. 실제 게임 화면은 같은 운영 배포의 기본 Vercel 호스트에서 검수했다.

- [공식 게임](https://racing.mumuworld.com/?track=yeosu&v=0e477c6)
- [같은 운영본의 기본 주소](https://mumu-racing.vercel.app/?track=yeosu&v=0e477c6)
- Production `dpl_6qAVo9w56dkjFceDaUAGhuAKP1Lv`, **Ready**, 2026-11-04 **08:58:10 KST**. Duration17초/Build Logs15초/도메인 할당1초. 고유 호스트 `mumu-racing-bg8zryq57-reinhardt7177-labs-projects.vercel.app`.

## 준비한 배포

- [GitHub 앱 코드 0e477c6](https://github.com/reinhardt7177-lab/three-rapier-idiom-racer/commit/0e477c6a6f396a78d05ac791a413278e02064d50)
- 같은 작업 브랜치 `codex/korea-circuits-progression-20261011`에 푸시했다. main 변경·PR 생성·병합은 하지 않았다.
- 변경은 네 코스의 공통 코너 방향 부호와 좌우 SVG다. 철회한 연속 안내·장식 최적화·물리 후보는 포함하지 않았다. 기존 모델·음원·경로·메달·AI·블로그20장은 유지했다.
- [검증/전후 기록](NAVIGATION_FIX_20261104.md)의 전체539/539·41레이스246대 완주 검사와 동일한231입력을 확인했다. 이 배포 중 전체 검사를 다시 돌렸다고 표현하지 않는다.
- 배포 준비 중 방향·기존 안내·기록·터치 관련 **26/26 시험과 재빌드4.35초**를 새로 실행했다. 명령과 시각은 `artifacts/deploy-navigation-20261104/related-build-result.json`에 있다.
- 코드·시험·문서·원본 측정 증거53파일을 선택해 커밋했다. 비밀키 고신뢰 패턴0·100MiB 초과0. 변경 전 사본·미적용 후보·QA helper·기존 무관한 진단은 로컬에 보존하고 업로드하지 않았다.

## Vercel 진행

- 정확한 Git SHA로 Preview `dpl_4RD58mTKtmABLV4S3Z5C6ALMytUW` 생성, **Ready** 확인. 화면 시각2026-11-04 01:05:24 KST, Duration44초, 웹 빌드4.06초였다.
- Preview의 실행 번들 `index-CFdzG8lY.js`가 로컬 최소 수정본 빌드와 같다.
- 일반 **Redeploy → Production**에서 연결 도메인 `mumu-racing.vercel.app`, `racing.mumuworld.com`을 확인하고 실행했다. Force Promote나 보안/승격 요구사항 변경은 하지 않았다.
- Vercel이 인증 앱의6자리 코드 또는 패스키 재인증을 요구해 한 차례 대기했고, 사용자 재개 요청 뒤 새 운영 액션 인증을 다시 요구했다. 사용자가 현재 재인증 창에서 직접 완료한 뒤 동일 소스 Production이 Ready가 됐다. 인증값은 읽거나 저장하지 않았다.
- 기존 `f885332` 운영본이 위의 `0e477c6` 배포로 교체됐다. 브랜치 Git 자동 배포 차단을 유지하고, 일반 Production 재빌드로 진행했다. 별도 승격 요구사항을 우회하거나 성공한 CI 연결이라고 주장하지 않는다.

## 배포 후 실제 검증

- Vercel Project Domains에서 `racing.mumuworld.com`과 `mumu-racing.vercel.app` 모두 **Valid Configuration** 확인. 설정을 수정하지 않았다.
- 이 PC의 기본 조회 및1.1.1.1 지정 조회가127.0.0.1을 반환해 일반 Node/IAB 접속은 연결 거부됐다. Google/Cloudflare DoH도 이 환경에서 연결되지 않았고 원격 웹 조회 도구도 접근하지 못했다. 이 결과만으로 공용 DNS 전체의 상태를 단정하지 않는다.
- 별도 읽기 전용 HTTPS 검사에서 접속 IP만 **같은 Vercel 기본 호스트의 실시간 A주소216.198.79.67**로 지정했다. 공식 호스트명·SNI·TLS 인증서 검증을 유지하고 `--insecure`를 쓰지 않았다. **37/37 HTTP200·TLS 검증0오류,35파일 SHA/바이트 일치+2파일 CRLF/LF 차이만**, 설명되지 않은 내용 차이0. 전체 응답 본문80,127,107B. 시스템 DNS·hosts·조직 정책·Cloudflare 설정은 변경하지 않았다. 이것은 서버 라우팅/HTTPS 확인이며 이 PC의 일반 접속 성공과 다르다.
- 네 코스 HTML 모두200이며 `index-CFdzG8lY.js`/`index-Ub1sNbkv.css`를 연결했다. 존재하지 않는 GLB는404다. 기본 운영 호스트도 새 번들을 제공하는 것을 직접 확인했다.
- 같은 운영 배포의 기본 호스트 IAB에서 여수 **왼쪽 커브/85m**, 해안 **오른쪽 커브/진행 중**의 문구와 명시적 SVG를 실제 화면에서 확인했다. CSS mirror transform은 none이었다.
- 키보드 약38km/h·포인터 약36km/h,1인칭↔3인칭, 복귀4접지, 메뉴·키·포인터 해제 후 입력0, 차고 복귀를 확인했다. 콘솔 오류0·기존 셰이더 정밀도 경고2건. 사용자 저장 메달은 지우지 않았다.

| IAB 화면 크기 | 버튼 | 최소 크기 | 중심 hit | 잘림/버튼 간 겹침/안내 넘침 |
| --- | ---: | ---: | ---: | ---: |
| 1280×720 | 7 | 68px | 7/7 | 0/0/0 |
| 1024×768 | 7 | 57.6px | 7/7 | 0/0/0 |
| 844×390 | 7 | 44px | 7/7 | 0/0/0 |
| 667×375 | 7 | 44px | 7/7 | 0/0/0 |

터치 강제 표시를 자동으로 복원하고 높은 품질/3인칭과 기본 뷰포트로 돌려놓았다. 실제 휴대폰/태블릿 검증은 아니다. 성삼재는 이 검수 호스트의 새 저장 상태에서 메달 잠금으로 브라우저 주행을 하지 않았으며, 방향 기하/전체 레이스 검증은 기존 기록으로 구분한다.

## 한계와 다음 작업

이 PC의 정상 공식 주소 접속 제한은 남는다. 실제 휴대폰/태블릿의 공식 주소·동시 입력·전체 랩과 별도 통신망 온라인은 추가 확인해야 한다. 이번 배포에서 장시간 프레임을 새로 측정하지 않았으며 높은 품질의 간헐적 긴 프레임과 보류한 확장 후보를 해결 완료로 선언하지 않는다.

증거는 `artifacts/deploy-navigation-20261104/`의 사전 SHA/26시험·빌드, `vercel-production.txt`, `vercel-domain-status.txt`, `official-server-route-verification.json`, `production-flow.json`, `production-ui.json`이다. 실제 캡처는 `D:/racing/.work/deploy-navigation-20261104/screens/`에 보존했고 블로그 대표20장은 변경하지 않았다.
