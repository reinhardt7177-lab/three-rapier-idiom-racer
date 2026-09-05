# Race FX quality round 61 — 니트로·드리프트 시각 피드백

주행 중 차량이 정적인 모델처럼 보이지 않도록 저비용 FX를 차체에 연결했다.

- 니트로 입력과 실제 `state.boost`가 남아 있을 때만 청록/황색 배기 화염이 켜진다.
- 브레이크+조향으로 드리프트할 때만 뒤쪽 타이어 연기 puff가 나타난다.
- FX는 차고·트랙 선택 화면에서 자동으로 숨겨지고, 런타임 dispose 시 애니메이션 루프가 종료된다.
- Additive blending과 8면체 저폴리 메시를 사용해 현재 로우폴리 아트 방향과 성능을 맞췄다.

## 검증

- Garage quality validation: 33 runtime markers / 9 UI markers / 9 curated assets
- Circuit quality validation: 21 circuit markers / 7 district assets
- Physics validation: 13 Rapier/vehicle/AI markers
- Vite production build passed
