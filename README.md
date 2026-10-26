# MUMU CIRCUIT · 무무레이싱

Blender로 만든 차량과 코스를 Three.js로 그리고, Rapier로 주행·충돌을 계산하는 웹 레이싱 게임입니다.

- **[게임 실행](https://racing.mumuworld.com/)**
- **[무무클래스 앱 소개](https://www.mumuclass.kr/apps/eced455d-2a26-4047-bfa5-73b3f5a13804)**
- [제작기](docs/blog/MAKING_OF.md) · [대표 이미지 20장](docs/blog/IMAGES.md) · [현재 우선순위](docs/NEXT_STEPS.md)

![현재 차고](docs/blog/images/15-current-garage.png)

## 현재 게임

| 구성 | 내용 |
| --- | --- |
| 차량 | Blender 차량 8종, 회전·조향하는 바퀴, 공통 3D 운전석 |
| 코스 | 해안 월드 6.84km, 남악 시티 2.93km, 여수 밤바다 8.90km, 지리산 성삼재 5.83km |
| 싱글 | 플레이어 + AI 5대, AI 1:1, 쉬움·보통·어려움, 1·3랩 |
| 진행 | 전남 챔피언십, 메달·해금, 코스별 기록·고스트 |
| 연출 | 1·3인칭, 타이어 연기·자국·배기, 엔진 합성음, BGM 2곡, 비 날씨 |
| 친구 대전 | 초대 링크·방 코드·QR로 연결하는 온라인 1:1 |
| 그래픽 | 높음·보통·낮음 품질 선택과 저장 |

친구 대전은 방장이 두 차량의 물리와 결승을 계산하는 방식입니다. 임의 상대 자동 매칭, 전용 순위 서버, 호스트 이전은 없습니다. 실제 휴대폰·다른 통신망의 연결 품질은 추가 검수가 필요합니다.

여수의 도로 평면은 OpenStreetMap 좌표를 바탕으로 재구성했습니다. 지형 높이·도로 폭·랜드마크는 레이스에 맞게 편집했습니다. 남악과 성삼재도 사진·지도에서 참고한 풍경을 레이스 코스로 구성한 것으로, 실제 지역 전체를 측량 복제한 게임은 아닙니다. 실차 이름을 참고한 자체 차량 모델이며 제조사 공식 스캔이나 제휴 제품이 아닙니다.

## 로컬 실행

Node.js와 Git LFS가 필요합니다. 이 작업본은 Node 24에서 검증했습니다.

```powershell
git lfs install
git lfs pull
npm ci
npm run dev -- --port 5191
```

개발 주소는 `http://localhost:5191/`입니다. 특정 코스는 `?track=namak`, `?track=yeosu`, `?track=seongsamjae`, `?track=coastal`로 엽니다.

```powershell
npm run check
npm run build
npm run preview -- --port 5192
```

`check`는 실제 Rapier 레이스를 포함해 로컬에서 수 분 이상 걸립니다. 최근 전체 실행은 QR 기능 마감 때 **475/475 통과**했으며, 당시 소스·시간·한계는 [QR 검증 문서](docs/ONLINE_QR_INVITE_20261015.md)에 있습니다. 이후 정리는 문서·증거·이미지 범위이며 새 검증 결과는 [마감 기록](docs/RELEASE_HANDOFF_20261016.md)에서 구분합니다.

## 소스 구조

| 경로 | 용도 |
| --- | --- |
| `src/rebuild/` | 현재 앱 입구, 차고·레이스 UI, 차량·물리·맵·온라인 |
| `src/driving/`, `src/garage/`, `src/rendering/`, `src/scenery/` | 실행·회귀 시험이 사용하는 공유 모듈 |
| `public/assets/rebuild/` | 배포용 차량·코스·차고 GLB, 주행 경로, Draco 디코더 |
| `public/assets/audio/` | 현재 게임에서 선택하는 BGM 2곡 |
| `assets-sources/vehicles-v6/` | 현재 차량 8종의 Blender 편집 원본 |
| `assets-sources/cockpit-v1/` | 공통 운전석 Blender 원본 |
| `assets-sources/namak/`, `yeosu/`, `seongsamjae/` | 코스 원본·지도 자료 |
| `assets-sources/rebuilt-unity/` | 해안·차고 편집 원본. 폴더명은 복구 이력 |
| `assets-sources/music-maps-20261011/` | Gemini 생성 음악 원본 4곡. 현재 게임에는 미연결 |
| `scripts/blender/` | 제작·폴리싱·GLB 재수출 스크립트 |
| `scripts/*.test.mjs` | 입력·차량·충돌·레이스·진행·온라인 회귀 시험 |
| `artifacts/` | 수치·실패 로그·필수 물리 fixture. 일반 스크린샷은 블로그 20장으로 정리 |
| `docs/blog/` | 제작기·사진 갤러리·사진 출처/해시 목록 |

Blender 원본을 편집한 뒤 해당 수출 스크립트를 실행합니다. 이전 단계의 폴리싱 스크립트를 전부 순서대로 다시 적용하는 방식은 권장하지 않습니다.

```powershell
blender -b --python scripts/blender/export_fleet_eight.py -- --only supra
blender -b --python scripts/blender/export_environment.py
```

## 보존·배포

- 현재 게임은 Unity 실행 파일을 사용하지 않습니다. Unity 프로젝트 전체가 복구됐다는 의미도 아닙니다.
- 큰 `world.blend`는 Git LFS로 관리합니다. 비밀키·환경 파일·설치 의존성·빌드 사본은 공개하지 않습니다.
- 공식 서비스는 기존 Vercel 프로젝트와 `racing.mumuworld.com`을 사용합니다. Cloudflare는 DNS 연결 역할입니다.
- 무무클래스에는 기존 **앱 올리기** 기능으로 게임을 등록했습니다. 무무클래스 사이트 코드는 변경하지 않았습니다.
- 이번 정리는 작업 폴더의 사진·임시 복제본 정리입니다. Git 이력의 과거 사진까지 영구 제거하는 작업은 하지 않았습니다.
- [온라인 설계·제약](docs/ONLINE_MATCH_REVIEW_20261015.md) · [QR 초대](docs/ONLINE_QR_INVITE_20261015.md) · [도로 주변 제작·출처](docs/ROADSCAPE_20261013.md) · [차량 실차 비교](docs/VEHICLE_REFERENCE_3PASS_20261015.md)
