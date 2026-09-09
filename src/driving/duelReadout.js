import {COAST_ROADS} from './coastRoute.js';
import {SPRINT_GATES} from './sprint.js';
// Project onto the course, not straight-line distance between cars. Clamp to
// validated gate progress so skipping a gate can never manufacture a lead.
export function courseProgress(position,gate){
 const points=COAST_ROADS.harbor;let best=Infinity,s=0;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z;
  const t=Math.max(0,Math.min(1,((position.x-a.x)*dx+(position.z-a.z)*dz)/(dx*dx+dz*dz)));
  const d=(position.x-a.x-t*dx)**2+(position.z-a.z-t*dz)**2;
  if(d<best){best=d;s=a.s+(b.s-a.s)*t;}
 }
 const low=gate?SPRINT_GATES[Math.min(2,gate-1)].s:0,high=SPRINT_GATES[Math.min(2,gate)].s;
 return Math.max(low,Math.min(high,s));
}
export function createDuelReadout(){
 let place=null,message='',until=0,last=0;
 return {update(player,rival,p,r){
  const now=player.elapsed;
  if(now<last||['briefing','countdown'].includes(player.phase)){place=null;message='';until=0;}
  last=now;
  if(!player.valid||!rival.valid){place=null;message='';return {place:null,gap:null,gapLabel:!player.valid?'내 주행 무효':'라이벌 주행 실패',notice:''};}
  if(['briefing','countdown'].includes(player.phase))return {place:null,gap:0,gapLabel:'출발 대기',notice:''};
  if(player.gate===3||rival.gate===3){
   const both=player.gate===3&&rival.gate===3;
   place=both?(Math.abs(player.elapsed-rival.elapsed)<.001?null:player.elapsed<rival.elapsed?1:2):player.gate===3?1:2;
   return {place,gap:null,gapLabel:both?'결승 통과 시간 기준':player.gate===3?'내 차량 피니시':'라이벌 피니시',notice:''};
  }
  const gap=courseProgress(p,player.gate)-courseProgress(r,rival.gate);
  const next=gap>2?1:gap< -2?2:place;
  if(place&&next!==place&&now>2){message=next===1?'추월 성공 · 선두':'역전당함 · 추격!';until=now+1.8;}
  place=next;
  return {place,gap,gapLabel:Math.abs(gap)<=2?'나란히 주행':`${Math.abs(gap).toFixed(0)} m ${gap>0?'앞섬':'뒤처짐'}`,notice:now<until?message:''};
 }};
}
