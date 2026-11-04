import hashlib,json,pathlib,re,shutil,sys
sys.stdout.reconfigure(encoding='utf-8')
base=pathlib.Path(__file__).resolve().parent
root=base.parents[1]
def text(p):
 data=p.read_bytes()
 return data.decode('utf-16' if data.startswith((b'\xff\xfe',b'\xfe\xff')) else 'utf-8-sig',errors='replace')
for name in ['build-optin','final-current','rival-current','traffic-current','steering-current']:
 path=base/(name+'-exit.txt')
 if not path.exists() or text(path).strip()!='0': raise SystemExit(f'Not passed: {name}')
previous=json.loads((base/'actual-final-inputs.json').read_text(encoding='utf-8'))
current_hashes={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in previous}
changed=[p for p,h in previous.items() if current_hashes[p]!=h]
if changed:
 assert set(changed)=={'src/rebuild/rivalPlanner.js','scripts/rival-racecraft.test.mjs'},f'Unexpected input change: {changed}'
 if not (base/'pre-optin-inputs.json').exists(): shutil.copy2(base/'actual-final-inputs.json',base/'pre-optin-inputs.json')
 (base/'actual-final-inputs.json').write_text(json.dumps(current_hashes,indent=2),encoding='utf-8')
data=json.loads((base/'final-current.json').read_text(encoding='utf-8'))
data['results'][2]=json.loads((base/'traffic-current2.json').read_text(encoding='utf-8'))['results'][0]
data['notes']=['Advanced profiles retain the same behavior after the opt-in correction.','Standalone/classic planners were re-tested in rival-current.log; the traffic scenario was re-run and replaces row 2.','Pre-correction and final input hashes are retained separately.']
assert len(data['results'])==7
assert all(len(r['cars'])==6 and all(c['finish'] and c['lowest']>0 for c in r['cars']) for r in data['results'])
log=text(base/'check-final.log')
count=re.findall(r'ℹ tests (\d+)',log)
passed=re.findall(r'ℹ pass (\d+)',log)
failed=re.findall(r'ℹ fail (\d+)',log)
assert (base/'check-final-exit.txt').exists(), 'Full suite is still running'
assert count and passed and failed
legacy={'player steering is exactly 1.3 times at road speeds with the original low-speed rack stop and mirrored wheel axes','enhanced steering actually turns the Rapier front wheels and stays upright at 100 and 180km/h'}
classic='five faster planned rivals and a slower driven player complete the recovered 6.84 km course'
failure_names={re.sub(r' \([0-9.]+ms\)$','',line[2:].strip()) for line in log.splitlines() if line.startswith('✖ ') and line!='✖ failing tests:'}
if int(failed[-1]):
 assert failure_names in (legacy,legacy|{classic}) and int(failed[-1])==len(failure_names), f'Unresolved additional failures: {failure_names}'
rival_log=text(base/'rival-current.log')
rival_count=re.findall(r'ℹ tests (\d+)',rival_log)[-1]
full_status=f"최초 전체 {passed[-1]}/{count[-1]} 통과·{failed[-1]}실패, AI 후속 {rival_count}/{rival_count} 통과, 기존 조향 기대값 2건 불일치 잔여" if int(failed[-1]) else f"{count[-1]}/{count[-1]} 통과"
for saved in (base/'preserved-generated-outputs').rglob('*'):
 if not saved.is_file(): continue
 rel=saved.relative_to(base/'preserved-generated-outputs')
 target=root/rel
 if target.exists():
  evidence=base/'regression-results'/rel
  evidence.parent.mkdir(parents=True,exist_ok=True)
  shutil.copy2(target,evidence)
 shutil.copy2(saved,target)
(base/'final.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
names={'coastal':'해안','namak':'남악','yeosu':'여수','seongsamjae':'성삼재'}
rows=[]
for race in data['results']:
 label=f"{names[race['track']]} / {race['difficulty']} / {race.get('laps',1)}랩 / {race['weather']}"
 if race['traffic']['count']: label+=' / 교통6'
 rows.append(f"| {label} | 6/6 | {max(c['finish'] for c in race['cars']):.2f}초 | {race['maxStall']:.1f}초 |")
section=f"""### 최종 검증 결과

- 로컬 Windows CPU / Rapier WASM: 전체 회귀 **{full_status}**, Vite 빌드 통과. 실제 명령은 `check:rebuild`에 등록된 모든 시험 파일을 `node --test --test-concurrency=4`로 실행하고 `npm run build`를 별도로 실행했다. 전체 검사가 모두 통과했다고 판정하지 않는다.
- 새 AI·개성·교통 집중 검사21개와 기존 라이벌 검사23개를 합친 **{rival_count}/{rival_count} 통과**. 중복 범위의 개수를 더하지 않는다. 클래식 단독 계획기의 고급 제동 적용 범위를 수정한 뒤 다시 실행한 결과다.
- 최신 물리·조향과 AI를 함께 검사한 7조건 **42대 완주**, 도로 이탈 0. 마지막 적용 범위 수정 뒤 클래식 계획기 전체와 여수 교통 조건을 재검사해 반영했다. 아래 시간은 물리 시뮬레이션 시간이다.

| 조건 | 완주 | 마지막 차량 | 최대 저속 정체 |
| --- | --- | --- | --- |
{chr(10).join(rows)}

저속 정체는 출발 8초 이후 3km/h 미만의 연속 시간이다. 교통을 기다리는 짧은 감속도 포함한다. 검증된 조건에서 추락이나 영구 정체는 없었으며, 모든 가능한 충돌을 피한다는 뜻은 아니다.

전체 로그는 `check-final.log`, 수정 후 라이벌 전체·집중 검사는 `rival-current.log`, 마지막 빌드는 `build-optin.log`, 최종 코스 자료는 `final.json`이다. 수정 전후 입력 SHA-256은 `pre-optin-inputs.json`과 `actual-final-inputs.json`에 구분했다. 공유 생성형 시험 파일은 보존했던 내용을 복원하고 복원 전 사본은 `regression-results/`에 보관했다. 동시 실행의 공유 산출물과 혼동하지 않도록 판정 근거는 이 작업의 전용 로그·`final.json`으로 삼는다.

전체 실행 중 클래식 계획기의 6.84km 검사 미완주도 발견했다. 고급 예측 제동과 재추월 세부 판단을 명시적인 전술 설정이 있는 라이벌에만 적용하도록 범위를 좁혔다. 수정 후 같은 검사를 포함한 {rival_count}개가 모두 통과했다. 최종 게임의 보통·어려움 라이벌은 고급 전술을 사용하고, 쉬움·옛 단독 호출은 검증된 기본 판단을 유지한다.

브라우저 검수는 사람이 아닌 자동 페달을 사용했다. 남악 어려움에서 6대 완주, 1인칭 전환, 일시정지 시간 유지, 재개, 결과, 재시작·고스트, 차고 복귀·기록 유지와 읽은 오류 0을 확인했다. 상세 값과 사용한 사본은 `browser-verification.json`에 기록했다. 병행 물리 변경 전 사본의 82.47초를 최신 물리의 성능 수치로 사용하지 않는다.

Three.js/Rapier의 기존 청크 크기 경고는 빌드에 남아 있다. 최초 230개 빠른 검사와 중간 208개 진행 중 전체 검사 등은 이번 최종 전체 회귀 숫자에 별도 가산하지 않는다. 중간 실행기 시간 초과로 끊긴 결과도 보존했다.

최신 디스크 코드의 브라우저 재검사에서도 남악 어려움 **6대 모두 완주**, 플레이어 84.41초·6위·은메달, 해금·차고 복귀·최고 기록 유지와 검수 자동 페달 종료를 확인했다. 읽은 실행 오류 0개, 기존 셰이더 정밀도 경고 1개다. `browser-current.json`에 이전 사본과 구분해 기록했다.

### 별도 조향 검사의 불일치

`scripts/namak-polish.test.mjs`의 두 옛 검사는 모든 도로 속도에서 조향이 정확히 1.3배이며 저속 정지 한계가 0.52라고 요구한다. 병행 작업의 현재 `steering.js`는 코너 속도 구간에 추가 gain과 playerBlend를 적용하므로 이 전제와 충돌한다. 이 두 검사는 라이벌 계획기를 호출하지 않는다. AI 작업에서 해당 사용자 코드를 되돌리거나 옛 검사의 수치 기준을 완화하지 않았다.

현재 조향 설계를 검사하는 `scripts/steering-turn.test.mjs`는 별도 실행 **4/4 통과**했다. `steering-current.log`에 실제 8종 물리 회전·접지·고속·남악 완주 결과를 보존했다. 다만 이 결과가 위 두 옛 검사의 실패를 지우지는 않는다. 후속 작업은 현재 조향 설계와 기존 검사 계약을 정합시키는 것이다.
"""
report=root/'docs/RIVAL_AI_3PASS_20261015.md'
body=report.read_text(encoding='utf-8')
body=body.replace('최종 코스 비교·전체 회귀·브라우저 검증 수치는 계산 종료 후 이 문서에 기록한다.',section)
report.write_text(body,encoding='utf-8')
next_path=root/'docs/NEXT_STEPS.md'
next_body=next_path.read_text(encoding='utf-8')
lines=next_body.splitlines()
for i,line in enumerate(lines):
 if line.startswith('**레이싱 AI 3회 고도화 검증 중 (2026-10-15):**'):
  lines[i]=f'**레이싱 AI 3회 고도화 로컬 적용·검증 (2026-10-15):** 노면별 제동·끼어들기 예측, 슬립스트림·니트로 운영, 성격별 재추월·총 랩 거리 기반 결승 공략을 적용했다. 쉬움·클래식 정체를 발견해 기존 판단을 보존하도록 적용 범위를 수정했다. AI 후속{rival_count}/{rival_count}·7조건42대 완주·이탈0·빌드·실제 브라우저 흐름 확인. 전체 회귀 {full_status}; 최신 조향 검사4/4와 옛 조향 검사 계약2건의 불일치를 구분해 기록했다. 기존 사용자 변경 보존, 커밋·운영 배포 없음. 다음은 조향 검사 정합과 사람의 추월 체감·휴대폰 검수다. [구성·실측·실패·한계](RIVAL_AI_3PASS_20261015.md).'
next_path.write_text('\n'.join(lines)+'\n',encoding='utf-8')
(base/'completion.json').write_text(json.dumps({'initialFullTests':int(count[-1]),'initialPassed':int(passed[-1]),'initialFailed':int(failed[-1]),'rivalRetestPassed':int(rival_count),'remainingLegacySteeringMismatches':2,'raceCars':42,'device':'Local Windows CPU / Rapier WASM','postCorrectionInputsVerified':True},indent=2),encoding='utf-8')
print(json.dumps({'tests':int(count[-1]),'cars':42,'report':str(report)},ensure_ascii=False))
