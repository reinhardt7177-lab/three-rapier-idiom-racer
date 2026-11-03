# 좌우 안내 수정 GitHub·운영 배포 · 2026-11-04

사용자가 좌우 수정본의 GitHub 업로드와 `racing.mumuworld.com` 배포를 요청했다.

**현재 상태: GitHub 업로드 및 미리보기 빌드 완료. Vercel 운영 재배포는 사용자 재인증을 기다리고 있다. 운영 배포가 완료됐다고 표시하지 않는다.**

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
- Vercel이 인증 앱의6자리 코드 또는 패스키 재인증을 요구했다. 사용자에게 열린 Vercel 화면에서 직접 인증하도록 요청했으며 인증값을 읽거나 저장하지 않는다.
- 이 시점 운영본은 여전히 `f885332`/`dpl_H9SfANxrfzoH1qFRHU9QCE126oph`이다. 새 Production Ready·공식 주소의 새 자산/실제 주행 확인은 인증 후 수행할 남은 작업이다.

## 남은 검증과 한계

인증 후 운영 재배포를 완료하고 공식 호스트37파일 HTTP/SHA 및 네 코스 HTML, 실제 왼쪽·오른쪽 안내와 입력 해제를 확인한다. 확인한 운영 배포ID·시각·화면은 이 문서와 NEXT_STEPS에 갱신한다.

로컬 최소본의 네 화면 UI·539시험 결과는 이미 기록했지만, 운영 검증을 대신했다고 표현하지 않는다. 실제 휴대폰/태블릿·전체 랩 프레임·별도 통신망 온라인은 남아 있으며 높은 품질의 간헐적 긴 프레임도 해결 완료로 선언하지 않는다.
