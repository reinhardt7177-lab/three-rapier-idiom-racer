import React, { useEffect, useRef, useState } from 'react';
import { createDriving } from './createDriving.js';
import { INTRO_SHOTS } from './story.js';
import { COAST_ROADS, COAST_PADS, coastMapPoint } from './coastRoute.js';

export default function DrivingMode({ color, scenario = 'test', motion = true, onExit }) {
  const host = useRef(null), runtime = useRef(null);
  const [stats, setStats] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    createDriving(host.current, setStats, color, abort.signal, { story: scenario === 'story', coast: scenario === 'coast', motion }).then(result => { if (abort.signal.aborted) result?.dispose(); else runtime.current = result; }).catch(e => { if (!abort.signal.aborted) { console.error(e); setError('주행 화면을 준비하지 못했습니다. 차고로 돌아가 다시 시도해 주세요.'); } });
    return () => { abort.abort(); runtime.current?.dispose(); runtime.current = null; };
  }, [color, scenario, motion]);
  const story = stats?.story;
  const cinematic = story?.phase === 'intro' || story?.phase === 'complete';
  const shot = INTRO_SHOTS[Math.min(2, Math.floor((story?.introTime || 0) / 5))];
  const hold = code => ({
    onPointerDown: e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); runtime.current?.setInput(code, true); },
    onPointerUp: () => runtime.current?.setInput(code, false), onPointerCancel: () => runtime.current?.setInput(code, false), onLostPointerCapture: () => runtime.current?.setInput(code, false),
  });
  const coast = stats?.coast;
  const degrees = i => ((stats?.wheels[i]?.steering || 0) * 180 / Math.PI).toFixed(1);
  return <main className={`drive-mode${scenario === 'story' ? ' story-mode' : ''}${scenario === 'coast' ? ' coast-mode' : ''}${cinematic ? ' cinematic' : ''}`} data-coast-area={coast?.area} data-coast-lookout={coast?.lookout} data-coast-returned={coast?.returned} data-story-phase={story?.phase} data-checkpoint={story?.checkpoint}>
    <div className="scene" ref={host} />
    <header className="drive-heading"><p className="eyebrow">COASTLINE GT / HARBOR AVENUE</p><h1>{scenario === 'coast' ? '바람곶 해안길' : scenario === 'story' ? '첫 번째 호출' : '차량 테스트'}</h1><p>{stats?.sector || '항만대로 · 공도'} · {scenario === 'coast' ? '자유 주행 · 왕복 가능' : scenario === 'story' ? '프롤로그 · 시간제한 없음' : '1.8 km 주행 시험'}</p></header>
    <nav className="drive-actions" aria-label="주행 메뉴"><button onClick={onExit}>차고로 돌아가기</button><button disabled={!stats || !!error} onClick={() => runtime.current?.reset()}>시작점 복귀 · R</button>{scenario === 'coast' && <button disabled={!stats || !!error} onClick={() => runtime.current?.recoverRoad()}>도로 복귀 · C</button>}<button disabled={!stats || !!error} onClick={() => runtime.current?.setPaused(!stats?.paused)}>{stats?.paused ? '계속 주행' : '일시정지'}</button></nav>
    <section className="driving-audio" aria-label="주행 소리 설정">
      <button disabled={!stats || !!error} aria-pressed={!!stats?.audio?.enabled} onClick={() => runtime.current?.setSound(!stats?.audio?.enabled)}>{stats?.audio?.enabled ? '소리 끄기' : '소리 켜기'}</button>
      <label>볼륨 <input aria-label="주행 소리 볼륨" type="range" min="0" max="100" value={Math.round((stats?.audio?.volume ?? .35) * 100)} onChange={e => runtime.current?.setVolume(Number(e.target.value) / 100)} /></label>
      {stats?.audio?.failed && <span role="status">소리 재생이 차단됐습니다. 다시 눌러 주세요.</span>}
    </section>
    <section className="telemetry" aria-label="차량 계기판" data-testid="telemetry" data-contacts={stats?.contacts} data-heading={stats ? Math.atan2(2 * (stats.rotation.x * stats.rotation.z + stats.rotation.w * stats.rotation.y), 1 - 2 * (stats.rotation.x ** 2 + stats.rotation.y ** 2)) : 0} data-draw-calls={stats?.drawCalls} data-camera-distance={stats?.cameraDistance} data-camera-fov={stats?.cameraFov} data-audio-state={stats?.audio?.state} data-x={stats?.position.x} data-z={stats?.position.z} data-speed={stats?.kmh} data-time={stats?.elapsed}>
      <span className="telemetry-label">COASTLINE GT <b>{stats?.gear || 'N'}</b></span>
      <div className="speed-readout"><strong>{Math.round(stats?.kmh || 0)}</strong><span>km/h</span></div>
      <div className="speed-track"><i style={{ width: `${Math.min(100, (stats?.kmh || 0) / 2.4)}%` }} /></div>
      <p>최고 <b>{Math.round(stats?.peakKmh || 0)}</b> km/h <span>접지 {stats?.contacts || 0}/4</span></p>
      <small>{stats?.drifting ? '핸드브레이크 · 후륜 접지 감소' : stats?.brake ? '브레이크' : '물리 속도 · 1 unit = 1 m'}</small>
      <button className="wheel-inspect-toggle" disabled={!stats || !!error || (!stats.inspection && (stats.kmh >= 1 || stats.paused || cinematic))} aria-pressed={!!stats?.inspection} onClick={() => runtime.current?.setInspection(!stats?.inspection)}>{stats?.inspection ? '점검 닫고 주행' : '정차 후 바퀴 점검'}</button>
      {stats?.inspection && <div className="wheel-inspection" aria-label="실제 앞바퀴 조향각" data-left-angle={degrees(3)} data-right-angle={degrees(1)}>
        <strong>정차 점검 · A / D</strong><span>운전자 왼쪽 {degrees(3)}°</span><span>운전자 오른쪽 {degrees(1)}°</span><span>+ 왼쪽 / − 오른쪽 · 후륜 0°</span><span>안쪽 바퀴가 더 꺾입니다.<br />점검을 닫으면 주행합니다.</span>
      </div>}
    </section>
    {coast && !stats?.inspection && <section className="coast-guide" aria-label="해안도로 안내">
      <div><span className="eyebrow">{coast.returned ? 'ROUND TRIP / 왕복 확인' : coast.lookout ? 'RETURN / 항구로' : 'COAST ROAD / 자유 주행'}</span>
      <h2>{coast.returned ? '항구에 돌아왔습니다' : coast.lookout ? '회차 후 항구로 돌아가기' : '갈림길 오른쪽 · 바람곶 전망대'}</h2>
      <p>{coast.offRoad ? '노면을 벗어났습니다. C로 가까운 도로에 복귀하세요.' : coast.lookout ? '왔던 길의 오른쪽 차로로 복귀 · 항구에서 정차' : '코너 진입 전 감속 · 전망대에서 잠시 정차'}<br /><small>권장 40–60 km/h · 교통 AI 없음</small></p></div>
      <svg viewBox="-90 -850 470 1200" role="img" aria-label="항구 출발 방향 기준 오른쪽 전망대, 왼쪽 회차 쉼터 도로 지도">
        {Object.entries(COAST_ROADS).map(([id, points]) => <polyline key={id} points={points.map(p => { const q = coastMapPoint(p); return `${q.x},${q.y}`; }).join(' ')} fill="none" stroke={id === 'rest' ? '#80968a' : '#d8c595'} strokeWidth="12" />)}
        {COAST_PADS.map(p => <circle key={p.id} cx={coastMapPoint(p).x} cy={coastMapPoint(p).y} r="16" fill={p.id === 'lookout' ? '#e1c389' : '#8fa99d'} />)}
        <circle cx={coastMapPoint(stats.position).x} cy={coastMapPoint(stats.position).y} r="15" fill="#f4e4aa" stroke="#234238" strokeWidth="5" />
      </svg>
    </section>}
    {story?.phase === 'drive' && <>
      <section className="story-objective" aria-label="현재 의뢰"><span className="eyebrow">RADIO 03 · {story.distance} m</span><h2>{story.objective}</h2><small>권장 주행 60 km/h · 통행 차량은 아직 없는 시안</small></section>
      <aside className="story-radio" aria-label="무전 자막" role="status"><span>{story.speaker}</span><p>{story.text}</p></aside>
    </>}
    {story?.phase === 'intro' && !stats.paused && <section className="story-cutscene" aria-label="프롤로그 컷신">
      <div className="shot-progress" aria-label={`장면 ${Math.min(3, 1 + Math.floor(story.introTime / 5))} / 3`}>{INTRO_SHOTS.map((_, i) => <i key={i} className={story.introTime >= i * 5 ? 'active' : ''} />)}</div>
      <span className="eyebrow">{shot.speaker}</span><h2>{shot.title}</h2><p>{shot.text}</p>
      <button onClick={() => runtime.current?.skipIntro()}>컷신 건너뛰고 주행 →</button><small>실시간 3D · 15초 · 무전은 자막으로 제공</small>
    </section>}
    {story?.phase === 'complete' && !stats.paused && <section className="story-cutscene story-result" aria-label="의뢰 완료">
      <span className="eyebrow">PROLOGUE COMPLETE / 첫 번째 호출</span><h2>다시 만난 해안의 사람들</h2><p>유나 — “내일 저녁, 차고 앞에서 만나. 이 해안을 달리는 친구들을 소개해 줄게. 네 차고에도 다시 불이 켜졌네.”</p>
      <p className="story-reward">획득한 이야기 기록 · 해안 주행 클럽의 초대</p>
      <button onClick={onExit}>차고로 돌아가 초대 확인</button><button onClick={() => runtime.current?.reset()}>다시 주행하기</button>
      <small role="status">{story.saved ? '완료 기록이 이 브라우저에 저장되었습니다.' : '저장이 차단되었습니다. 이번 방문에서만 완료를 확인할 수 있습니다.'} 다음 장은 아직 제작 전입니다.</small>
    </section>}
    {(!stats || error || stats.paused) && <section className="drive-message" role={error ? 'alert' : 'status'}><h2>{error ? '시작 실패' : stats?.paused ? '잠시 정차합니다' : '차량 준비 중'}</h2><p>{error || (stats?.paused ? '창 전환 시 안전하게 일시정지됩니다.' : '물리엔진과 네 바퀴의 접지를 준비합니다.')}</p>{stats?.paused && <button onClick={() => runtime.current?.setPaused(false)}>주행 재개</button>}</section>}
    <div className="driving-controls" aria-label="터치 주행 조작">
      <div><button aria-label="왼쪽 조향" {...hold('KeyA')}>←</button><button aria-label="오른쪽 조향" {...hold('KeyD')}>→</button></div>
      <div><button {...hold('Space')}>핸드브레이크</button><button {...hold('KeyS')}>제동 / 후진</button><button className="accelerator" {...hold('KeyW')}>가속</button></div>
    </div>
    <p className="drive-help">W / ↑ 가속 · S / ↓ 제동·후진 · A D 조향 · B 제동 · SPACE 핸드브레이크 · R 복귀</p>
  </main>;
}
