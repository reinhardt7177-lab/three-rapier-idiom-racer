import React,{useEffect,useRef} from 'react';
import {RACE_MODES,raceRoster} from './raceMode.js';
import {RIVAL_PERSONALITIES} from './rivalPersonalities.js';
import {VEHICLES} from './fleet.js';

export function RaceSetup({setup,selected,onChange,onClose}){
 const panel=useRef();
 useEffect(()=>{panel.current.querySelector('button')?.focus();return()=>document.querySelector('.race-mode-button')?.focus();},[]);
 function keys(e){
  if(e.key==='Escape'){e.stopPropagation();onClose();}
  if(e.key==='Tab'){const items=[...panel.current.querySelectorAll('button,select')].filter(i=>!i.disabled),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
 }
 const rival=raceRoster(selected,{mode:'duel',opponent:setup.opponent})[1],vehicle=VEHICLES.find(v=>v.id===rival.id);
 return <div className="menu-shade settings-shade"><section ref={panel} className="race-menu race-setup" role="dialog" aria-modal="true" aria-label="대전 모드 설정" onKeyDown={keys}>
  <header><div><span className="kicker">CHOOSE YOUR RACE</span><h2>이번 승부는?</h2></div><button onClick={onClose}>닫기</button></header>
  <div className="race-mode-options" role="group" aria-label="대전 모드">{RACE_MODES.map(mode=><button key={mode.id} aria-pressed={setup.mode===mode.id} onClick={()=>onChange({mode:mode.id})}><strong>{mode.label}</strong><small>{mode.description}</small></button>)}</div>
  {setup.mode==='online'?<p>방을 만든 뒤 초대 링크나 코드를 친구에게 전달하세요.<br/>두 사람 모두 준비를 마치면 방장이 출발합니다. 온라인 기록은 따로 저장됩니다.</p>:setup.mode==='duel'?<><label className="duel-opponent">상대 라이벌<select aria-label="1:1 상대 라이벌" value={setup.opponent} onChange={e=>onChange({opponent:e.target.value})}>{RIVAL_PERSONALITIES.map(p=><option key={p.name} value={p.name}>{p.name} · {p.label}</option>)}</select></label><p className="duel-opponent-car">YOU vs {rival.name} · {vehicle.name}</p><p>두 대만 출발합니다. 먼저 결승선을 통과하면 승리!<br/>대결 기록은 따로 저장되며, 메달은 6대 레이스에서 획득합니다.</p></>:<p>맨 뒤 6번 그리드에서 출발합니다.<br/>메달을 모아 차량과 코스를 열어보세요.</p>}
  <button className="primary" onClick={onClose}>선택 완료 →</button>
 </section></div>;
}
