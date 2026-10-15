import React,{useState,useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {VEHICLES} from './fleet.js';
import OnlineInviteQR from './OnlineInviteQR.jsx';
const names={idle:'초대 링크로 함께 달리세요.',connecting:'방을 만들고 있습니다.',hosting:'친구의 참가를 기다립니다.',joining:'방에 연결하고 있습니다.',lobby:'두 사람이 모였습니다.',preparing:'출발을 준비합니다.',racing:'대결 진행 중',error:'연결이 중단됐습니다.'};
export function OnlineLobby({online,selected,track,onAction,onClose,initialRoom=''}){
 const [code,setCode]=useState(initialRoom),[copied,setCopied]=useState(false),[showQr,setShowQr]=useState(false),panel=useRef(),qrBack=useRef(),qrTrigger=useRef(),wasQr=useRef(false);
 const busy=['connecting','joining','preparing'].includes(online.phase),joined=online.phase==='lobby';
 const qrVisible=showQr&&online.role==='host'&&!!online.shareUrl&&!['idle','error'].includes(online.phase);
 useEffect(()=>{panel.current.querySelector('button')?.focus();return()=>document.querySelector('.online-launch')?.focus();},[]);
 useEffect(()=>{setCopied(false);setShowQr(false);},[online.shareUrl]);
 useEffect(()=>{if(qrVisible)qrBack.current?.focus();else if(wasQr.current)qrTrigger.current?.focus();wasQr.current=qrVisible;},[qrVisible]);
 function keys(e){if(e.key==='Escape'){e.stopPropagation();if(qrVisible)setShowQr(false);else onClose();}if(e.key==='Tab'){const items=[...panel.current.querySelectorAll('button,input')].filter(i=>!i.disabled&&i.getClientRects().length),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}
 function join(){let value=code.trim();try{value=new URL(value).searchParams.get('room')||value;}catch{}onAction('join',value);}
 async function copy(){try{await navigator.clipboard.writeText(online.shareUrl);setCopied(true);}catch{setCopied(false);}}
 const car=id=>VEHICLES.find(v=>v.id===id)?.name||'참가 대기';
 const content=<div className={`menu-shade settings-shade${qrVisible?' online-qr-overlay':''}`}><section ref={panel} className={`race-menu online-lobby${qrVisible?' online-qr-view':''}`} role="dialog" aria-modal="true" aria-label="온라인 1:1 대기실" onKeyDown={keys}>
  <header><div><span className="kicker">ONLINE / HEAD TO HEAD</span><h2>{qrVisible?'QR로 친구 초대.':'친구와 1:1.'}</h2></div><button ref={qrBack} onClick={()=>qrVisible?setShowQr(false):onClose()}>{qrVisible?'뒤로':'닫기'}</button></header>
  {qrVisible?<div className="online-qr-content">
   <div className="online-qr-code"><OnlineInviteQR url={online.shareUrl}/></div>
   <div className="online-qr-instructions"><strong>카메라로 스캔하고<br/>함께 출발하세요.</strong><p>친구 휴대폰의 카메라로 QR을 비추고 링크를 열어주세요.</p><small role="status">{online.remoteVehicle?'친구가 참가했습니다. 뒤로 돌아가 준비해주세요.':'친구의 참가를 기다립니다. 이 창을 열어두세요.'}</small><button onClick={copy}>{copied?'복사 완료':'초대 링크 복사'}</button><button onClick={()=>setShowQr(false)}>대기실로 돌아가기</button></div>
  </div>:<>
  <p className="online-status" role="status">{online.error||names[online.phase]} <span>{track.name}</span></p>
  {['idle','error'].includes(online.phase)?<><div className="online-create"><button className="primary" disabled={busy} onClick={()=>onAction('host',selected)}>방 만들기 →</button><label>초대 코드 또는 링크<input aria-label="온라인 초대 코드 또는 링크" value={code} maxLength={400} onChange={e=>setCode(e.target.value)} placeholder="친구에게 받은 초대 코드"/></label><button disabled={busy||!code.trim()} onClick={join}>방 참가 →</button></div></>:<>
   <div className="online-players"><div><span>{online.role==='host'?'방장 · YOU':'참가자 · YOU'}</span><strong>{car(selected)}</strong><small>{online.readyLocal?'준비 완료':'준비 중'}</small></div><div><span>{online.remoteVehicle?'친구':'참가 대기'}</span><strong>{car(online.remoteVehicle)}</strong><small>{online.readyRemote?'준비 완료':online.remoteVehicle?'준비 중':'초대해주세요'}</small></div></div>
   {online.role==='host'&&<div className="online-invite"><label>초대 링크<input readOnly aria-label="온라인 초대 링크" value={online.shareUrl}/></label><div className="online-invite-buttons"><button ref={qrTrigger} className="primary" disabled={!online.shareUrl||online.phase==='connecting'} onClick={()=>setShowQr(true)}>QR로 초대</button><button onClick={copy}>{copied?'복사 완료':'초대 링크 복사'}</button></div><small>초대 코드 <b>{online.room}</b></small></div>}
   <div className="online-actions"><button disabled={!joined} aria-pressed={online.readyLocal} onClick={()=>onAction('ready',!online.readyLocal)}>{online.readyLocal?'준비 취소':'준비 완료'}</button>{online.role==='host'?<button className="primary" disabled={!joined||!online.readyLocal||!online.readyRemote} onClick={()=>{onAction('start');onClose();}}>두 사람 출발 →</button>:<p>방장이 출발하면 함께 시작합니다.</p>}<button onClick={()=>onAction('leave')}>방 나가기</button></div>
  </>}
  <small className="online-help">두 대의 차량이 실제로 충돌합니다. 방장은 게임 창을 열어두세요.<br/>연결이 끊기면 대결을 중단합니다. 일부 네트워크에서는 연결이 제한될 수 있습니다.</small>
  </>}
 </section></div>;
 return qrVisible?createPortal(content,document.body):content;
}
