# Stock Car Racing · REA 정적 분석 근거

작성일: 2026-10-25. 대상은 사용자가 제공한 `Stock+Car+Racing_3.26.3_APKPure.xapk`다. 이 문서는 **상용 앱의 정적 분석 결과**이며, MUMU CIRCUIT의 구현·브라우저 검수·성능·배포 완료 보고와 구분한다.

**확인한 범위:** 패키지 신원과 구성, IL2CPP 선언 및 디버그 매핑, 네 곳의 제한된 ARM64 명령 표본. **확인하지 않은 범위:** 원본 C# 소스, 전체 네이티브 함수·제어 흐름, 원본 튜닝 계수, 안드로이드 실행·실제 주행감·기기 성능.

## 1. 입력 신원과 분석 방법

| 항목 | 관찰 또는 선언 |
| --- | --- |
| 원본 파일 크기 | 739,219,238B |
| 원본 SHA-256 | `71e9b5860bb597b5088c8b67a47d1431913d79585b11d486603b2f19208202db` |
| XAPK 동봉 manifest의 선언 | `com.minicades.stockcars`, 버전 `3.26.3`, version code `243` |
| 주요 구성 | 기본 APK, ARM64 APK, Unity 데이터 팩 APK |
| 기본 APK SHA-256 | `d0b0b5a353d699fe2f5d6cfd53403630911e685dbe8c84bdc60d0e20d81730cf` |
| 관찰된 Unity 데이터 버전 문자열 | `6000.4.1f1` |
| 네이티브 코드 | ARM64 ELF `libil2cpp.so`, 107,635,520B |
| 네이티브 코드 SHA-256 | `35035d65700ba3e7a24a329ef2af539b3a60365883d2a6cbec077dba5f75ec2b` |

REA **6.5.0 CLI**로 컨테이너와 명령 표본을 조사했다. 초기 doctor는 `healthy:false`, Codex MCP 등록은 `stale/config_drift`였다. 이를 정상 연결 또는 MCP 실행 성공으로 보고하지 않는다. MCP 설정을 임의로 고치지 않고 지원되는 CLI 경로를 사용했다.

명령 디코더는 공식 Rizin 0.9.1 Windows shared64 배포본이며, 압축 파일의 공개 SHA-256 `45ffa004e26653eaee8d262b8e6eeae09402a7d319c1f20a2ba794bd6af1cc28`을 확인했다. 대상 게임은 실행하지 않았다.

**근거 종류를 분리한다.** REA가 반환한 Evidence와 일반 Python 표준 라이브러리로 얻은 메타데이터·USYM 파싱 결과는 같은 것이 아니다. Python 결과에 가상의 REA Evidence ID를 붙이지 않았다.

## 2. REA Evidence 목록

### 컨테이너 검사

| 대상 | Evidence ID | 실제 의미 |
| --- | --- | --- |
| XAPK | `ev_189213349ee8175046c4f24bccc4e00786893443799b3588dee36e1a84f6e504` | 원본 ZIP 컨테이너 신원·엔트리 검사 |
| 기본 APK | `ev_0d11b9ee837145a6c4249d5723d1daa4433709067ad6e040eb291ac5aba84a21` | APK 컨테이너 신원·엔트리 검사 |

위 결과의 `complete-within-substeps`는 실행된 컨테이너 검사 범위다. 앱 전체 코드·안드로이드 manifest 의미·런타임 동작을 완전히 분석했다는 뜻이 아니다. APK signing block 등 ZIP 엔트리 밖 바이트의 의미 검증도 포함하지 않는다.

### ARM64 명령 표본

각 표본은 원본 ELF의 VA와 파일 오프셋을 연결해 추출한 **768B**다. REA가 반환한 범위는 각각 **64행**이며, 이를 전체 함수로 취급하지 않는다. 원본 VA와 슬라이스 SHA는 [정리 JSON](../artifacts/rea-stockcar-20261025/rea-evidence-summary.json)에 있다.

| 표본 | Evidence ID | 실제 반환 행 검증 |
| --- | --- | --- |
| RaceCamera 매핑 | `ev_0552b6c61eb320195cc5cd7b2af3e5d17d1fcb7ab0326dcd8241d66c19277297` | 64/64 유효·정렬·원본 바이트 일치, 분기21개 재계산 일치 |
| VehicleDynamics 매핑 | `ev_b04999d906acb942fc0233fa327140b036cbee0c5973392ef4667178bf552403` | 64/64 유효·정렬·원본 바이트 일치, 분기18개 재계산 일치 |
| SuspensionVisuals 최초 | `ev_8a2615d58095f0caa486ae938e468372cdf97de645655422ed6ab7c3c8f2efde` | **5행 유효, 59행 invalid·오정렬**. 불완전한 최초 결과 보존 |
| VehicleDamage 충돌 매핑 | `ev_91bd39165ec36065331ad03cad2ae71a09319e05a871f2586531baccd04cfcc0` | 64/64 유효·정렬·원본 바이트 일치, 분기17개 재계산 일치 |
| SuspensionVisuals 고정 오프셋 재검사 | `ev_7b6fa935690d7268138b97dfb36994a58562c15426449d1945c50f0fbbb25f9c` | 64/64 유효·정렬·원본 바이트 일치, 분기25개 재계산 일치, unknown/invalid0 |

마지막 검사는 `pdj 1 @ offset`을 4바이트 간격으로 명시했다. stdout에 JSON 배열 문서64개가 연속해 있어 각각 파싱했다. 최초 검사의 잘못 진행된 디코더 커서를 따라가지 않았으며, 이전 59개 invalid를 삭제하거나 성공으로 재분류하지 않았다.

슬라이스는 주소0 기준으로 디코딩됐다. 분기 목적지에 원본 VA를 더한 결과를 AArch64 원시 opcode의 상대 분기값으로 독립 계산해 대조했고, 유효 분기의 불일치는0이었다. **ADRP의 데이터 주소는 페이지 단위 보정이 필요하므로 같은 덧셈으로 해결했다고 주장하지 않는다.**

## 3. 일반 Python 정적 분석과 교차검증

이 절의 근거는 `.work/stock-car-rea-20261025/`의 `unity-symbol-audit.json`, `unity-metadata-audit.json`과 해당 파서다. REA 결과로 부풀리지 않는다.

### 메타데이터

- `global-metadata.dat`의 magic과 버전39, 테이블 경계와 선언 수를 검사했다.
- 공개 LibCpp2IL 형식 reader를 대조해 메서드32B·타입82B·필드12B와 버전별 가변 폭 인덱스를 읽었다.
- 메서드 선언 **122,995개**의 이름·소속 타입 범위·토큰을 검증했다.
- 카메라·차량·바퀴·충돌·효과 관련 **17타입 / 531필드 / 225메서드**를 선별했다.
- **정정:** 작업 중 대화에서 선별 필드를631개라고 잘못 합산했다. 실제 JSON의 필드 배열 길이를 다시 합하면 **531개**다. 타입17개·메서드225개는 동일하다.

### 디버그 매핑

- `sym-` magic, 버전2, **2,677,398레코드**를 관찰했다.
- 실제 파일은 24바이트 레코드이며 `24 + 2,677,398 × 24 = 64,257,576`에서 유효 문자열 테이블이 시작한다. Sentry의 예전 16바이트 예제를 그대로 적용하지 않았다.
- 파일 오프셋 **2,650,507개 유효 / 잘못된 오프셋0**, 미상26,891개. 주소 감소0이었다.
- 레코드의 메서드 인덱스 후보2,650,507개가 메타데이터 범위에 모두 들어가고, 참조 후보193,205개가 레코드 범위에 들어갔다. **후속 정정:** 범위 일치만으로 이 후보를 전역 메서드 신원으로 확정할 수 없다. 아래 CodeGenModule 대조에서 일부 이름의 불일치를 확인했다. USYM의 파일·줄 관찰과 추정 메서드 이름을 분리한다.
- 실행 세그먼트 밖 비영 주소는 **1개**, 레코드20의 `0x28`이다. 메서드·파일·줄·참조 필드가 모두 `FFFFFFFF`인 미상 레코드로 보존했다.
- USYM ID와 ELF GNU Build-ID가 **`d4359f7f36b6186a906e536e69b76e351299aef0`**로 정확히 일치했다.

한 파일·메서드의 최소/최대 주소에는 인라인·공유 코드·빈 구간이 섞일 수 있다. 이를 함수 진입점·완전한 본문 범위로 단정하지 않는다.

### 후속 CodeGenModule·호출 주소·unwind 교차검증

전체 ELF 분석기를 다시 실행하지 않고 Python의 읽기 전용 mmap·표준 relocation 읽기로 조사했다. **일반 정적 분석이며 새 REA Evidence가 아니다.** 메타데이터 이미지120개와 CodeGenModule120개의 이름·메서드 수·TokenRID 순서를 대조했다. `R_AARCH64_RELATIVE` addend로 복원한 메서드 포인터와 실제 명령의 호출 목적지가 **같은 VA일 때만** 연결했다. 인접 심볼 이름으로 대신하지 않았다.

18개 호출 관찰/14개 고유 목적지 중 **9개 목적지·12개 호출**의 선언을 연결했다. 나머지5개 목적지·6개 호출은 미확인이다. 카메라의 `AnimationCurve.Evaluate`, `Camera.set_fieldOfView`, `Time.get_smoothDeltaTime`, `Transform.get_eulerAngles`, 서스펜션의 `Transform.LookAt`, 충돌의 `Collision.get_impulse` 호출을 확인했다. **충돌에서 읽는 벡터는 impulse다.** 초기 relativeVelocity 후보는 근거가 없으므로 사용하지 않는다. 실제 곡선 값·최종 시점·물리 계수·실행 중 활성 여부까지 확인한 것은 아니다.

USYM +8 필드의 추정 이름과 정확한 포인터 선언이 다른 사례도 보존했다. `0x51a905c`는 추정 get_playerVehicle 대신 get_settings, `0x51aacc8`는 추정 Refresh 대신 CheckIntercarCollision으로 연결된다. 이 필드의 범위 검사만으로 호출자 이름을 확정하지 않는다.

네 루트 표본은 정확한 메서드 포인터와 ELF `.eh_frame` FDE 시작이 일치하며, 실제 읽은64행이 모두 그 코드 범위 안에 있다. 라벨은 유지할 수 있지만 **표본 시작점은 모두 함수 내부**다.

| 루트 | 정확한 진입점 | 표본 시작 | unwind 구간 끝·미포함 |
| --- | --- | --- | --- |
| RaceCamera.LateUpdate | `0x511eb74` | `0x511ebbc` | `0x511ee98` |
| VehicleDynamics.FixedUpdate | `0x51adb40` | `0x51adb70` | `0x51addc4` |
| SuspensionVisuals.LateUpdate | `0x519ecf0` | `0x519ecf4` | `0x519edfc` |
| VehicleDamage.OnCollisionEnter | `0x51aadf4` | `0x51aaea0` | `0x51ab060` |

[정확한 주소·선언·구간 요약](../artifacts/rea-stockcar-20261025/call-target-summary.json)에 네 타입 전체59메서드의 포인터 표, FDE 바이트 해시, 불일치·미확인·형식 출처를 함께 남겼다. 런타임 ASLR 기준 주소는 관찰하지 않았으며 정적 VA끼리 비교했다. 함수 포인터 공유·제네릭·헬퍼의 모호성은 유지한다.

## 4. 구조별 관찰·추론·미확인

원본 개발자의 개인 경로 대신 관련 `Assets/` 경로만 사용한다.

| 영역 | 관찰한 사실 | 가능한 해석 | 아직 확인하지 못한 것 |
| --- | --- | --- | --- |
| `Assets/Scripts/Cameras/RaceCamera.cs` | 카메라 모드별 위치·각도·FOV 곡선 선언. 표본에서 AnimationCurve.Evaluate·FOV setter·smoothDeltaTime·eulerAngles 호출의 정확한 정적 포인터 연결 | 모드별 기준점·곡선 렌즈 반응·프레임 시간 조회가 함께 있는 구조 | 속도 스칼라의 필드 의미, 곡선 값·완전한 보간 알고리즘·런타임 체감 |
| `Assets/Scripts/Vehicle/DriftModule.cs` | `visualDriftEnabled`, driftBody, real/fakeWheelLODs와 ApplyVisualDrift·UpdateFakeWheelsRotation 선언 | 물리와 별도 시각 드리프트 책임이 존재할 가능성 | 활성 조건, 실제 시각 회전량, 물리 충돌과의 관계·체감 효과 |
| `Assets/Scripts/Vehicle/SuspensionVisuals.cs` | arms/wheels/initialized와 LateUpdate 선언. 교정64행 유효, 공통 목적지 `0x5b73ac8`는 정확히 Transform.LookAt에 연결 | 표현 노드의 방향을 화면 갱신 단계에서 맞추는 구조와 일관됨 | LookAt 호출만으로 지면조회·서스펜션 길이 계산·실제 활성 조건을 입증하지 못함 |
| `Assets/Scripts/Vehicle/VehicleDynamics.cs`, `Wheel.cs` | 접지·슬립·서스펜션·안티롤 관련 선언. 선택 FixedUpdate 명령에서 두 값 차이·스칼라 곱·부호가 반대인 짝 저장·배열 합산 관찰 | 안티롤 및 바퀴별 반응과 일관되는 후보 | 정확한 필드 배치, 실제 힘 적용, 타이어/댐퍼 계수, 안정성·주행감 |
| `Assets/Scripts/Vehicle/VehicleDamage.cs` | OnCollisionEnter 내부의 `0x5bec754`가 Collision.get_impulse 포인터와 일치. 벡터 제곱합→sqrt→스칼라 곱→1.0 비교·분기 관찰 | 충격량 크기를 기반으로 반응을 가르는 구조와 일관됨 | 임계값 의미·보정 계수·손상 결과·완전한 제어 흐름 |
| `Assets/Scripts/Vehicle/VehicleEffects.cs` | OnCollisionEnter/Stay, EmitImpactSparks/EmitScrappingSparks 등의 분리된 선언 | 순간 충격과 지속 마찰 효과를 구분하는 구조와 일관됨 | 실제 방출 조건·개수·오디오/카메라 결합·기기 성능 |

네이티브 관찰 범위의 Evidence는 2절 표에 있다. 선언과 소스 줄의 매핑이 실행을 관찰한 것은 아니며, API 이름을 파일명이나 바이트 수식만으로 확정하지 않는다.

## 5. MUMU CIRCUIT에 적용할 독자 설계 아이디어

다음은 **우리 엔진과 안정성 요구에 맞춘 독자 설계**다. 상용 게임의 코드·계수·에셋을 복원하거나 옮긴 결과가 아니다. 적용 완료 여부는 별도 구현 보고에서 판단한다.

1. **차량 표현의 시간축 분리:** 물리 스텝마다 시각 반응을 수집하고 화면에서는 보간한다. 충돌이 화면 사이 어느 스텝에 발생해도 반응을 잃지 않게 한다. 복귀·새 경기 시 표현 상태를 초기화한다.
2. **카메라 방향과 거리 분리:** 급격한 방향 전환 때 오프셋 벡터가 차량 중심을 통과하지 않도록 회전과 추적 거리를 나눠 다룬다. 운전자 시점·모션 감소 정책은 별도 제한을 둔다.
3. **실제 접촉 근거의 방향 반응:** 접촉점·법선·상대 운동을 기준으로 짧은 방향별 표현을 설계한다. 지속 벽 마찰과 순간 충격을 구분하고, 표현을 위해 물리 본체를 순간이동시키지 않는다.
4. **온라인 표현의 일관성:** 검증한 충돌 이벤트를 한 번만 소비해 양쪽에서 효과를 재생한다. 중복·재정렬·정지·복귀·경기 변경의 기준은 우리 프로토콜에 맞춰 검증한다.

위 선택은 정적 분석에서 보인 책임 분리와 비교한 설계 방향이다. 상대 앱의 검증되지 않은 물리 계수나 기능을 가져오는 근거로 사용하지 않는다.

## 6. 실패와 분석 한계

| 시도 | 실제 결과 | 처리 |
| --- | --- | --- |
| 최초 REA Rizin 명령 | `capability_unavailable`, `Unable to run configured command (ERR_REA_WINDOWS_NATIVE)` | 실패 파일 보존. 이를 대상 게임 결함이나 성공 분석으로 분류하지 않음 |
| 전체 ELF 조회 첫 시도 | `provider_timeout`, 120,000ms, 출력 없음·완료 상태 unknown | 실패와 partial Evidence 보존 |
| 전체 ELF 조회 조정 시도 | 다시 `provider_timeout`, 120,000ms | 같은 무거운 조회를 반복하지 않고 원본 VA/파일 오프셋·해시를 연결한 작은 표본으로 범위를 축소 |
| 최초 Suspension 연속 디코드 | 5행 뒤 커서 오정렬, 59행 invalid | 원본 실패를 남기고 각4B 오프셋을 명시한 별도 Evidence로 재검사 |

큰 ELF 검사 두 번의 timeout을 감추거나 표본 분석으로 전체 함수 분석이 완료됐다고 대체하지 않는다. 성공 명령의 프로세스 종료와 디코더 결과의 유효성도 구분했다.

## 7. 원본 보존과 공유 범위

- 원본 XAPK, 선택 APK 사본, 메타데이터·네이티브 라이브러리·디버그 맵, 네 슬라이스 등 **12파일**의 SHA를 다시 계산했고 모두 기존 값과 일치했다.
- 네 슬라이스는 원본 ELF의 실제 파일 범위 바이트와 모두 일치했다.
- 네이티브 REA Evidence5개는 실행 후 입력 SHA가 같고 `artifact_changed:false`였다.
- Unity 데이터 팩 전체는 원본 XAPK 안에 보존했으며 제품 에셋으로 사용하지 않았다.
- 큰 정적 자료와 원본 로그는 저장소 밖 `D:/racing/.work/stock-car-rea-20261025/`에 보존했다. 원본 APK·상용 미디어·복원 코드·개발자 개인 경로를 Git에 추가하지 않는다.
- 저장소에는 이 문서와 개인 경로를 제거한 [REA 근거 요약](../artifacts/rea-stockcar-20261025/rea-evidence-summary.json)·[호출 주소 요약](../artifacts/rea-stockcar-20261025/call-target-summary.json)을 작성했다. 이 분석 문서 작업의 커밋·푸시·배포는 없다.

다음 분석에서 가장 중요한 것은 원본 앱의 실제 실행 자료를 정적 근거와 대조하는 일이다. 현재 자료만으로 원본의 주행감·충돌 강도·성능까지 재현했다고 주장하지 않는다.

## 출처

- [Google Play · Stock Car Racing 공식 등록](https://play.google.com/store/apps/details?id=com.minicades.stockcars): 개발사 설명·공개 참고 자료. 제공 XAPK의 내부 동작 검증을 대신하지 않는다.
- [LibCpp2IL 메타데이터 reader](https://github.com/SamboyCoding/Cpp2IL/tree/development/LibCpp2IL/Metadata): 버전별 테이블·가변 폭 인덱스 형식 대조.
- [Sentry symbolic 9.1.0 · UsymLite reader](https://raw.githubusercontent.com/getsentry/symbolic/9.1.0/symbolic-il2cpp/src/usymlite.rs): 이전 형식 참고. 이번 입력의 24B 확장은 실제 경계와 교차관계로 별도 검증했다.
- [Rizin 0.9.1 공식 배포](https://github.com/rizinorg/rizin/releases/tag/v0.9.1): 사용한 Windows 도구의 출처와 배포 해시.
- [REA 외부 역공학 도구 연동](https://github.com/morluto/rea/blob/main/docs/reverse-engineering-tools.md): CLI 관찰 범위·명령 결과·제한을 구분하는 참고 문서.
