import {VEHICLES} from './fleet.js';
export const ONLINE_VERSION=1;
export const ONLINE_STEP_MS=50;
export const INPUT_EXPIRY_MS=350;
export const ZERO_ONLINE_INPUT=Object.freeze({throttle:0,brake:0,reverse:0,steer:0,handbrake:false,boost:false});
const finite=(n,limit=1e6)=>Number.isFinite(n)&&Math.abs(n)<=limit;
const vec=(v,keys)=>v&&keys.every(k=>finite(v[k]));
export const validVehicle=id=>VEHICLES.some(v=>v.id===id);
export const validRoom=id=>typeof id==='string'&&/^mumu-[a-f0-9]{24}$/.test(id.trim());
export const trackSignature=track=>`${track.id}:${track.revision||'base-20261012'}`;
export function sanitizeOnlineInput(value){
 const pedal=n=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;
 return {throttle:pedal(value?.throttle),brake:pedal(value?.brake),reverse:pedal(value?.reverse),steer:Number.isFinite(value?.steer)?Math.max(-1,Math.min(1,value.steer)):0,handbrake:value?.handbrake===true,boost:value?.boost===true};
}
export function createRemoteInput(now=()=>performance.now()){
 let sequence=-1,at=-Infinity,input={...ZERO_ONLINE_INPUT};
 return {receive(message){if(!Number.isSafeInteger(message?.sequence)||message.sequence<=sequence)return false;sequence=message.sequence;at=now();input=sanitizeOnlineInput(message.input);return true;},read(){return now()-at>INPUT_EXPIRY_MS?{...ZERO_ONLINE_INPUT,brake:.35}:{...input};},clear(){sequence=-1;at=-Infinity;input={...ZERO_ONLINE_INPUT};}};
}
export function onlineRoster(hostVehicle,guestVehicle,role='host'){
 if(!validVehicle(hostVehicle)||!validVehicle(guestVehicle))throw Error('Unknown online vehicle');
 const roster=[{id:hostVehicle,name:role==='host'?'YOU':'HOST',player:role==='host',slot:0,peerRole:'host'}, {id:guestVehicle,name:role==='guest'?'YOU':'GUEST',player:role==='guest',slot:1,peerRole:'guest'}];
 return role==='guest'?[roster[1],roster[0]]:roster;
}
// Only visual/telemetry state crosses the wire. The guest sends pedals only;
// its coordinates, lap distance and alleged finish time are never accepted.
export function packOnlineCar(car){
 const s=car.state;
 const state={position:s.position,rotation:s.rotation,velocity:s.velocity,angularVelocity:s.angularVelocity,speed:s.speed,kmh:s.kmh,steer:s.steer,steerInput:s.steerInput,steeringSensitivity:s.steeringSensitivity,steeringLimit:s.steeringLimit,brake:s.brake,drive:s.drive,handbrake:s.handbrake,contacts:s.contacts,draft:s.draft,surface:s.surface,action:s.action,drift:s.drift,launch:s.launch,gear:s.gear,mass:s.mass,powertrain:s.powertrain,ride:s.ride,wheels:s.wheels};
 const rounded=value=>typeof value==='number'?Math.round(value*1e4)/1e4:Array.isArray(value)?value.map(rounded):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rounded(v)])):value;
 // 0.1mm / 0.0001rad precision affects presentation only. Exact finish and lap
 // times stay outside this compact state and are never rounded.
 return {id:car.id,state:rounded(state),index:car.index,progress:car.progress,finish:car.finish,recovery:car.recovery,impact:car.impact,nitroBonus:car.nitroBonus,lapTimes:car.lapTimes};
}
export function validOnlineFrame(frame){
 if(!frame||frame.version!==ONLINE_VERSION||typeof frame.runId!=='string'||!Number.isSafeInteger(frame.sequence)||!finite(frame.elapsed)||frame.elapsed<0||!finite(frame.countdown)||typeof frame.paused!=='boolean'||!Array.isArray(frame.cars)||frame.cars.length!==2)return false;
 return frame.cars.every(c=>{
  const s=c?.state;
  return validVehicle(c.id)&&Number.isSafeInteger(c.index)&&c.index>=0&&finite(c.progress)&& (c.finish===null||finite(c.finish)&&c.finish>=0)&&s&&vec(s.position,['x','y','z'])&&vec(s.rotation,['x','y','z','w'])&&Math.abs(Math.hypot(s.rotation.x,s.rotation.y,s.rotation.z,s.rotation.w)-1)<.02&&vec(s.velocity,['x','y','z'])&&vec(s.angularVelocity,['x','y','z'])&&finite(s.speed)&&finite(s.kmh)&&finite(s.steer)&&Array.isArray(s.wheels)&&s.wheels.length===4&&s.wheels.every(w=>w&&['y','steering','rotation','launchAngle','radius'].every(k=>finite(w[k])));
 });
}
export function inviteLink(url,room,trackId){
 const link=new URL(url);link.search='';link.searchParams.set('track',trackId);link.searchParams.set('room',room);return link.href;
}
