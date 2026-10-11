import {bestRecord,medalFor,medalTimes,LAP_OPTIONS} from './raceRecords.js';
import {TRACKS} from './tracks.js';
import {VEHICLES} from './fleet.js';

// One earned medal per course/lap combination, regardless of colour. Repeating
// the same race upgrades that medal rather than inflating the unlock count.
export const CAR_MEDALS=Object.freeze({rx7:1,m3:2,huracan:4});
export const TRACK_MEDALS=Object.freeze({seongsamjae:1});
export function progressFromRecords(storage){
 const medals=[];
 for(const track of TRACKS)for(const laps of LAP_OPTIONS){
  const record=bestRecord(storage,track.id,laps);
  const medal=record&&record.time>=0?medalFor(record.time,medalTimes(track.id,laps)):null;
  if(medal)medals.push({track:track.id,laps,medal,time:record.time});
 }
 const count=medals.length;
 const cars=VEHICLES.map(v=>({id:v.id,name:v.name,required:CAR_MEDALS[v.id]??0,unlocked:count>=(CAR_MEDALS[v.id]??0)}));
 const tracks=TRACKS.map(t=>({id:t.id,name:t.name,required:TRACK_MEDALS[t.id]??0,unlocked:count>=(TRACK_MEDALS[t.id]??0)}));
 return {count,medals,cars,tracks};
}
export function newlyUnlocked(before,after){
 return ['cars','tracks'].flatMap(kind=>after[kind].filter(item=>item.unlocked&&!before[kind].find(b=>b.id===item.id)?.unlocked).map(item=>({...item,kind})));
}
export const canSelectCar=(progress,id)=>!!progress.cars.find(v=>v.id===id)?.unlocked;
export const canRaceTrack=(progress,id)=>!!progress.tracks.find(t=>t.id===id)?.unlocked;
