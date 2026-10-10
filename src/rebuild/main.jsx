import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createRebuild} from './runtime.js';
import {VEHICLES} from './assets.js';
import {MUSIC_TRACKS} from './musicTracks.js';
import {landscapePresentation,requestLandscapeFullscreen} from './landscape.js';
import {TRACKS,trackFromSearch,trackLink} from './tracks.js';
import {DIFFICULTIES,difficultyById} from './raceDifficulty.js';
import {MEDALS} from './raceRecords.js';
import './rebuild.css';

const time=value=>`${Math.floor(value/60).toString().padStart(2,'0')}:${(value%60).toFixed(2).padStart(5,'0')}`;
const track=trackFromSearch(location.search);
const medalLabel=id=>MEDALS.find(m=>m.id===id)?.label;
const Medal=({id})=>id?<span className={`medal medal-${id}`}>{medalLabel(id)}</span>:null;
function PitMenu({stats,runtime,pauseCopy,expand,fullscreen}){
  return <div className="menu-shade"><section className="race-menu pit-menu" aria-label="일시정지 메뉴">
    <header className="pit-header"><div><span className="kicker">PIT STOP</span><h2>잠시 숨 고르기.</h2><p>{pauseCopy}</p></div><button onClick={expand}>{fullscreen?'전체 화면 종료':'전체 화면'}</button></header>
    <div className="pit-columns">
      <div className="pit-actions"><button className="primary" onClick={()=>runtime.pause()}>주행 재개 →</button><button onClick={()=>runtime.start()}>레이스 다시 시작</button><button onClick={()=>runtime.garage()}>차고로 돌아가기</button><button onClick={()=>runtime.camera()}>시점 전환 · {stats.cameraMode==='first-person'?'1인칭':'3인칭'}</button><button aria-pressed={!!stats.assist} title={stats.assist?'차가 미끄러지면 스스로 자세를 잡습니다':'직접 카운터 스티어해야 하며 스핀할 수 있습니다'} onClick={()=>runtime.assist()}>미끄러짐 보정 · {stats.assist?'켜짐':'꺼짐 (스핀 가능)'}</button></div>
      <div className="pit-settings">
        <button aria-pressed={!!stats.audio?.enabled} onClick={()=>runtime.sound()}>{stats.audio?.failed?'사운드 재시도':stats.audio?.enabled?'사운드 끄기':'사운드 켜기'}<span className="audio-voice">{stats.audio?.voice}</span></button>
        <button aria-pressed={!!stats.music?.wanted} onClick={()=>runtime.music()}>{stats.music?.failed?'음악 재시도':stats.music?.wanted?'배경음악 끄기':'배경음악 켜기'}<span className="audio-voice">{stats.music?.title} · {stats.music?.genre}</span></button>
        <label className="music-choice">배경음악 선택<select aria-label="배경음악 선택" value={stats.music?.trackId||MUSIC_TRACKS[0].id} onChange={e=>runtime.musicTrack(e.target.value)}>{MUSIC_TRACKS.map(t=><option key={t.id} value={t.id}>{t.title} · {t.genre}</option>)}</select></label>
        <label className="music-volume">음악 볼륨 <input aria-label="배경음악 볼륨" type="range" min="0" max="60" value={Math.round((stats.music?.volume??.24)*100)} onChange={e=>runtime.musicVolume(Number(e.target.value)/100)}/></label>
      </div>
    </div><small>WASD 주행 · SHIFT 드리프트 · SPACE 니트로 · C 복귀 · M 음소거 · V 시점<br/>니트로 충전: 드리프트 · 앞차 뒤 슬립스트림 · 추월</small>
  </section></div>;
}
function CourseGuide({guide,region,progress,lap=1,laps=1}){
  const direction=guide?.direction||'straight',bend=direction==='left'||direction==='right';
  const label=bend?`${direction==='left'?'왼쪽':'오른쪽'} 커브`:direction==='finish'?'결승선':'직선 구간';
  const remaining=guide?.remaining??0;
  return <div className={`race-route ${guide?.sharp&&guide.distance<=120?'corner-warning':''}`} aria-label="코스 안내">
    <span>{track.label} / LAP {lap}/{laps}</span>
    <div className="route-summary"><span>{region?.toUpperCase()}</span><b aria-label={`남은 거리 ${Math.ceil(remaining)} 미터`}>{remaining>=1000?`${(remaining/1000).toFixed(2)} KM`:`${Math.ceil(remaining)} M`} <small>남음</small></b></div>
    <div className="corner-guide"><span className={`corner-icon ${direction}`} aria-hidden="true">{direction==='finish'?'⚑':<svg viewBox="0 0 40 36"><path d={bend?'M10 32V16Q10 8 18 8H32M24 1L32 8L24 15':'M20 32V4M10 14L20 4L30 14'}/></svg>}</span><div><strong>{label}</strong><small>{bend?(guide.distance===0?'커브 진행 중':`${guide.distance} M 앞`):direction==='finish'?(remaining===0?'완주':`${Math.ceil(remaining)} M 앞`):'다음 커브를 준비하세요'}{guide?.sharp&&<em>급커브</em>}</small></div></div>
    <div className="course-meter"><i style={{width:`${progress*100}%`}}/></div>
  </div>;
}
function App(){
  useEffect(()=>{document.title=`MUMU CIRCUIT · ${track.label}`;},[]);
  const host=useRef(),runtime=useRef(),viewport=useRef();
  const [presentation,setPresentation]=useState(()=>landscapePresentation(innerWidth,innerHeight,matchMedia('(pointer: coarse)').matches));
  const [fullscreen,setFullscreen]=useState(false),[displayMessage,setDisplayMessage]=useState('');
  const [stats,setStats]=useState({mode:'garage',selected:'supra'}),[ready,setReady]=useState(false),[load,setLoad]=useState({message:'차고 준비 중',progress:0}),[error,setError]=useState('');
  useEffect(()=>{
    const abort=new AbortController();
    createRebuild(host.current,abort.signal,s=>{if(!abort.signal.aborted)setStats(s);},(message,progress)=>{if(!abort.signal.aborted)setLoad({message,progress});},track)
      .then(r=>{if(abort.signal.aborted)r?.dispose();else {runtime.current=r;setReady(!!r);}})
      .catch(e=>{if(!abort.signal.aborted){console.error(e);setError('게임 파일을 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.');}});
    return()=>{abort.abort();runtime.current?.dispose();};
  },[]);
  useEffect(()=>{
    const pointer=matchMedia('(pointer: coarse)');
    const measure=()=>{const {width,height}=viewport.current.getBoundingClientRect();setPresentation(landscapePresentation(width,height,pointer.matches));};
    const observer=new ResizeObserver(measure);observer.observe(viewport.current);pointer.addEventListener('change',measure);measure();
    const changed=()=>{setFullscreen(!!document.fullscreenElement);measure();};
    document.addEventListener('fullscreenchange',changed);
    return()=>{observer.disconnect();pointer.removeEventListener('change',measure);document.removeEventListener('fullscreenchange',changed);};
  },[]);
  useEffect(()=>{runtime.current?.presentation(presentation);},[presentation,ready]);
  useEffect(()=>{if(!displayMessage)return;const timer=setTimeout(()=>setDisplayMessage(''),7000);return()=>clearTimeout(timer);},[displayMessage]);
  async function expand(){
    if(document.fullscreenElement){await document.exitFullscreen().catch(()=>{});return;}
    const state=await requestLandscapeFullscreen(viewport.current);
    setDisplayMessage(state.locked?'가로 화면으로 고정했습니다.':state.fullscreen?'전체 화면입니다. 휴대폰은 가로로 돌려주세요.':'이 브라우저는 전체 화면을 지원하지 않습니다. 휴대폰은 가로로 돌려주세요.');
  }
  const garage=stats.mode==='garage',difficulty=difficultyById(stats.difficulty),vehicle=VEHICLES.find(v=>v.id===stats.selected)||VEHICLES[0];
  const pauseCopy=stats.pauseReason==='layout'?'화면이 바뀌었습니다. 준비되면 주행을 재개하세요.':stats.pauseReason==='focus'?'다녀오셨나요? 준비되면 주행을 재개하세요.':`${track.name} 코스가 기다립니다.`;
  return <div className="game-viewport" ref={viewport} data-orientation={presentation.orientation} data-rotation-required={presentation.blocked}>
  <div className="landscape-stage"><main inert={presentation.blocked||undefined} className={`rebuild-app ${garage?'garage-screen':'race-screen'} ${stats.cameraMode==='first-person'?'camera-first-person':''}`} data-engine="threejs" data-vehicle={vehicle.id} data-mode={stats.mode} data-ready={ready} data-telemetry={JSON.stringify(stats)}>
    <div className="rebuild-canvas" ref={host}/>
    {garage?<>
      <header className="rebuild-brand"><span className="brand-emblem">M</span><div><p>MUMU CIRCUIT</p><span>{track.label} / SEASON 01</span></div></header>
      <nav className="track-selector" aria-label="코스 선택">{TRACKS.map(t=><a key={t.id} href={trackLink(t,location.search)} aria-current={t.id===track.id?'page':undefined}>{t.name}<small>{t.kilometres} KM</small></a>)}</nav>
      <button className="fullscreen-button" onClick={expand}>{fullscreen?'전체 화면 종료':'전체 화면'}</button>
      <div className="garage-heading"><span className="kicker">YOUR GARAGE / 08 CARS</span><h1>시동을 걸 시간.</h1><p>여덟 대의 개성. 다섯 명의 라이벌.<br/>{track.description}</p></div>
      <section className="vehicle-heading" aria-live="polite"><span className="kicker">{vehicle.label}</span><h2>{vehicle.name}</h2><p>드래그로 둘러보기 · 휠로 확대</p></section>
      <nav className="vehicle-selector" aria-label="차량 선택">{VEHICLES.map((v,i)=><button key={v.id} aria-pressed={v.id===stats.selected} disabled={!ready} onClick={()=>runtime.current.select(v.id)}><span className="car-number">0{i+1}</span><span><strong>{v.name}</strong><small>{v.label}</small></span><i style={{background:v.color}}/></button>)}</nav>
      <div className="garage-launch"><span>{track.label} <b>{track.kilometres} KM</b></span><div className="difficulty-selector" role="group" aria-label="라이벌 난이도">{DIFFICULTIES.map(d=><button key={d.id} aria-pressed={d.id===difficulty.id} title={d.description} disabled={!ready} onClick={()=>runtime.current.difficulty(d.id)}>{d.label}</button>)}</div><div className="difficulty-selector lap-selector" role="group" aria-label="랩 수">{(stats.lapOptions||[1,3]).map(n=><button key={n} aria-pressed={n===(stats.laps||1)} disabled={!ready} onClick={()=>runtime.current.laps(n)}>{n} LAP{n>1?'S':''}</button>)}</div><button className="primary" disabled={!ready} onClick={()=>runtime.current.start()}>레이스 시작 <span>→</span></button><small className="best-record">{stats.best?<>BEST <b>{time(stats.best.time)}</b> <Medal id={stats.best.medal}/></>:stats.medals?<>금메달 목표 {time(stats.medals.gold)}</>:null}<br/>맨 뒤 6번 그리드 출발 · {difficulty.description}</small></div>
    </>:<>
      <header className="race-top"><div className="position-card"><span>POSITION</span><strong>{stats.place}<small>/ 6</small></strong></div><CourseGuide guide={stats.guidance} region={stats.region} progress={stats.progress} lap={stats.lap} laps={stats.laps}/><div className="race-clock"><span>RACE TIME</span><strong>{time(stats.elapsed||0)}</strong><button onClick={()=>runtime.current.pause()}>메뉴 <kbd>ESC</kbd></button></div></header>
      <aside className="race-standings" aria-label="레이스 순위">{stats.standings?.map((s,i)=><div key={s.name} className={s.name==='YOU'?'you':''}><span>{i+1}</span><strong>{s.name}</strong>{s.finished&&<small>FINISH</small>}</div>)}{stats.ghost&&<div className="ghost-row"><span>◌</span><strong>GHOST</strong><small>{time(stats.ghost.time)}</small></div>}</aside>
      <div className={`speed-card ${stats.shifting?'gear-shifting':''}`}><span>{stats.gear} <small>GEAR</small></span><strong>{stats.kmh}<small>KM/H</small></strong><div className={`rpm-meter ${(stats.rpm||0)>(stats.redline||6500)-700?'redline':''}`} aria-label={`엔진 ${stats.rpm||850} RPM`}><i style={{width:`${Math.min(100,(stats.rpm||850)/(stats.redline||6500)*100)}%`}}/></div><small className="rpm-label">{(stats.rpm||850).toLocaleString()} RPM</small><div className={`nitro-meter ${stats.draft>.25?'drafting':''}`}><i style={{width:`${(stats.nitro||0)*100}%`}}/></div><small className={stats.nitroBonus?.age<1.6?'nitro-gain':stats.draft>.25?'nitro-draft':''}>{stats.nitroBonus?.age<1.6?`추월 +${stats.nitroBonus.amount} NITRO`:stats.draft>.25?'SLIPSTREAM':<>NITRO <kbd>SPACE</kbd></>}</small></div>
      {(stats.impact?.intensity||0)>.18&&<div className="impact-feedback" style={{opacity:Math.min(.32,stats.impact.intensity*.32)}} aria-hidden="true"/>}
      <div className="race-controls-note">WASD 주행 · SHIFT 드리프트 · SPACE 니트로 · C 도로 복귀 · V 시점</div>
      <button className="camera-switch" aria-label="카메라 시점 전환" aria-pressed={stats.cameraMode==='first-person'} onClick={()=>runtime.current.camera()}>{stats.cameraMode==='first-person'?'1인칭':'3인칭'} <kbd>V</kbd></button>
      {stats.recovery?.age<4&&stats.recovery.reason!=='manual'&&!stats.paused&&<div className="recovery-note" role="status">도로 복귀 완료 · 가속을 다시 눌러주세요</div>}
      {stats.countdown>0&&!stats.paused&&<div className="race-countdown" aria-live="assertive">{stats.countdown}<small>READY TO RACE</small></div>}
      {stats.paused&&<PitMenu stats={stats} runtime={runtime.current} pauseCopy={pauseCopy} expand={expand} fullscreen={fullscreen}/>}
      {stats.result&&!stats.paused&&<div className="menu-shade"><section className="race-menu"><span className="kicker">FINISH / {track.label} / {difficultyById(stats.result.difficulty).label} / {stats.result.laps} LAP{stats.result.laps>1?'S':''}</span><h2>{stats.result.place}위 완주</h2><p className="result-time">{time(stats.result.time)} <Medal id={stats.result.medal}/></p>
      <p className="record-note">{stats.result.improved?<>NEW RECORD{stats.result.previous!==null?` · 이전 ${time(stats.result.previous)}`:''}{stats.result.ghostSaved?' · 다음 레이스에 고스트 등장':''}</>:stats.best?<>BEST {time(stats.best.time)}</>:null}{stats.result.laps>1&&<> · 베스트 랩 {time(stats.result.bestLap)}</>}</p>
      {stats.medals&&<p className="medal-targets">금 {time(stats.medals.gold)} · 은 {time(stats.medals.silver)} · 동 {time(stats.medals.bronze)}</p>}<button className="primary" onClick={()=>runtime.current.start()}>다시 레이스 →</button><button onClick={()=>runtime.current.garage()}>차고로 돌아가기</button></section></div>}
      <div className="touch-controls" aria-label="터치 주행">{[['ArrowLeft','←'],['ArrowRight','→'],['TouchBrake','BRAKE'],['ArrowUp','GAS'],['Space','NITRO']].map(([code,label])=>{
        const release=e=>runtime.current.input(code,false,`pointer-${e.pointerId}`);
        return <button key={code} disabled={stats.paused||!!stats.result} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);runtime.current.input(code,true,`pointer-${e.pointerId}`);}} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>{label}</button>;
      })}<button className="recover-button" aria-label="도로로 복귀" disabled={stats.paused||!!stats.result} onClick={()=>runtime.current.recover()}>복귀</button></div>
    </>}
    {!ready&&!error&&<div className="loading-shade"><section role="status"><span className="kicker">MUMU CIRCUIT</span><h2>{track.name}로 향합니다.</h2><p>{load.message}</p><div className="course-meter"><i style={{width:`${load.progress*100}%`}}/></div></section></div>}
    {error&&<div className="loading-shade"><section role="alert"><h2>출발 준비가 중단됐습니다.</h2><p>{error}</p><button className="primary" onClick={()=>location.reload()}>다시 시도</button></section></div>}
  </main></div>
  {presentation.blocked&&<section className="rotation-gate" role="alert"><svg viewBox="0 0 100 80" aria-hidden="true"><rect x="16" y="22" width="68" height="38" rx="6"/><path d="M68 10H47a31 31 0 0 0-29 18M60 3l8 7-8 8M32 72h21a31 31 0 0 0 29-18M40 65l-8 7 8 7"/></svg><span className="kicker">LANDSCAPE ONLY</span><h2>가로로 돌려주세요.</h2><p>더 넓은 시야로 해안길을 달려요.<br/>주행은 잠시 멈췄습니다.</p><button className="primary" onClick={expand}>전체 화면으로 시작</button></section>}
  {displayMessage&&<p className="display-message" role="status">{displayMessage}</p>}
  </div>;
}
const appRoot=import.meta.hot?.data.root??createRoot(document.getElementById('root'));
if(import.meta.hot)import.meta.hot.data.root=appRoot;
appRoot.render(<App/>);
