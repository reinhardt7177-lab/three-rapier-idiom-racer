import React,{useState,useEffect,useRef} from 'react';
import {VEHICLES} from './fleet.js';
const names={idle:'초대 링크로 함께 달리세요.',connecting:'방을 만들고 있습니다.',hosting:'친구의 참가를 기다립니다.',joining:'방에 연결하고 있습니다.',lobby:'두 사람이 모였습니다.',preparing:'출발을 준비합니다.',racing:'대결 진행 중',error:'연결이 중단됐습니다.'};
export function OnlineLobby({online,selected,track,onAction,onClose,initialRoom=''}){
 const [code,setCode]=useState(initialRoom),[copied,setCopied]=useState(false),panel=useRef();
 const busy=['connecting','joining','preparing'].includes(online.phase),joined=online.phase==='lobby';
 useEffect(()=>{panel.current.querySelector('button')?.focus();return()=>document.querySelector('.online-launch')?.focus();},[]);
 function keys(e){if(e.key==='Escape'){e.stopPropagation();onClose();}if(e.key==='Tab'){const items=[...panel.current.querySelectorAll('button,input')].filter(i=>!i.disabled),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
 function join(){let value=code.trim();try{value=new URL(value).searchParams.get('room')||value;}catch{}onAction('join',value);}
 async function copy(){try{await navigator.clipboard.writeText(online.shareUrl);setCopied(true);}catch{setCopied(false);}}
 const car=id=>VEHICLES.find(v=>v.id===id)?.name||'참가 대기';
 return <div className="menu-shade settings-shade"><section ref={panel} className="race-menu online-lobby" role="dialog" aria-modal="true" aria-label="온라인 1:1 대기실" onKeyDown={keys}>
  <header><div><span className="kicker">ONLINE / HEAD TO HEAD</span><h2>친구와 1:1.</h2></div><button onClick={onClose}>닫기</button></header>
  <p className="online-status" role="status">{online.error||names[online.phase]} <span>{track.name}</span></p>
  {['idle','error'].includes(online.phase)?<><div className="online-create"><button className="primary" disabled={busy} onClick={()=>onAction('host',selected)}>방 만들기 →</button><label>초대 코드 또는 링크<input aria-label="온라인 초대 코드 또는 링크" value={code} maxLength={400} onChange={e=>setCode(e.target.value)} placeholder="친구에게 받은 초대 코드"/></label><button disabled={busy||!code.trim()} onClick={join}>방 참가 →</button></div></>:<>
   <div className="online-players"><div><span>{online.role==='host'?'방장 · YOU':'참가자 · YOU'}</span><strong>{car(selected)}</strong><small>{online.readyLocal?'준비 완료':'준비 중'}</small></div><div><span>{online.remoteVehicle?'친구':'참가 대기'}</span><strong>{car(online.remoteVehicle)}</strong><small>{online.readyRemote?'준비 완료':online.remoteVehicle?'준비 중':'초대해주세요'}</small></div></div>
   {online.role==='host'&&<div className="online-invite"><label>초대 링크<input readOnly aria-label="온라인 초대 링크" value={online.shareUrl}/></label><button onClick={copy}>{copied?'복사 완료':'초대 링크 복사'}</button><small>초대 코드 <b>{online.room}</b></small></div>}
   <div className="online-actions"><button disabled={!joined} aria-pressed={online.readyLocal} onClick={()=>onAction('ready',!online.readyLocal)}>{online.readyLocal?'준비 취소':'준비 완료'}</button>{online.role==='host'?<button className="primary" disabled={!joined||!online.readyLocal||!online.readyRemote} onClick={()=>{onAction('start');onClose();}}>두 사람 출발 →</button>:<p>방장이 출발하면 함께 시작합니다.</p>}<button onClick={()=>onAction('leave')}>방 나가기</button></div>
  </>}
  <small className="online-help">두 대의 차량이 실제로 충돌합니다. 방장은 게임 창을 열어두세요.<br/>연결이 끊기면 대결을 중단합니다. 일부 네트워크에서는 연결이 제한될 수 있습니다.</small>
 </section></div>;
}
