import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { createGarage } from './garage/createGarage.js';
import { DEFAULT_PREFERENCES, PAINT_COLORS, loadPreferences, savePreferences } from './garage/preferences.js';
import { loadStory } from './driving/story.js';

function initialPreferences() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  try { return loadPreferences(window.localStorage, reduced); }
  catch { return { ...DEFAULT_PREFERENCES, motion: !reduced }; }
}

const DrivingMode = lazy(() => import('./driving/DrivingMode.jsx'));

function GaragePrototype({ onDrive }) {
  const host = useRef(null), garage = useRef(null);
  const [error, setError] = useState('');
  const [preferences, setPreferences] = useState(initialPreferences);
  const initial = useRef(preferences);
  const [saved, setSaved] = useState(true);
  const [photoMode, setPhotoMode] = useState(false);
  const [environmentOpen, setEnvironmentOpen] = useState(false);
  const [view, setView] = useState('garage');
  const [stats, setStats] = useState(null);
  const [firstCallComplete] = useState(() => { try { return loadStory(window.localStorage); } catch { return false; } });
  useEffect(() => {
    try { garage.current = createGarage(host.current, setStats, initial.current); }
    catch (e) { console.error(e); setError('3D 화면을 시작하지 못했습니다. WebGL을 지원하는 브라우저에서 다시 열어 주세요.'); }
    return () => { garage.current?.dispose(); garage.current = null; };
  }, []);
  useEffect(() => {
    try { setSaved(savePreferences(window.localStorage, preferences)); } catch { setSaved(false); }
  }, [preferences]);
  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') { setPhotoMode(false); setEnvironmentOpen(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  function updatePreference(key, value) {
    setPreferences(previous => ({ ...previous, [key]: value }));
    const methods = { color: 'setColor', warm: 'setWarm', wet: 'setWet', shutterOpen: 'setShutterOpen', motion: 'setMotion' };
    garage.current?.[methods[key]](value);
  }
  function chooseView(next) { setView(next); garage.current?.setView(next); }
  return (
    <main className={`prototype${photoMode ? ' photo-mode' : ''}`}>
      <div className="scene" ref={host} />
      <header className="masthead" hidden={photoMode}>
        <div className="brand-mark" aria-hidden="true">M</div>
        <div><p className="eyebrow">COASTLINE GT · HARBOR WORKSHOP</p><h1>항구 정비소</h1><p className="caption">다시 열린 차고. 길 위에서 이어지는 이야기.</p></div>
      </header>
      <aside className="build-note" hidden={photoMode}><span className="live-dot" />자체 제작 차고<span>외부 모델·텍스처 0개</span></aside>
      <button className="photo-toggle" aria-pressed={photoMode} disabled={!!error} onClick={() => { setPhotoMode(!photoMode); setEnvironmentOpen(false); }}>{photoMode ? '차고로 돌아가기 · Esc' : '포토 모드'}</button>
      <section className="garage-story" hidden={photoMode} aria-label="이야기 의뢰">
        <span className="eyebrow">{firstCallComplete ? '초대장 도착 · 프롤로그 완료' : 'PROLOGUE / 01'}</span>
        <h2>{firstCallComplete ? '해안 주행 클럽의 초대' : '첫 번째 호출'}</h2>
        <p>{firstCallComplete ? '첫 만남을 마쳤습니다. 다음 장은 제작 예정입니다.' : '항구 라디오에서 연락이 왔습니다. 방파제 쉼터로 첫 시운전을 떠나세요.'}</p>
        <button className="story-start" disabled={!!error} onClick={() => onDrive({ color: preferences.color, scenario: 'coast', motion: preferences.motion })}>해안도로 드라이브 →</button>
        <button className="garage-test-link" disabled={!!error} onClick={() => onDrive({ color: preferences.color, scenario: 'story', motion: preferences.motion })}>{firstCallComplete ? '프롤로그 다시 보기 →' : '첫 번째 호출 시작 →'}</button>
        <button className="garage-test-link" disabled={!!error} onClick={() => onDrive({ color: preferences.color, scenario: 'test' })}>GT 테스트 주행 →</button>
      </section>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="scene-label" hidden={photoMode}><span>01 / COASTLINE GT</span><p>{PAINT_COLORS.find(([hex]) => hex === preferences.color)?.[1]} · 코드로 빚은 첫 번째 자동차</p></div>
      <section className="toolbar" aria-label="차고 시안 설정" hidden={photoMode}>
        <div className="control-group"><span className="control-label">차체 색상</span><div className="swatches">
          {PAINT_COLORS.map(([hex, label]) => <button key={hex} className="swatch" style={{ '--swatch': hex }} aria-label={label} aria-pressed={preferences.color === hex} disabled={!!error} onClick={() => updatePreference('color', hex)} />)}
        </div></div>
        <div className="control-group camera-controls"><span className="control-label">카메라</span><div className="button-row">
          {[['garage', '차고 전체'], ['car', '차량 가까이'], ['side', '측면'], ['harbor', '항구 풍경']].map(([id, label]) => <button key={id} aria-pressed={view === id} disabled={!!error} onClick={() => chooseView(id)}>{label}</button>)}
        </div></div>
        <div className="control-group"><span className="control-label">공간</span><div className="button-row">
          <button aria-pressed={preferences.shutterOpen} disabled={!!error} onClick={() => updatePreference('shutterOpen', !preferences.shutterOpen)}>{preferences.shutterOpen ? '셔터 닫기' : '셔터 열기'}</button>
          <button aria-expanded={environmentOpen} aria-controls="environment-controls" disabled={!!error} onClick={() => setEnvironmentOpen(!environmentOpen)}>환경 설정</button>
        </div></div>
      </section>
      <section className="environment-panel" id="environment-controls" aria-label="환경 설정" hidden={photoMode || !environmentOpen}>
        <div className="panel-heading"><span>빛과 움직임</span><button aria-label="환경 설정 닫기" onClick={() => setEnvironmentOpen(false)}>닫기</button></div>
        <div className="button-row">
          <button aria-pressed={preferences.warm} disabled={!!error} onClick={() => updatePreference('warm', !preferences.warm)}>{preferences.warm ? '정비등 켜짐' : '중립 조명'}</button>
          <button aria-pressed={preferences.wet} disabled={!!error} onClick={() => updatePreference('wet', !preferences.wet)}>바닥 반사 {preferences.wet ? '켜짐' : '꺼짐'}</button>
          <button aria-pressed={!preferences.motion} disabled={!!error} onClick={() => updatePreference('motion', !preferences.motion)}>움직임 줄이기 {preferences.motion ? '꺼짐' : '켜짐'}</button>
        </div>
        <p role="status">{saved ? '색상과 환경 설정은 이 브라우저에 저장됩니다.' : '저장이 차단되어 이번 방문에만 적용됩니다.'}</p>
      </section>
      <footer hidden={photoMode}><span>드래그 · 휠로 확대 / 프롤로그·공도 주행 시안</span><span>{stats ? `${stats.fps} FPS · 순간 측정` : '3D 화면 준비 중'} · {saved ? '설정 저장됨' : '설정 저장 불가'}</span></footer>
    </main>
  );
}

function App() {
  const [drive, setDrive] = useState(null);
  return drive ? <Suspense fallback={<div className="drive-message">주행 모듈 준비 중…</div>}><DrivingMode {...drive} onExit={() => setDrive(null)} /></Suspense> : <GaragePrototype onDrive={setDrive} />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
