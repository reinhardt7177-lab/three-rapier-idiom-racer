# MUMU CIRCUIT 콘텐츠 확장 분석 및 추가 계획

작성일: 2026-08-10  
대상: `three-rapier-idiom-racer`

## 결론

첫 확장은 **B: 차고 컬렉션**으로 진행하는 것이 맞다. 현재 저장소에 Kenney Car Kit 파일이 이미 들어와 있고, 차고는 3대만 노출하고 있으므로 새 에셋을 대량으로 받기 전에 게임 루프와 UI를 확장할 수 있다.

다만 B만 계속 늘리면 트랙이 비어 보이는 문제가 남는다. 따라서 순서는 다음처럼 잡는다.

1. **B-1 차량 컬렉션 코어**: 8~12대를 먼저 선별해 차고·해금·기록 루프 완성
2. **A-lite 페스티벌 지구**: Retro Urban 건물 전체가 아니라 피트·주유소·소방서·상점가 1개 지구만 배치
3. **B-2 컬렉션 확장**: 나머지 차량, 바디 컬러, 휠, 배지
4. **C 시즌 테마**: 데이터 기반 지구 교체와 선택적 에셋 로딩

## 현재 코드에 대한 근거

- `public/assets/kenney/cars`에 차량 관련 파일 51개가 이미 있음
- 실제 선택 가능한 `CARS` 데이터는 `src/track-data.js`에 3대뿐임
- `App.jsx`는 차고 선택 상태와 개인 최고기록을 이미 가지고 있어 컬렉션 UI를 붙이기 쉬움
- `racing-runtime.js`는 차량 GLB를 자동 정규화하고 Rapier 차체를 생성하므로 새 차량을 추가해도 물리 차체 생성 경로를 공유할 수 있음
- 트랙은 Catmull-Rom 곡선으로 생성되므로 City Kit Roads 모듈을 도로 본체로 교체하면 현재 물리 배리어·연석·체크포인트와 충돌함
- 학습 요소는 제거된 상태이므로 해금 조건은 문제 풀이가 아니라 경기 결과·완주·최고기록으로만 구성해야 함

## 옵션 비교

| 옵션 | 지금 얻는 효과 | 구현 난이도 | 주요 리스크 | 판단 |
|---|---|---:|---|---|
| A. 장난감 디오라마 시티 | 스크린샷 품질과 장소성이 가장 크게 상승 | 중~상 | 건물 수 증가, 드로우콜·파일 용량, 배치 규칙 필요 | B 다음 A-lite |
| B. 차고 컬렉션 | 반복 플레이와 차고 화면의 목적이 생김 | 중 | 해금·저장·밸런스·차량별 스케일 검증 | **첫 구현** |
| C. 시즌 테마 지구 | 장기 운영과 재방문 이유 제공 | 상 | 테마별 에셋 파이프라인·선택적 로딩·호환성 | 마지막 |

## B-1: 차량 컬렉션 코어

### 선별 차량 1차

처음부터 40종을 모두 노출하지 않고 역할이 분명한 8~12대를 사용한다.

| 클래스 | 예시 파일 | 역할 |
|---|---|---|
| Starter GT | `race.glb` | 기본 밸런스형 |
| Future GT | `race-future.glb` | 최고속형 |
| Rally | `hatchback-sports.glb` | 조향·그립형 |
| Sedan Sport | `sedan-sports.glb` | 안정형 |
| SUV | `suv.glb` | 충돌 안정형 |
| Police | `police.glb` | 추격 콘셉트 |
| Fire Truck | `firetruck.glb` | 대형·저속형 |
| Van / Delivery | `van.glb` 또는 `delivery.glb` | 수집 보상형 |
| Kart | `kart-oobi.glb` | 가벼운 조작형 |
| Tractor | `tractor.glb` | 이벤트용 이색 차량 |

### 데이터 구조

차량 파일과 물리·해금 데이터를 분리한다.

```js
{
  id: "rally-r",
  name: "RALLY R",
  file: "hatchback-sports.glb",
  class: "GRIP",
  stats: { topSpeed: 78, acceleration: 72, grip: 94, mass: 820 },
  unlock: { type: "finish_count", value: 2 },
  colors: ["#d8e8ef", "#e5333f"]
}
```

### 해금 원칙

- 첫 차량 3대는 즉시 사용
- 나머지는 완주 횟수, 개인 최고기록, 특정 서킷 승리로 해금
- 골드는 장식·색상·배지에만 사용
- 결제, 문제 풀이, 학습 점수는 넣지 않음
- 저장 키는 `mumu-circuit-profile`로 분리하고 기존 `mumu-circuit-best` 기록은 유지

### 완료 조건

- 잠긴 차량은 차고에서 실루엣과 해금 조건만 표시
- 해금된 차량은 동일한 GLB 정규화·Rapier 차체·카메라 경로를 공유
- 차량별 질량·최고속·그립 차이가 실제 주행에 반영
- 새로고침 후 해금·선택 차량이 유지
- 차량을 10대 이상 로딩해도 첫 화면은 선택 차량만 실제 모델을 로딩

## A-lite: 장난감 디오라마 시티

Retro Urban Kit는 공식 페이지 기준 120개 모델의 CC0 팩이다. 상점·소방서·주유소·공사장처럼 랜드마크가 있는 지구를 만들기 좋다. [Kenney Retro Urban Kit](https://www.kenney.nl/assets/retro-urban-kit)

### 배치 원칙

- City Kit Roads 모듈은 사용하지 않고 현재 곡선 도로와 Rapier 배리어를 유지
- 트랙 파라미터 `t`와 좌우 거리로 건물 앵커를 정의
- 첫 지구는 출발선 주변 25~35개 건물/프롭만 배치
- 피트동, 주유소, 소방서, 상점가, 공사장을 랜드마크로 고정
- 원거리 건물은 낮은 디테일 또는 단순 박스로 대체해 드로우콜을 제한
- 건물 GLB 도입 시 스케일·피벗·바닥 높이·텍스처 경로를 자동 검사

### 완료 조건

- 출발선과 관중석이 있는 한 구간이 “동네”로 읽힘
- 트랙 물리 폭·체크포인트·차량 충돌은 변경하지 않음
- 차고와 레이스 화면에서 도시 건물이 같은 팔레트와 조명으로 보임
- 초기 로딩 예산과 에셋 파일 수를 검사 스크립트로 제한

## C: 시즌 테마 지구

C는 테마별 에셋을 한 번에 모두 넣는 방식이 아니라 `districts` 데이터로 교체한다.

```js
{
  id: "winter-harbor",
  label: "WINTER HARBOR",
  palette: { sky: "#9dbbd2", ground: "#d7e4e8", accent: "#74d5ff" },
  props: ["snow-pine.glb", "ice-barrier.glb"]
}
```

먼저 A-lite의 지구 슬롯과 머티리얼 팔레트를 데이터화해야 하며, 이후 겨울·우주·해적 테마를 선택적으로 로딩한다.

## 구현 순서

### Phase 1 — 컬렉션 기반

- `src/car-data.js` 신설
- 기존 `CARS`를 카탈로그·스탯·해금 조건으로 확장
- `mumu-circuit-profile` 저장/복원
- 차고 잠금 상태·해금 조건·색상 선택 UI
- 차량 GLB 검증 스크립트에 바운딩 박스와 텍스처 검사 추가

### Phase 2 — 주행 밸런스

- 차량 스탯을 Rapier engine force, mass, wheel friction으로 매핑
- 동일한 물리 차체에서 차량별 체감 차이 검증
- AI 차량에도 카탈로그 스탯 적용
- 차량별 최고기록과 선택 차량을 결과 화면에 표시

### Phase 3 — A-lite 지구

- Retro Urban Kit에서 건물·프롭만 가져오기
- `district-layout.js`에 트랙 앵커 배치
- 출발선 주변 1개 지구 완성
- GLB 스케일·피벗·텍스처 검사 통과 후 화면에 사용

### Phase 4 — 확장

- 나머지 차량과 컬러·휠·배지 확장
- 지구를 2~3개 구간으로 확장
- 시즌 테마 데이터와 선택적 로딩 추가

## 권장 우선순위

**B-1 → B-2 물리 밸런스 → A-lite → B-2 확장 → C**

이 순서면 현재 차고 UI를 재활용하면서 즉시 플레이 이유를 만들고, 이후 건물 에셋으로 스크린샷 품질을 올릴 수 있다. Kenney Car Kit은 40종 이상 모델과 glTF를 제공하고 CC0이며, 현재 저장소가 이미 같은 팩을 보관하고 있다. [Kenney Car Kit](https://kenney-assets.itch.io/car-kit) Quaternius Cars Pack은 8개 모델이지만 FBX/OBJ/Blend 중심이므로, 1차 웹 컬렉션에는 Kenney GLB를 우선하고 Quaternius는 변환 파이프라인이 준비된 뒤 보조 차량으로 넣는 편이 안전하다. [Quaternius Cars Pack](https://quaternius.com/packs/cars.html)
