# Retro Urban 프롭 통합 기록

## 적용 범위

- Kenney Retro Urban Kit의 CC0 GLB 모델을 차고지 외곽 장식에만 사용한다.
- 주행 트랙의 도로 그래프와 차량 충돌체는 기존 절차 생성 시스템을 유지한다.
- 원본 압축 파일·프리뷰·OBJ/FBX 전체는 `assets-sources/retro-urban/`에 보관하고, 브라우저에는 `public/assets/kenney/retro-urban/curated/`의 엄선된 GLB만 제공한다.

## 현재 투입한 프롭

| 구역 | 모델 | 배치 의도 |
| --- | --- | --- |
| Pit Lane 외곽 | `truck-flat.glb` | 서비스 차량 실루엣과 입구 스케일감 |
| Showroom 가장자리 | `detail-light-double.glb` | 주행 전 차량을 비추는 수직 조명 |
| 관람 동선 | `detail-bench.glb` | Grandstand와 연결되는 휴식 포인트 |
| Service Bay 뒤 | `detail-dumpster-closed.glb` | 정비 구역 생활감 |
| 양쪽 경계 | `tree-park-large.glb` | 장난감 디오라마의 높이 대비 |
| 후면 간판 라인 | `detail-awning-wide.glb` | 기존 `MUMU MOTORSPORT` 파사드와 연결 |

큰 벽·지붕 모듈은 차량 영웅 샷과 `SERVICE` 카메라를 가리기 때문에 현재 브라우저 배치에서는 제외했다. 필요할 때는 별도 지구 맵에서 모듈 조립용으로 재사용한다.

## 검증 기준

- `node scripts/check-assets.mjs`에서 CC0 에셋 179개와 Retro Urban 라이선스 파일을 함께 검사한다.
- `FRONT / ORBIT / SERVICE` 세 카메라에서 차량이 프롭에 가려지지 않아야 한다.
- 390×844 모바일 뷰에서 프롭은 장식 레이어로만 동작하고 차량 선택·기록 카드와 겹치지 않아야 한다.
- 외부 GLB를 추가할 때는 원본은 `assets-sources/`에 보관하고, `curated/`에는 실제 사용 파일만 복사한다.

## 출처

- [Kenney Retro Urban Kit](https://www.kenney.nl/assets/retro-urban-kit) — CC0, 120개 모델
- [Kenney Assets itch.io 배포 페이지](https://kenney-assets.itch.io/retro-urban-kit)

