# 관리자 전달용 · 공식 게임 주소 DNS 점검 요청

아래 문구는 전달용 초안이다. 관리자에게 자동으로 보내지 않았다.

---

**제목: racing.mumuworld.com DNS 응답 및 서비스 허용 가능 여부 점검 요청**

조직에서 관리하는 Chrome에서 `https://racing.mumuworld.com/`에 접속하면 `ERR_CONNECTION_REFUSED`가 발생합니다.

- 해당 PC의 DNS 조회는 이 hostname에 `127.0.0.1`을 반환합니다. DNS 캐시 초기화 후에도 같습니다.
- Cloudflare 원격 환경에서 Cloudflare·Google 공개 DNS를 조회하면 공용 서버 IP가 반환되고, 공식 주소의 파일 35개가 모두 HTTP 200으로 응답합니다.
- 게임 전용 Cloudflare Worker와 도메인 연결을 삭제·재생성한 뒤에도 사용자 Chrome의 결과는 같습니다.
- 사용자 환경에서는 Chrome 보안 DNS 설정이 조직 관리로 변경 불가능합니다.

**요청:** `racing.mumuworld.com`에 대한 DNS 필터·웹 정책 로그를 확인해, `127.0.0.1` 응답이 의도된 정책인지 조회 오류인지 확인 부탁드립니다. 조직 정책상 허용 가능한 서비스라면 이 **단일 hostname의 DNS 응답과 HTTPS(TCP 443) 접근**을 승인된 절차에 따라 정상화해 주세요. 의도된 차단이라면 적용된 정책과 허용 신청 절차를 안내 부탁드립니다.

공유 Cloudflare IP 대역이나 wildcard 도메인의 일괄 허용을 요청하는 것은 아닙니다. 검사 당시 공개 A 주소는 `104.21.38.200`·`172.67.138.78`이었으며 바뀔 수 있으므로 hostname을 기준으로 점검해 주세요.

승인된 조치 후 동일 PC의 Chrome에서 공식 주소의 차고 로딩·출발·복귀를 재검증하겠습니다.

---

기술 증거와 재생성 결과: [Cloudflare 초기화 보고](CLOUDFLARE_RECREATE_20261014.md), [최초 Chrome 재현](CHROME_ACCESS_20261014.md).
