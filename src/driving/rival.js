import {COAST_ROADS,offsetPoint} from './coastRoute.js';
import {steeringLimit} from './steering.js';
import {createVehiclePhysics,STEP} from './physics.js';
import {newSprint,updateSprint} from './sprint.js';

// Non-contact duel prototype: independent Rapier world, same car and road.
// No transform writes after reset, rubber-banding or scripted finish time.
export function createRivalDriver(lane=-3.5){
 const points=COAST_ROADS.harbor.filter(p=>p.z>=-725).map(p=>({...p,...offsetPoint(p,lane)}));
 let index=0;
 return {reset(){index=0;},input(state){
  const p=state.position;let distance=Infinity,nearest=index;
  for(let j=Math.max(0,index-3);j<Math.min(points.length,index+50);j++){
   const d=Math.hypot(points[j].x-p.x,points[j].z-p.z);if(d<distance){distance=d;nearest=j;}
  }
  index=nearest;let target=index,travel=0;
  while(target<points.length-1&&travel<9+state.kmh/3.6*.45){travel+=Math.hypot(points[target+1].x-points[target].x,points[target+1].z-points[target].z);target++;}
  const q=state.rotation,yaw=Math.atan2(2*(q.x*q.z+q.w*q.y),1-2*(q.x*q.x+q.y*q.y));
  const t=points[target],a=Math.atan2(t.x-p.x,t.z-p.z)-yaw;
  const err=Math.atan2(Math.sin(a),Math.cos(a));
  const steer=Math.max(-1,Math.min(1,-Math.atan(2*2.84*Math.sin(err)/Math.max(3,Math.hypot(t.x-p.x,t.z-p.z)))/steeringLimit(state.kmh/3.6)));
  const s=points[index].s,desired=s<335?140:s<405?80:s<690?60:100;
  return {steer,throttle:state.kmh<desired?1:0,brake:state.kmh>desired+2?1:0};
 }};
}
export function duelResult(player,rival){
 if(!player.valid)return '무효 · 재도전';
 if(rival.valid&&rival.gate===3)return Math.abs(player.elapsed-rival.elapsed)<.001?'무승부':player.elapsed<rival.elapsed?'승리':'패배';
 return rival.valid?'승리':'완주 · 라이벌 주행 실패';
}
export function createRival(){
 const sim=createVehiclePhysics({coast:true,arcade:true,start:{x:3.5,y:.8,z:-720}}),driver=createRivalDriver();
 let current,previous,race;
 function reset(){sim.reset();driver.reset();for(let i=0;i<120;i++)sim.step({brake:1});current=previous=sim.snapshot();race={...newSprint(),phase:'running'};}
 reset();
 return {reset,step(){
  if(race.phase==='complete')return;
  previous=current;current=sim.step(race.phase==='running'&&race.valid?driver.input(current):{brake:1});
  race=updateSprint(race,previous,current,STEP);
  if(race.phase==='running'&&(!race.valid||race.elapsed>=90))race={...race,valid:false,phase:'cooldown',reason:'라이벌 주행 실패'};
 },get state(){return current;},get previous(){return previous;},get race(){return race;},dispose(){sim.dispose();}};
}
