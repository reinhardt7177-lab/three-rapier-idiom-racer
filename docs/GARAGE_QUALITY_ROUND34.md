# Garage quality round 34 — motion-respectful showroom

시각 연출이 많은 쇼룸에서도 `prefers-reduced-motion` 사용자의 설정을 존중하도록 3D idle motion을 보정했다.

## 변경점

- 브라우저 reduced-motion 미디어 쿼리 감지
- 쇼룸 카메라 orbit과 차량 idle bob을 거의 정지 상태로 전환
- pulse 값을 중립값에 고정해 조명·모트가 번쩍이지 않도록 처리
- 일반 환경에서는 기존 cinematic idle 속도를 유지
- CSS에서 이미 중지되는 UI 애니메이션과 3D 연출을 같은 정책으로 정렬

## 검증

- `npm run check` 전체 통과
- CC0 201개 / 차량 10종 / 진행도 데이터 통과
- reduced-motion 분기 포함 Vite 빌드 성공
