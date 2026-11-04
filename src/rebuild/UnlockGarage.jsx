import React from 'react';
import {VEHICLES} from './fleet.js';
import {TRACKS,trackLink} from './tracks.js';
import {canSelectCar,canRaceTrack} from './progression.js';

export function UnlockCourses({track,search,progression,series,notify}){
 return <nav className="track-selector" aria-label="코스 선택">{TRACKS.map(t=>{
  const unlocked=canRaceTrack(progression,t.id),required=progression.tracks.find(p=>p.id===t.id).required;
  return <a key={t.id} href={trackLink(t,search)} aria-disabled={!unlocked||undefined} title={!unlocked?`메달 ${required}개로 해금`:undefined} onClick={e=>{
   if(!unlocked){e.preventDefault();notify(`메달 ${required}개를 모으면 ${t.name}이 열립니다.`);}
   else if(series){e.preventDefault();notify('시리즈를 나가려면 시리즈 종료를 선택하세요.');}
  }} aria-current={t.id===track.id?'page':undefined}>{t.name}<small>{unlocked?`${t.kilometres} KM`:`잠금 · 메달 ${required}`}</small></a>;
 })}</nav>;
}
export function UnlockVehicles({selected,ready,series,progression,onSelect}){
 return <nav className="vehicle-selector" aria-label="차량 선택">{VEHICLES.map((v,i)=>{
  const unlocked=canSelectCar(progression,v.id),required=progression.cars.find(p=>p.id===v.id).required;
  return <button key={v.id} className={!unlocked?'vehicle-locked':undefined} title={!unlocked?`메달 ${required}개로 ${v.name} 해금`:v.label} aria-pressed={v.id===selected} disabled={!ready||!!series||!unlocked} onClick={()=>onSelect(v.id)}><span className="car-number">0{i+1}</span><span><strong>{v.name}</strong><small>{unlocked?v.label:`잠금 · 메달 ${required}개`}</small></span><i style={{background:v.color}}/></button>;
 })}</nav>;
}
export function ProgressionSummary({progression}){
 return <span className="progression-summary">메달 {progression.count}/8 · 차량 {progression.cars.filter(v=>v.unlocked).length}/8</span>;
}
export function UnlockNote({items}){return items?.length?<span className="unlock-note" role="status">해금 · {items.map(i=>i.name).join(' · ')}</span>:null;}
