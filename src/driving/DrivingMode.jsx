import React, { useEffect, useRef, useState } from 'react';
import { createDriving } from './createDriving.js';
import { INTRO_SHOTS } from './story.js';
import { COAST_ROADS, COAST_PADS, coastMapPoint } from './coastRoute.js';
import { loadHudSettings, saveHudSettings } from './hudSettings.js';
import './drivingHud.css';
import { formatTime, SPRINT_LABELS } from './sprint.js';
import { CHAPTER_ONE } from '../campaign/campaign.js';

function PauseMenu({ children, onResume }) {
  const dialog = useRef(null);
  useEffect(() => { const el = dialog.current; el.showModal(); return () => el.close(); }, []);
  return <dialog className="driving-menu" ref={dialog} aria-labelledby="drive-menu-title" onCancel={e => { e.preventDefault(); onResume(); }}>
    <header><div><span className="eyebrow">COASTLINE / 정차 메뉴</span><h2 id="drive-menu-title">잠시 정차합니다</h2></div><button className="resume-primary" autoFocus onClick={onResume}>주행 재개</button></header>
    {children}
  </dialog>;
}

export default function DrivingMode({ color, scenario = 'test', motion = true, chapterDifficulty = 'standard', campaignProfile, campaignSaved, onExit }) {
  const duel=scenario==='duel';if(duel)scenario='sprint';
  const host = useRef(null), runtime = useRef(null);
  const [stats, setStats] = useState(null), [error, setError] = useState('');
  const [touchDevice, setTouchDevice] = useState(() => navigator.maxTouchPoints > 0 || matchMedia('(any-pointer: coarse)').matches);
  const [settings, setSettings] = useState(() => { try { return loadHudSettings(window.localStorage, touchDevice); } catch { return loadHudSettings(null, touchDevice); } });
  const initialSettings = useRef(settings);
  const [saveFailed, setSaveFailed] = useState(false), [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => {
    const query = matchMedia('(any-pointer: coarse)');
    const update = () => setTouchDevice(navigator.maxTouchPoints > 0 || query.matches);
    query.addEventListener('change', update); return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    createDriving(host.current, setStats, color, abort.signal, { duel, story: scenario === 'story', coast: ['coast','journey','sprint','chapter'].includes(scenario), journey: scenario === 'journey', sprint: ['sprint','chapter'].includes(scenario), chapter: scenario === 'chapter', chapterDifficulty, campaignProfile, campaignSaved, motion, quality: initialSettings.current.quality }).then(result => { if (abort.signal.aborted) result?.dispose(); else runtime.current = result; }).catch(e => { if (!abort.signal.aborted) { console.error(e); setError('주행 화면을 준비하지 못했습니다. 차고로 돌아가 다시 시도해 주세요.'); } });
    return () => { abort.abort(); runtime.current?.dispose(); runtime.current = null; };
  }, [color, scenario, duel, motion, chapterDifficulty, campaignProfile, campaignSaved]);
  useEffect(() => { if (!stats?.paused) setConfirmReset(false); }, [stats?.paused]);
  useEffect(() => { if (stats && !stats.paused) host.current?.querySelector('canvas')?.focus({ preventScroll: true }); }, [stats?.paused, stats?.inspection]);
  function updateSetting(key, value) {
    const next = { ...settings, [key]: value }; setSettings(next);
    try { setSaveFailed(!saveHudSettings(window.localStorage, next)); } catch { setSaveFailed(true); }
    runtime.current?.clearInput(); if (key === 'quality') runtime.current?.setQuality(value);
  }
  const story = stats?.story, coast = stats?.coast, journey = stats?.journey, sprint=stats?.sprint, chapter = stats?.chapter;
  const ghost=stats?.ghost;
  const exit = () => onExit({ journeyComplete: journey?.phase === 'complete', campaignProfile: chapter?.profile, campaignSaved: chapter?.saved });
  const cinematic = story?.phase === 'intro' || story?.phase === 'complete' || (journey && ['briefing', 'signal', 'complete'].includes(journey.phase));
  const touch = settings.touch === 'on' || (settings.touch === 'auto' && touchDevice);
  const shot = INTRO_SHOTS[Math.min(2, Math.floor((story?.introTime || 0) / 5))];
  const hold = code => ({
    onPointerDown: e => { if (e.button !== 0) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); runtime.current?.setInput(code, true, e.pointerId); },
    onPointerUp: e => runtime.current?.setInput(code, false, e.pointerId),
    onPointerCancel: e => runtime.current?.setInput(code, false, e.pointerId),
    onLostPointerCapture: e => runtime.current?.setInput(code, false, e.pointerId),
  });
  const degrees = i => ((stats?.wheels[i]?.steering || 0) * 180 / Math.PI).toFixed(1);
  const title = chapter ? `01 / ${CHAPTER_ONE.title}` : sprint ? 'COASTLINE / 해안 스프린트' : journey ? '돌아오는 불빛 · 첫 해안 운행' : scenario === 'coast' ? '바람곶 해안길' : scenario === 'story' ? '첫 번째 호출' : 'GT 테스트 주행';
  const guidance = sprint ? sprint.objective : coast?.offRoad ? '노면 이탈 · 메뉴에서 도로 복귀' : journey ? journey.objective : coast ? coast.returned ? '항구 귀환 완료' : coast.lookout ? '항구로 돌아가기 · 오른쪽 차로' : '전망대 방향 · 갈림길에서 우회전' : story ? story.objective : '직선 시험 · W / ↑ 가속';
  const resume = () => runtime.current?.setPaused(false);
  const pause = () => runtime.current?.setPaused(true);
  return <main data-chapter-id={chapter?.id} data-chapter-passed={chapter?.result?.evaluation?.passed} className={`drive-mode driving-shell${scenario === 'story' ? ' story-mode' : ''}${coast ? ' coast-mode' : ''}${cinematic ? ' cinematic' : ''}`} data-layout={stats?.layout} data-touch={touch} data-inspection={!!stats?.inspection} data-coast-area={coast?.area} data-coast-lookout={coast?.lookout} data-coast-returned={coast?.returned} data-story-phase={story?.phase} data-checkpoint={story?.checkpoint} data-journey-phase={journey?.phase} data-journey-gate={journey?.gate} data-journey-time={journey?.elapsed} data-sprint-phase={sprint?.phase} data-sprint-gate={sprint?.gate} data-sprint-valid={sprint?.valid} data-sprint-time={sprint?.elapsed}>
    <div className="scene" ref={host} />
    {stats?.action&&!duel&&!stats.paused&&!stats.inspection&&<aside className="action-status" data-driving-overlay data-nitro={stats.action.charge} data-boost={stats.action.active} data-drift={stats.action.drifting} aria-label="액션 주행 상태">{stats.action.drifting?'DRIFT · 충전':stats.action.active?'NITRO · 가속':'NITRO · SHIFT'} <b>{Math.round(stats.action.charge)}%</b><meter min="0" max="100" value={stats.action.charge} aria-label="니트로 잔량" /></aside>}
    <header className="driving-route" data-driving-overlay>
      <h1>{duel?'COASTLINE / 라이벌 대결':title}</h1><p>{stats?.inspection ? '바퀴 점검 · 정차 상태' : cinematic ? '해안의 이야기가 시작됩니다' : guidance}</p>
    </header>
    <button className="pause-trigger" data-driving-overlay aria-label="일시정지 및 메뉴" disabled={!stats || !!error} onClick={pause}><span aria-hidden="true">Ⅱ</span><span>메뉴</span></button>
    {!stats?.paused && <button className="sound-trigger" data-driving-overlay aria-label={stats?.audio?.enabled ? '주행 사운드 끄기' : '주행 사운드 켜기'} aria-pressed={!!stats?.audio?.enabled} disabled={!stats || !!error} onClick={() => runtime.current?.setSound(!stats?.audio?.enabled)}><span aria-hidden="true">♪</span><span>{stats?.audio?.enabled ? '소리 켬' : '소리 끔'}</span></button>}
    {stats?.audio?.failed && !stats.paused && <p className="audio-blocked" role="status">소리가 차단됐습니다. 소리 버튼을 다시 눌러 주세요.</p>}
    {sprint && !stats.paused && !['briefing','complete'].includes(sprint.phase) && <aside className={`sprint-clock${duel?' duel-clock':''}`} data-driving-overlay aria-label={duel?'대결 순위와 기록':'스프린트 기록'}>
      <strong>{sprint.phase==='countdown'?Math.ceil(sprint.countdown):formatTime(sprint.elapsed)}</strong>
      {duel&&<><b className="duel-place" data-duel-place={stats.duel?.place??''}>{stats.duel?.place?`${stats.duel.place} / 2`:'— / 2'}{stats.duel?.notice?<small role="status">{stats.duel.notice}</small>:<small>{stats.duel?.gapLabel}</small>}</b><span>라이벌 {stats.duel?.gate}/3 · 비접촉</span><span data-nitro={stats.action?.charge} data-boost={stats.action?.active}>NITRO {Math.round(stats.action?.charge||0)}%{stats.action?.active?' · 가속':''}</span></>}
      {ghost?.referenceTime&&<span className="ghost-status">내 기록 고스트 · {ghost.delta!==null?`${ghost.delta>0?'+':''}${ghost.delta.toFixed(2)}초 / ${ghost.delta<=0?'앞섬':'뒤처짐'}`:formatTime(ghost.referenceTime)}{!ghost.enabled?' · 숨김':''}</span>}
      <span>{duel?`제한 ${Math.max(0,90-sprint.elapsed).toFixed(0)}초 남음`:sprint.phase==='countdown'?'출발 신호를 기다리세요':chapter?`기준 ${chapter.target}초 · ${Math.max(0, chapter.target - sprint.elapsed).toFixed(1)}초 남음`:sprint.delta!==null?`구간 차이 ${sprint.delta>0?'+':''}${sprint.delta.toFixed(2)}초`:sprint.best?`최고 ${formatTime(sprint.best.time)}`:'첫 기록을 만들어 보세요'}</span>
    </aside>}
    {duel&&sprint&&['briefing','complete'].includes(sprint.phase)&&!stats.paused&&<section className="journey-scene sprint-result" aria-label="해안 라이벌 대결">
      <span className="eyebrow">COASTLINE / RIVAL DUEL</span><h2>{sprint.phase==='briefing'?'코랄 GT를 앞질러라':stats.duel?.result}</h2>
      <p>{sprint.phase==='briefing'?'같은 3개 계측선을 순서대로 통과해 먼저 완주하세요. SHIFT/니트로 사용 가능. 코너 진입 전 감속!':`내 기록 ${formatTime(sprint.elapsed)} · 라이벌 ${stats.duel?.gate===3?formatTime(stats.duel.time):'미완주'}`}</p>
      <p>비접촉 대결 · 서로 통과합니다. 노면 이탈/도로 복귀는 무효, 제한 90초. 기존 개인 최고·고스트·라이선스는 변경하지 않습니다.</p>
      {!sprint.valid&&<p>{sprint.reason}</p>}<button onClick={()=>sprint.phase==='briefing'?runtime.current?.beginSprint():runtime.current?.retrySprint()}>{sprint.phase==='briefing'?'라이벌 대결 출발 →':'라이벌 재도전 →'}</button><button onClick={exit}>차고로 돌아가기</button>
    </section>}
    {sprint && !duel && ['briefing','complete'].includes(sprint.phase) && !stats.paused && <section className="journey-scene sprint-result" aria-label="해안 스프린트">
      <span className="eyebrow">{chapter?'CHAPTER 01 / HORIZON CLUB':'COASTLINE / TIME ATTACK'}</span>
      <h2>{chapter ? sprint.phase === 'briefing' ? CHAPTER_ONE.title : chapter.result?.evaluation.passed ? chapter.result.awarded ? '클럽 라이선스 획득' : '챕터 클리어' : '기록에 다시 도전하세요' : sprint.phase==='briefing'?'나의 기록을 앞지르다':sprint.personalBest?'새로운 개인 최고 기록':sprint.valid?'해안 스프린트 완주':'완주 · 기록 제외'}</h2>
      {sprint.phase==='briefing'?<>{chapter&&<p>{CHAPTER_ONE.briefing}</p>}<p>항만 직선 → S커브 → 바람곶 계측선. 계측선 3개를 순서대로 통과합니다.{chapter&&` 민서의 기준은 ${chapter.target}초. 성공하면 차고에 라이선스 01이 남습니다.`}</p><p>노면 이탈·도로 복귀 사용 시 기록에서 제외됩니다. 피니시 뒤에는 자동으로 감속합니다.</p><small>가상 해안 공도 · 단독 기록 주행 · 상대 차량 없음</small></>:<><strong className="result-time">{formatTime(sprint.elapsed)}</strong><ol className="sprint-splits">{sprint.splits.map((time,i)=><li key={i}><span>{SPRINT_LABELS[i]}</span><b>{formatTime(time)}</b></li>)}</ol>{chapter ? <p className="chapter-result-note">{chapter.result?.evaluation.reason}{chapter.result?.evaluation.passed && ' 라이선스 01 · 차고의 클럽 기록에 남습니다. 2장은 아직 제작 예정입니다.'}</p> : !sprint.valid&&<p>{sprint.reason}</p>}</>}
      <small>개인 최고 {formatTime(sprint.best?.time)} · 이 브라우저 기록</small>
      <p className="ghost-brief">{ghost?.available?`내 기록 고스트 ${formatTime(ghost.recordTime)} · 충돌 없는 실제 녹화. 다음 출발부터 함께 달립니다.`:'3분 이내 유효 완주하면 내 기록 고스트가 만들어집니다. 이전의 숫자 기록만으로는 경로를 복원하지 않습니다.'}</p>
      {ghost?.saved===false&&<small role="status">고스트 저장 불가 · 이 주행 화면의 재도전에서만 유지됩니다.</small>}
      {sprint.saved===false&&<small role="status">저장이 차단되어 이번 주행 화면에서만 기록을 유지합니다.</small>}
      {chapter?.saved===false&&<small role="status">챕터 저장이 차단되어 라이선스는 이번 방문에서만 유지됩니다. 기존 저장 내용은 덮어쓰지 않았습니다.</small>}
      <button onClick={()=>sprint.phase==='briefing'?runtime.current?.beginSprint():runtime.current?.retrySprint()}>{sprint.phase==='briefing'?chapter?'클럽 테스트 출발 →':'3초 후 출발 →':'바로 재도전 →'}</button>
      {sprint.phase==='complete'&&<button onClick={exit}>차고로 돌아가기</button>}
    </section>}
    <section className="telemetry" data-driving-overlay aria-label="차량 계기판" data-testid="telemetry" data-contacts={stats?.contacts} data-heading={stats ? Math.atan2(2 * (stats.rotation.x * stats.rotation.z + stats.rotation.w * stats.rotation.y), 1 - 2 * (stats.rotation.x ** 2 + stats.rotation.y ** 2)) : 0} data-draw-calls={stats?.drawCalls} data-camera-distance={stats?.cameraDistance} data-camera-fov={stats?.cameraFov} data-audio-state={stats?.audio?.state} data-quality={stats?.quality} data-pixel-ratio={stats?.pixelRatio} data-shadow-size={stats?.shadowSize} data-x={stats?.position.x} data-z={stats?.position.z} data-speed={stats?.kmh} data-time={stats?.elapsed}>
      <strong>{Math.round(stats?.kmh || 0)}</strong><span>km/h</span><b aria-label={`기어 ${stats?.gear || 'N'}`}>{stats?.gear || 'N'}</b>
      <span hidden data-ghost-available={ghost?.available} data-ghost-visible={ghost?.visible} data-ghost-clock={ghost?.clock} data-ghost-x={ghost?.x} data-ghost-z={ghost?.z} data-ghost-reference={ghost?.referenceTime} />
      <span hidden data-rival-time={stats?.duel?.time} data-rival-x={stats?.duel?.x} data-rival-z={stats?.duel?.z} data-duel-result={stats?.duel?.result}/>
      <span hidden data-feedback-accel={stats?.feedback?.acceleration} data-feedback-push={stats?.feedback?.push} data-feedback-braking={stats?.feedback?.braking} data-feedback-scrub={stats?.feedback?.scrub} data-feedback-sliding={stats?.feedback?.sliding} data-feedback-marks={stats?.feedback?.marks} data-audio-brake={stats?.audio?.mix?.brake} data-audio-tire={stats?.audio?.mix?.tire} data-audio-load={stats?.audio?.mix?.load} />
    </section>
    {stats?.inspection && !stats.paused && <aside className="inspection-card" aria-label="실제 앞바퀴 조향각" data-left-angle={degrees(3)} data-right-angle={degrees(1)}>
      <div><strong>정차 점검 · A / D</strong><span>좌 {degrees(3)}° / 우 {degrees(1)}°</span><small>운전자 기준 · 안쪽 바퀴가 더 꺾입니다.</small></div>
      <button onClick={() => runtime.current?.setInspection(false)}>점검 닫고 주행</button>
    </aside>}
    {stats?.paused && <PauseMenu onResume={resume}>
      <p className="pause-note">주행이 멈췄습니다. 메뉴·화면 회전·앱 전환 시 조작 입력을 해제합니다.</p>
      {stats.action&&<p>액션 주행 시안 · SPACE/핸드브레이크로 코너 진입 후 놓으면 접지력이 부드럽게 회복됩니다. SHIFT/니트로는 가속도 함께 수행합니다. 18km/h 이상·접지 상태에서 사용, 제동 중 차단. 주행 중 서서히 충전되고 실제 드리프트 시 더 빠르게 충전됩니다. 기록전에는 적용되지 않습니다.</p>}
      <div className="menu-columns"><section><h3>주행 안내</h3><p>{guidance}</p>
        {coast && <><p>{sprint?'계측선 3개를 순서대로 통과 · S커브 진입 전 감속':'권장 40–60 km/h · 전망대에서 정차 후 회차'}<br />현재 교통 AI는 없습니다.</p><svg className="menu-road-map" viewBox="-90 -850 470 1200" role="img" aria-label="항구와 전망대, 쉼터 도로 지도">
          {Object.entries(COAST_ROADS).map(([id, points]) => <polyline key={id} points={points.map(p => { const q = coastMapPoint(p); return `${q.x},${q.y}`; }).join(' ')} fill="none" stroke={id === 'rest' ? '#80968a' : '#d8c595'} strokeWidth="12" />)}
          {COAST_PADS.map(p => <circle key={p.id} cx={coastMapPoint(p).x} cy={coastMapPoint(p).y} r="16" fill="#cbb881" />)}
          <circle cx={coastMapPoint(stats.position).x} cy={coastMapPoint(stats.position).y} r="18" fill="#f4e4aa" />
        </svg></>}
        {story && <div className="menu-radio"><h3>무전 기록 · {story.speaker || '항구'}</h3><p>{story.text || '컷신이 끝나면 첫 의뢰를 시작합니다.'}</p></div>}
        {journey && <div className="menu-radio"><h3>무전 기록 · {journey.speaker}</h3><p>{journey.text}</p><p>시간제한 없음 · 주행 중 긴 대사는 이 메뉴에서 확인합니다.</p></div>}
        <h3>이동</h3><div className="menu-buttons">
          {coast && <button disabled={!!cinematic} onClick={() => runtime.current?.recoverRoad()}>도로 복귀 · C</button>}
          <button onClick={() => setConfirmReset(true)}>시작점 복귀 · R</button>
          <button onClick={exit}>차고로 돌아가기</button>
        </div>
        {confirmReset && <div className="reset-confirm" role="group" aria-label="시작점 복귀 확인"><p>이번 주행을 처음부터 시작할까요?</p><button onClick={() => { runtime.current?.reset(); setConfirmReset(false); }}>복귀 확인</button><button onClick={() => setConfirmReset(false)}>취소</button></div>}
      </section><section><h3>화면과 조작</h3>
        <label className="menu-field">그래픽 <select aria-label="그래픽 품질" value={settings.quality} onChange={e => updateSetting('quality', e.target.value)}><option value="light">경량 · 해상도·그림자 절약</option><option value="standard">표준 · 선명한 화면</option></select></label>
        <p className="setting-hint">태블릿 첫 방문은 경량으로 시작합니다. 차량 물리와 주행 속도는 두 옵션이 같습니다.</p>
        <label className="menu-field">터치 버튼 <select aria-label="터치 버튼 표시" value={settings.touch} onChange={e => updateSetting('touch', e.target.value)}><option value="auto">자동 · 터치 기기에서 표시</option><option value="on">항상 표시</option><option value="off">숨기기 · 키보드 사용</option></select></label>
        <h3>소리</h3><button onClick={() => runtime.current?.setSound(!stats.audio?.enabled)} aria-pressed={!!stats.audio?.enabled}>{stats.audio?.enabled ? '소리 끄기' : '소리 켜기'}</button>
        {sprint&&!duel&&<><h3>내 기록 고스트</h3><p>AI가 아닌 실제 녹화 경로입니다. 충돌하지 않으며 내 차와 겹치면 흐려집니다.</p><button disabled={!ghost?.available} aria-pressed={!!ghost?.enabled} onClick={()=>runtime.current?.setGhostEnabled(!ghost?.enabled)}>{ghost?.enabled?'고스트 숨기기':'고스트 표시'}</button></>}
        <label className="menu-field">볼륨 <input aria-label="주행 소리 볼륨" type="range" min="0" max="100" value={Math.round((stats.audio?.volume ?? .35) * 100)} onChange={e => runtime.current?.setVolume(Number(e.target.value) / 100)} /></label>
        {stats.audio?.failed && <p role="status">소리가 차단됐습니다. 소리 켜기를 다시 눌러 주세요.</p>}
        <h3>차량 점검</h3><p>최고 {Math.round(stats.peakKmh)} km/h · 접지 {stats.contacts}/4</p>
        <button disabled={stats.kmh >= 1 || cinematic || !!sprint} onClick={() => runtime.current?.setInspection(true)}>정차 후 바퀴 점검</button><p className="setting-hint">속도 1km/h 미만에서 가능합니다. 기록 도전 중에는 사용할 수 없습니다.</p>
        <details><summary>키보드 조작 보기</summary><p>W / ↑ 가속 · S / ↓ 제동·후진 · A D / ← → 조향 · B 제동 · Space 핸드브레이크 · R 시작점 복귀 · C 도로 복귀 · Esc 메뉴</p></details>
        {saveFailed && <p role="status">설정을 저장하지 못했습니다. 이번 방문에는 적용됩니다.</p>}
      </section></div>
    </PauseMenu>}
    {journey && cinematic && !stats.paused && <section className="journey-scene" aria-label="해안 운행 이야기">
      <span className="eyebrow">{journey.phase === 'briefing' ? 'FIELD NOTE / 01' : journey.phase === 'signal' ? 'SIGNAL 03 / 바람곶' : 'WORKSHOP LOG / 첫 운행'}</span>
      <h2>{journey.phase === 'briefing' ? '돌아오는 불빛' : journey.phase === 'signal' ? '마지막 차를 기다리는 불빛' : '돌아와야 완성되는 여행'}</h2>
      <p><span>{journey.speaker}</span>{journey.text}</p>
      {journey.phase === 'complete' ? <><div className="journey-log"><span>왕복 {(journey.distance / 1000).toFixed(2)} km</span><span>주행 {Math.floor(journey.elapsed / 60)}분 {Math.floor(journey.elapsed % 60)}초</span><span>신호 확인 · 귀환 완료</span></div><button onClick={() => onExit({ journeyComplete: true })}>차고로 돌아가 운행 기록 보기</button><small role="status">{journey.saved ? '이 브라우저에 운행 기록을 저장했습니다.' : '저장이 차단됐습니다. 기록은 이번 방문에만 유지됩니다.'}</small></> : <><button onClick={() => runtime.current?.advanceJourney()}>{journey.phase === 'briefing' ? '신호소로 출발 →' : '신호를 기록하고 항구로 →'}</button><small>{journey.phase === 'briefing' ? '약 3–5분 · 시간제한 없음 · 40–60 km/h 권장' : '회차 후 왔던 길로 · 주행 재개 전까지 차는 정지합니다.'}</small></>}
    </section>}
    {story?.phase === 'intro' && !stats.paused && <section className="story-cutscene" aria-label="프롤로그 컷신">
      <div className="shot-progress" aria-label={`장면 ${Math.min(3, 1 + Math.floor(story.introTime / 5))} / 3`}>{INTRO_SHOTS.map((_, i) => <i key={i} className={story.introTime >= i * 5 ? 'active' : ''} />)}</div>
      <span className="eyebrow">{shot.speaker}</span><h2>{shot.title}</h2><p>{shot.text}</p><button onClick={() => runtime.current?.skipIntro()}>컷신 건너뛰고 주행 →</button><small>실시간 3D · 15초 · 무전은 자막으로 제공</small>
    </section>}
    {story?.phase === 'complete' && !stats.paused && <section className="story-cutscene story-result" aria-label="의뢰 완료">
      <span className="eyebrow">PROLOGUE COMPLETE / 첫 번째 호출</span><h2>다시 만난 해안의 사람들</h2><p>유나 — “내일 저녁, 차고 앞에서 만나. 이 해안을 달리는 친구들을 소개해 줄게. 네 차고에도 다시 불이 켜졌네.”</p><p className="story-reward">획득한 이야기 기록 · 해안 주행 클럽의 초대</p><button onClick={onExit}>차고로 돌아가 초대 확인</button><button onClick={() => runtime.current?.reset()}>다시 주행하기</button><small role="status">{story.saved ? '완료 기록이 이 브라우저에 저장되었습니다.' : '저장이 차단되었습니다. 이번 방문에서만 완료를 확인할 수 있습니다.'} 다음 장은 아직 제작 전입니다.</small>
    </section>}
    {(!stats || error) && <section className="drive-message" role={error ? 'alert' : 'status'}><h2>{error ? '시작 실패' : '차량 준비 중'}</h2><p>{error || '물리엔진과 네 바퀴의 접지를 준비합니다.'}</p>{error && <button onClick={onExit}>차고로 돌아가기</button>}</section>}
    {touch && !cinematic && (!sprint || sprint.phase==='running') && !stats?.paused && <div className="driving-controls" aria-label="터치 주행 조작">
      <div className="steering-pad" data-driving-overlay><button aria-label="왼쪽 조향" {...hold('KeyA')}>←</button><button aria-label="오른쪽 조향" {...hold('KeyD')}>→</button></div>
      {stats?.action&&!stats.inspection&&<div className="nitro-pad" data-driving-overlay><button aria-label="니트로 가속" {...hold('ShiftLeft')}>NITRO</button></div>}
      {!stats?.inspection && <div className="pedal-pad" data-driving-overlay><button className="handbrake" aria-label="핸드브레이크" {...hold('Space')}>핸드<br />브레이크</button><button {...hold('KeyS')}>제동<span>후진</span></button><button className="accelerator" {...hold('KeyW')}>가속</button></div>}
    </div>}
  </main>;
}
