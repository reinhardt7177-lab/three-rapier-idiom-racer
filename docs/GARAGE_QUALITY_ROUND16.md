# Garage Quality Round 16

## 시설감 강화

- 차고지 천장 키라이트를 `ceilingLights` 배열로 분리하고, 쇼룸 카메라가 회전하는 동안 서로 다른 위상으로 밝기를 순환시켰다.
- `LIVE / DIAGNOSTICS` 패널의 5개 상태 바를 `diagnosticBars`로 관리해 각 바의 발광과 폭이 순차적으로 변하도록 했다.
- 기존 서비스 스캔·신호등·피트 크루 애니메이션과 함께 작동해 차고지가 정적인 배경이 아니라 운영 중인 팀 베이처럼 보이게 했다.

## 모바일 레이아웃

- 400px 이하 화면에서 차량 선택 목록을 4열 컴팩트 그리드로 전환했다.
- 차량 10종과 `SELECT CIRCUIT` 버튼이 스크롤 없이 한 화면에 노출되도록 높이·타이포그래피·간격을 조정했다.
- 390×844 실기 화면에서 차고지 진입 버튼 영역: `x=12, y=650.2, bottom=836`, `SELECT CIRCUIT` 버튼 `bottom=836`.
- 같은 화면에서 트랙 목록 `bottom=451.4`, `ENTER RACE` 버튼 `bottom=832`로 겹침 없이 확인했다.

## 검증

- 데스크톱 차고지 새 세션: 오류 0건.
- VOLT X 선택 시 시안 액센트와 차량별 쇼룸 조명 교체 확인.
- VOLT X + 네온 에이트 레이스 진입: `RACE LIVE`, `SECTOR 01 / 03`, `LAP 1/3`, 오류 0건.
- `npm.cmd run build -- --logLevel warn` 통과.
- `node scripts/check-assets.mjs` 통과: CC0 201개 / 7.5 MB.
- `node scripts/check-vehicle-assets.mjs` 통과: 차량 카탈로그 10개.
- `node scripts/check-progression.mjs` 통과: 5 finishes / 4 wins / 430 gold / 10 cars unlocked.

빌드에는 Rapier 번들 청크 크기 경고만 남아 있으며, 다음 최적화 라운드의 분리 후보로 기록한다.
