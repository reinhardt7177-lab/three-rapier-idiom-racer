import React, { useEffect, useRef, useState } from 'react';
import { createDriving } from './createDriving.js';
import { INTRO_SHOTS } from './story.js';
import { COAST_ROADS, COAST_PADS, coastMapPoint } from './coastRoute.js';
import { loadHudSettings, saveHudSettings } from './hudSettings.js';
import './drivingHud.css';

function PauseMenu({ children, onResume }) {
  const dialog = useRef(null);
  useEffect(() => { const el = dialog.current; el.showModal(); return () => el.close(); }, []);
  return <dialog className="driving-menu" ref={dialog} aria-labelledby="drive-menu-title" onCancel={e => { e.preventDefault(); onResume(); }}>
    <header><div><span className="eyebrow">COASTLINE / 정차 메뉴</span><h2 id="drive-menu-title">잠시 정차합니다</h2></div><button className="resume-primary" autoFocus onClick={onResume}>주행 재개</button></header>
    {children}
  </dialog>;
}

export default function DrivingMode({ color, scenario = 'test', motion = true, onExit }) {
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
    createDriving(host.current, setStats, color, abort.signal, { story: scenario === 'story', coast: scenario === 'coast' || scenario === 'journey', journey: scenario === 'journey', motion, quality: initialSettings.current.quality }).then(result => { if (abort.signal.aborted) result?.dispose(); else runtime.current = result; }).catch(e => { if (!abort.signal.aborted) { console.error(e); setError('주행 화면을 준비하지 못했습니다. 차고로 돌아가 다시 시도해 주세요.'); } });
    return () => { abort.abort(); runtime.current?.dispose(); runtime.current = null; };
  }, [color, scenario, motion]);
  useEffect(() => { if (!stats?.paused) setConfirmReset(false); }, [stats?.paused]);
  useEffect(() => { if (stats && !stats.paused) host.current?.querySelector('canvas')?.focus({ preventScroll: true }); }, [stats?.paused, stats?.inspection]);
  function updateSetting(key, value) {
    const next = { ...settings, [key]: value }; setSettings(next);
    try { setSaveFailed(!saveHudSettings(window.localStorage, next)); } catch { setSaveFailed(true); }
    runtime.current?.clearInput(); if (key === 'quality') runtime.current?.setQuality(value);
  }
  const story = stats?.story, coast = stats?.coast, journey = stats?.journey;
  const exit = () => onExit({ journeyComplete: journey?.phase === 'complete' });
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
  const title = journey ? '돌아오는 불빛 · 첫 해안 운행' : scenario === 'coast' ? '바람곶 해안길' : scenario === 'story' ? '첫 번째 호출' : 'GT 테스트 주행';
  const guidance = coast?.offRoad ? '노면 이탈 · 메뉴에서 도로 복귀' : journey ? journey.objective : coast ? coast.returned ? '항구 귀환 완료' : coast.lookout ? '항구로 돌아가기 · 오른쪽 차로' : '전망대 방향 · 갈림길에서 우회전' : story ? story.objective : '직선 시험 · W / ↑ 가속';
  const resume = () => runtime.current?.setPaused(false);
  const pause = () => runtime.current?.setPaused(true);
  return <main className={`drive-mode driving-shell${scenario === 'story' ? ' story-mode' : ''}${coast ? ' coast-mode' : ''}${cinematic ? ' cinematic' : ''}`} data-layout={stats?.layout} data-touch={touch} data-inspection={!!stats?.inspection} data-coast-area={coast?.area} data-coast-lookout={coast?.lookout} data-coast-returned={coast?.returned} data-story-phase={story?.phase} data-checkpoint={story?.checkpoint} data-journey-phase={journey?.phase} data-journey-gate={journey?.gate} data-journey-time={journey?.elapsed}>
    <div className="scene" ref={host} />
    <header className="driving-route" data-driving-overlay>
      <h1>{title}</h1><p>{stats?.inspection ? '바퀴 점검 · 정차 상태' : cinematic ? '해안의 이야기가 시작됩니다' : guidance}</p>
    </header>
    <button className="pause-trigger" data-driving-overlay aria-label="일시정지 및 메뉴" disabled={!stats || !!error} onClick={pause}><span aria-hidden="true">Ⅱ</span><span>메뉴</span></button>
    <section className="telemetry" data-driving-overlay aria-label="차량 계기판" data-testid="telemetry" data-contacts={stats?.contacts} data-heading={stats ? Math.atan2(2 * (stats.rotation.x * stats.rotation.z + stats.rotation.w * stats.rotation.y), 1 - 2 * (stats.rotation.x ** 2 + stats.rotation.y ** 2)) : 0} data-draw-calls={stats?.drawCalls} data-camera-distance={stats?.cameraDistance} data-camera-fov={stats?.cameraFov} data-audio-state={stats?.audio?.state} data-quality={stats?.quality} data-pixel-ratio={stats?.pixelRatio} data-shadow-size={stats?.shadowSize} data-x={stats?.position.x} data-z={stats?.position.z} data-speed={stats?.kmh} data-time={stats?.elapsed}>
      <strong>{Math.round(stats?.kmh || 0)}</strong><span>km/h</span><b aria-label={`기어 ${stats?.gear || 'N'}`}>{stats?.gear || 'N'}</b>
    </section>
    {stats?.inspection && !stats.paused && <aside className="inspection-card" aria-label="실제 앞바퀴 조향각" data-left-angle={degrees(3)} data-right-angle={degrees(1)}>
      <div><strong>정차 점검 · A / D</strong><span>좌 {degrees(3)}° / 우 {degrees(1)}°</span><small>운전자 기준 · 안쪽 바퀴가 더 꺾입니다.</small></div>
      <button onClick={() => runtime.current?.setInspection(false)}>점검 닫고 주행</button>
    </aside>}
    {stats?.paused && <PauseMenu onResume={resume}>
      <p className="pause-note">주행이 멈췄습니다. 메뉴·화면 회전·앱 전환 시 조작 입력을 해제합니다.</p>
      <div className="menu-columns"><section><h3>주행 안내</h3><p>{guidance}</p>
        {coast && <><p>권장 40–60 km/h · 전망대에서 정차 후 회차<br />현재 교통 AI는 없습니다.</p><svg className="menu-road-map" viewBox="-90 -850 470 1200" role="img" aria-label="항구와 전망대, 쉼터 도로 지도">
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
        <label className="menu-field">볼륨 <input aria-label="주행 소리 볼륨" type="range" min="0" max="100" value={Math.round((stats.audio?.volume ?? .35) * 100)} onChange={e => runtime.current?.setVolume(Number(e.target.value) / 100)} /></label>
        {stats.audio?.failed && <p role="status">소리가 차단됐습니다. 소리 켜기를 다시 눌러 주세요.</p>}
        <h3>차량 점검</h3><p>최고 {Math.round(stats.peakKmh)} km/h · 접지 {stats.contacts}/4</p>
        <button disabled={stats.kmh >= 1 || cinematic} onClick={() => runtime.current?.setInspection(true)}>정차 후 바퀴 점검</button><p className="setting-hint">속도 1km/h 미만에서 가능합니다. 점검 화면에서는 가속이 차단됩니다.</p>
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
    {touch && !cinematic && !stats?.paused && <div className="driving-controls" aria-label="터치 주행 조작">
      <div className="steering-pad" data-driving-overlay><button aria-label="왼쪽 조향" {...hold('KeyA')}>←</button><button aria-label="오른쪽 조향" {...hold('KeyD')}>→</button></div>
      {!stats?.inspection && <div className="pedal-pad" data-driving-overlay><button className="handbrake" aria-label="핸드브레이크" {...hold('Space')}>핸드<br />브레이크</button><button {...hold('KeyS')}>제동<span>후진</span></button><button className="accelerator" {...hold('KeyW')}>가속</button></div>}
    </div>}
  </main>;
}
