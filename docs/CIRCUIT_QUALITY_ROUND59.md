# Circuit quality round 59 — 피트 지구 실자산 배치

서킷이 단순히 도로와 나무만 있는 코스처럼 보이지 않도록 피트 바깥을 하나의 서비스 지구로 구성했다.

- Kenney Retro Urban `wall-a-garage`, `wall-b-flat-window`, `wall-a-flat-painted` 파사드를 피트 외곽에 배치했다.
- 파사드에 `detail-awning-wide`와 `detail-light-double`을 연결해 건물·조명 실루엣이 한 세트로 보이게 했다.
- 서비스 트럭과 대형 공원수를 배치해 관중석/피트 구역의 스케일 기준을 만들었다.
- 모든 파사드는 기존 `loadPropLater` 비동기 로딩·420ms ease-in 경로를 사용해 첫 프레임을 막지 않는다.
- 기존 충돌선·배리어·피트 차량 배치는 유지했다.

## 검증

- Circuit quality validation: 21 circuit markers / 7 district assets
- Garage quality validation: 30 runtime markers / 7 UI markers / 9 curated assets
- Physics validation: 13 Rapier/vehicle/AI markers
- Vite production build passed
