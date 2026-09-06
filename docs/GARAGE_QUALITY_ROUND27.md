# Garage quality round 27 — urban bay dressing

차량 무대의 중심 구도는 유지하면서, 화면 가장자리의 시설감을 높이는 라운드다.

## 배치한 CC0 프롭

- Retro Urban `wall-a-garage`: 후면 좌·우 서비스 파사드
- Retro Urban `detail-dumpster-closed`: 서비스 구역 외곽
- Retro Urban `tree-park-large`: 차고 양쪽 경계 랜드마크

모든 프롭은 `loadPropLater`로 지연 로드되어 첫 프레임과 차량 물리 초기화를 막지 않는다. 영웅 차량이 있는 중앙 17m 영역은 비워 두고, 카메라가 회전해도 파사드·나무·폐기물 프롭이 주변부에서만 읽히도록 배치했다.

## 품질 기준

- 중심 차량과 피트 UI를 가리지 않는 주변부 배치
- 기존 201개 CC0 에셋 검증 체계 유지
- 빌드 후 Rapier 물리 청크 경고 외 오류 없음
