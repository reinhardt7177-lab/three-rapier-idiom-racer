import React,{useEffect,useState} from 'react';

export default function OnlineInviteQR({url}){
 const [result,setResult]=useState(null);
 useEffect(()=>{
  let current=true;
  import('./inviteQr.js').then(({createInviteQr})=>{if(current)setResult({url,qr:createInviteQr(url)});}).catch(()=>{if(current)setResult({url,qr:null});});
  return()=>{current=false;};
 },[url]);
 if(!result||result.url!==url)return <p role="status">QR 생성 중…</p>;
 const {qr}=result;
 if(!qr)return <p role="status">QR을 표시하지 못했습니다. 초대 링크를 복사해 주세요.</p>;
 return <svg className="online-qr-image" role="img" aria-label="친구 초대 QR 코드" viewBox={`0 0 ${qr.size} ${qr.size}`} width={qr.size*4} height={qr.size*4} shapeRendering="crispEdges">
  <title>휴대폰 카메라로 스캔하면 이 대기실에 참가합니다.</title>
  <rect width={qr.size} height={qr.size} fill="#fff"/>
  <path d={qr.path} fill="#000"/>
 </svg>;
}
