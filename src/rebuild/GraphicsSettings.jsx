import React,{useEffect,useRef} from 'react';
import {GRAPHICS_QUALITIES} from './graphicsQuality.js';
import {MOTION_SETTINGS} from './drivingMotionPreference.js';
const descriptions={high:'선명한 화면 · 2048 그림자 · 고스트',medium:'균형 있는 화면 · 1024 그림자 · 고스트',low:'가벼운 화면 · 그림자와 고스트 끔 · 가까운 장식'};
export function GraphicsSettings({quality,onChange,onClose,motionSetting='auto',onMotion,children}){
 const panel=useRef();
 useEffect(()=>{panel.current.querySelector('button')?.focus();return()=>document.querySelector('.environment-settings-button')?.focus();},[]);
 function keys(e){if(e.key==='Escape'){e.stopPropagation();onClose();}if(e.key==='Tab'){const items=[...panel.current.querySelectorAll('button,select,input')].filter(i=>!i.disabled),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
 return <div className="menu-shade settings-shade"><section ref={panel} className="race-menu graphics-settings" role="dialog" aria-modal="true" aria-label="그래픽 설정" onKeyDown={keys}>
  <header><div><span className="kicker">GARAGE SETTINGS</span><h2>나에게 맞는 화면.</h2></div><button onClick={onClose}>닫기</button></header>
  <div role="group" aria-label="그래픽 품질" className="quality-options">{GRAPHICS_QUALITIES.map(q=><button key={q.id} aria-pressed={quality===q.id} onClick={()=>onChange(q.id)}><strong>{q.label}</strong><small>{descriptions[q.id]}</small></button>)}</div>
  <div role="group" aria-label="주행 움직임" className="weather-options motion-options"><span>주행 움직임</span>{MOTION_SETTINGS.map(m=><button key={m.id} aria-pressed={motionSetting===m.id} onClick={()=>onMotion?.(m.id)}>{m.label}</button>)}</div>
  <p>자동은 기기 설정을 따릅니다. 줄임은 차체 기울기를 낮추고 카메라 흔들림을 끕니다.</p>
  {children}<p>선택한 설정은 이 브라우저에 저장됩니다.</p>
 </section></div>;
}
