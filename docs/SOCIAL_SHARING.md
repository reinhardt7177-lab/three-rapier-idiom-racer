# 링크 공유 카드

- 제목: MUMU CIRCUIT · 돌아오는 불빛
- 원본: 사용자가 제공한 실제 차고 스크린샷. 차량·차고를 변형하지 않았다.
- 이미지: `public/social/harbor-garage-v1.png` (817 × 619, PNG)
- 운영 주소: https://mumu-racing.vercel.app/
- 구현: `index.html`의 정적 Open Graph / Twitter 메타데이터. JavaScript 실행 없이 읽을 수 있다.
- 기준: [Open Graph 공식 사양](https://ogp.me/).

## 확인과 교체

`node --test scripts/social.test.mjs`는 메타데이터 중복, 실제 PNG 서명·크기, 이미지 URL과 대체 설명을 검사한다. 빌드 후 `dist/social/harbor-garage-v1.png`도 있어야 한다.

공유 앱의 카드 배치·잘림은 앱이 결정한다. 기존 메시지의 미리보기 갱신과 실제 카카오톡 클라이언트 결과는 별도 확인이 필요하다. 새 이미지는 버전 파일명으로 추가하고 OG/Twitter URL·이미지 치수를 함께 바꾼다.

## 제작 한계

내장 이미지 생성 도구로 원본 기반 와이드 타이포그래피 커버를 시도했으나 Windows 파일 읽기 sandbox 오류로 생성하지 못했다. API/CLI 우회는 하지 않았고, 사용자 원본을 수정 없이 사용했다. 생성 이미지나 합성 결과라고 표시하지 않는다. 게임 런타임에는 이미지를 로드하지 않는다.
