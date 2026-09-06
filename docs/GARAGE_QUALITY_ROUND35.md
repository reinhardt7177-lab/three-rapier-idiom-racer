# Garage quality round 35 — transition and loading polish

차고 연출이 화면 전환과 로딩 상태에서 사용자 설정을 무시하지 않도록 마지막 안정성 보정을 적용했다.

## 변경점

- `RuntimeLoading`을 `role="status"` + `aria-live="polite"`로 보강
- reduced-motion 환경에서 전체 화면 wipe와 wipe line을 정지
- 쇼룸 idle motion과 UI transition을 같은 reduced-motion 정책으로 통일
- 일반 환경의 기존 460ms 전환 연출은 유지

## 검증

- `npm run check` 전체 통과
- CC0 201개 / 차량 10종 / 진행도 데이터 통과
- Vite 빌드 성공( Rapier 청크 용량 경고만 유지 )
