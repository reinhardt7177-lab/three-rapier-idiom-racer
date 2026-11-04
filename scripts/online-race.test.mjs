import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {ONLINE_VERSION,ONLINE_TIMEOUTS,sanitizeOnlineInput,createRemoteInput,onlineRoster,packOnlineCar,validOnlineFrame,inviteLink,trackSignature} from '../src/rebuild/onlineProtocol.js';
import {initPhysics,createVehiclePhysics} from '../src/driving/physics.js';
import {createOnlineRace} from '../src/rebuild/onlineRace.js';
import {normalizeRaceSetup} from '../src/rebuild/raceMode.js';
import {duelRecord,submitDuelRecord} from '../src/rebuild/duelRecords.js';
import {progressFromRecords} from '../src/rebuild/progression.js';

const track={id:'namak'},tick=()=>delay(12);
function peers(){
 const registry=new Map();let number=0;
 class Connection extends EventEmitter{
  open=false;bufferSize=0;
  send(value){if(!this.open)throw Error('closed');const copy=JSON.parse(JSON.stringify(value));queueMicrotask(()=>{if(this.other.open)this.other.emit('data',copy);});}
  close(){if(!this.open)return;this.open=false;this.emit('close');if(this.other.open){this.other.open=false;this.other.emit('close');}}
 }
 class Peer extends EventEmitter{
  constructor(id){super();this.id=id||`guest-${++number}`;registry.set(this.id,this);setTimeout(()=>this.emit('open',this.id),0);this.links=[];}
  connect(id){const c=new Connection(),d=new Connection();c.other=d;d.other=c;const target=registry.get(id);this.links.push(c);if(!target){setTimeout(()=>this.emit('error',{type:'peer-unavailable'}),0);return c;}target.links.push(d);target.emit('connection',d);setTimeout(()=>{c.open=d.open=true;d.emit('open');c.emit('open');},0);return c;}
  destroy(){this.links.forEach(c=>c.close());registry.delete(this.id);this.removeAllListeners();}
 }
 const factory=async id=>new Peer(id);factory.registry=registry;return factory;
}
async function pair(extra={}){
 const factory=peers(),host=createOnlineRace({track,peerFactory:factory,...extra.host}),guest=createOnlineRace({track,peerFactory:factory,...extra.guest});
 await host.host('supra');await tick();await guest.join(host.status().room,'gtr');await tick();await tick();
 return {host,guest,close(){host.close();guest.close();},factory};
}
test('online is a real selectable mode; host and guest each see themselves first on distinct grid slots',()=>{
 assert.equal(normalizeRaceSetup({mode:'online'}).mode,'online');
 const a=onlineRoster('supra','gtr','host'),b=onlineRoster('supra','gtr','guest');
 assert.deepEqual(a.map(c=>c.id),['supra','gtr']);assert.deepEqual(b.map(c=>c.id),['gtr','supra']);
 assert.equal(a[0].player,true);assert.equal(b[0].player,true);assert.deepEqual(a.map(c=>c.slot),[0,1]);assert.deepEqual(b.map(c=>c.slot),[1,0]);
 assert.throws(()=>onlineRoster('unknown','gtr'));
});
test('online pedals clamp unsafe values and stale or reordered packets cannot leave throttle held',()=>{
 assert.deepEqual(sanitizeOnlineInput({throttle:Infinity,reverse:-1,brake:7,steer:-99,handbrake:1,boost:true}),{throttle:0,reverse:0,brake:1,steer:-1,handbrake:false,boost:true});
 let time=0;const input=createRemoteInput(()=>time);
 assert.equal(input.receive({sequence:2,input:{throttle:1,steer:.8}}),true);assert.equal(input.read().throttle,1);
 assert.equal(input.receive({sequence:1,input:{throttle:0}}),false);assert.equal(input.read().throttle,1);
 time=351;assert.equal(input.read().throttle,0);assert.equal(input.read().steer,0);assert.equal(input.read().brake,.35);
 input.clear();assert.equal(input.read().boost,false);
});
test('invites preserve the chosen course and discard developer QA flags',()=>{
 const link=new URL(inviteLink('https://example.com/?qaDriver=1&qaPerf=1','mumu-1234567890abcdef12345678','yeosu'));
 assert.equal(link.searchParams.get('track'),'yeosu');assert.equal(link.searchParams.has('qaDriver'),false);assert.equal(link.searchParams.get('room'),'mumu-1234567890abcdef12345678');
 assert.notEqual(trackSignature({id:'yeosu',revision:'new'}),trackSignature({id:'yeosu',revision:'old'}));
});
test('a room requires two real peers ready and prepared before either race starts',async()=>{
 let hostPrepared=0,guestPrepared=0,hostGo=0,guestGo=0;
 const p=await pair({host:{onPrepare(){hostPrepared++;},onGo(){hostGo++;}},guest:{onPrepare(){guestPrepared++;},onGo(){guestGo++;}}});
 try{
  assert.equal(p.host.status().phase,'lobby');assert.equal(p.guest.status().phase,'lobby');assert.equal(p.host.status().remoteVehicle,'gtr');
  assert.equal(p.host.start({laps:1,weather:'clear'}),false);
  p.host.ready(true);p.guest.ready(true);await tick();assert.equal(p.host.start({laps:1,weather:'clear'}),true);await tick();
  assert.equal(hostPrepared,1);assert.equal(guestPrepared,1);assert.equal(hostGo,0);assert.equal(guestGo,0);
  p.host.prepared();assert.equal(hostGo,0);p.guest.prepared();await tick();
  assert.equal(hostGo,1);assert.equal(guestGo,1);assert.equal(p.host.status().runId,p.guest.status().runId);
 }finally{p.close();}
});
test('the guest sends pedals, while shared pause/resume clears them and a rematch resets both ready flags',async()=>{
 const pausedHost=[],pausedGuest=[];
 const p=await pair({host:{onPause:v=>pausedHost.push(v)},guest:{onPause:v=>pausedGuest.push(v)}});
 try{
  p.host.ready(true);p.guest.ready(true);await tick();p.host.start({laps:3,weather:'rain'});await tick();p.host.prepared();p.guest.prepared();await tick();
  p.guest.input({throttle:1,steer:.5,position:{x:99999},finish:1},true);await tick();assert.equal(p.host.remoteInput.read().throttle,1);assert.equal(p.host.remoteInput.read().position,undefined);
  p.guest.pause(true);await tick();assert.deepEqual(pausedHost,[true]);assert.deepEqual(pausedGuest,[true]);assert.equal(p.host.remoteInput.read().throttle,0);
  p.host.pause(false);await tick();assert.deepEqual(pausedGuest,[true,false]);
  p.guest.lobby();await tick();assert.equal(p.host.status().phase,'lobby');assert.equal(p.guest.status().phase,'lobby');assert.equal(p.host.status().readyLocal,false);assert.equal(p.guest.status().readyRemote,false);
 }finally{p.close();}
});
test('a third player is rejected without replacing either participant, and disconnect never invents a finish',async()=>{
 let disconnect=0;const p=await pair({host:{onDisconnect:()=>disconnect++}});
 const third=createOnlineRace({track,peerFactory:p.factory});
 try{await third.join(p.host.status().room,'slk');await tick();await tick();assert.equal(third.status().phase,'error');assert.equal(p.host.status().phase,'lobby');assert.equal(p.host.status().remoteVehicle,'gtr');p.guest.close();await tick();assert.equal(disconnect,1);assert.equal(p.host.status().phase,'error');assert.equal(p.host.status().runId,null);}finally{third.close();p.close();}
});
test('a different track revision cannot join the room',async()=>{
 const factory=peers(),host=createOnlineRace({track:{id:'yeosu',revision:'A'},peerFactory:factory}),guest=createOnlineRace({track:{id:'yeosu',revision:'B'},peerFactory:factory});
 try{await host.host('supra');await tick();await guest.join(host.status().room,'slk');await tick();await tick();assert.equal(host.status().phase,'error');assert.equal(guest.status().phase,'error');}finally{host.close();guest.close();}
});
test('online personal bests are isolated from AI practice and medals',()=>{
 const map=new Map(),s={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)},setup={trackId:'namak',laps:1,player:'supra',opponent:'NOVA',difficulty:'normal',weather:'clear'};
 submitDuelRecord(s,setup,{time:88,outcome:'win'});submitDuelRecord(s,{...setup,mode:'online'},{time:80,outcome:'win'});
 assert.equal(duelRecord(s,setup).best.time,88);assert.equal(duelRecord(s,{...setup,mode:'online'}).best.time,80);assert.equal(progressFromRecords(s).count,0);
 assert.equal(duelRecord(s,{...setup,mode:'online',side:'guest'}),null,'separate grid slots also keep two local tabs from sharing the opponent’s best');
});
test('losing the broker socket preserves an established real data channel and its ready/start flow',async()=>{
 const p=await pair();try{
  p.factory.registry.get(p.host.status().room).emit('error',{type:'network',message:'Lost connection to server.'});
  assert.equal(p.host.status().phase,'lobby');assert.equal(p.host.status().connected,true);assert.equal(p.host.status().signallingDown,true);
  p.host.ready(true);p.guest.ready(true);await tick();assert.equal(p.host.start({laps:1,weather:'clear'}),true);await tick();p.host.prepared();p.guest.prepared();await tick();
  p.guest.input({throttle:1},true);await tick();assert.equal(p.host.remoteInput.read().throttle,1);assert.equal(p.guest.status().phase,'racing');
 }finally{p.close();}
});
test('a compact actual Rapier snapshot is valid, preserves exact finish times and never mutates physics',async()=>{
 await initPhysics();const sim=createVehiclePhysics({barriers:false,arcade:true,launchEnabled:false});
 try{
  for(let i=0;i<180;i++)sim.step({throttle:1,steer:.1});const state=sim.snapshot(),before=JSON.stringify(state),finish=81.123456789;
  const packed=packOnlineCar({id:'supra',state,index:0,progress:30.123456789,finish,lapTimes:[finish]});
  assert.equal(JSON.stringify(state),before);assert.equal(packed.finish,finish);assert.equal(packed.lapTimes[0],finish);
  for(const k of ['x','y','z'])assert.ok(Math.abs(packed.state.position[k]-state.position[k])<=.000051);
  const frame={version:ONLINE_VERSION,runId:'real-physics',sequence:1,elapsed:finish,countdown:0,paused:false,cars:[packed,packed]};
  assert.equal(validOnlineFrame(frame),true);assert.ok(JSON.stringify(frame).length<24000);
  const invalid=structuredClone(frame);invalid.cars[0].state.rotation.w=9;assert.equal(validOnlineFrame(invalid),false);
 }finally{sim.dispose();}
});
test('malformed frame transforms, incomplete wheels and impossible quaternions are rejected',()=>{
 assert.equal(validOnlineFrame({version:ONLINE_VERSION,runId:'x',sequence:1,elapsed:1,countdown:0,paused:false,cars:[]}),false);
 assert.equal(validOnlineFrame({version:999}),false);
});

function manualTimers(){
 let id=0;const timeouts=new Map(),intervals=new Map();
 return {setTimeout(fn,ms){const key=++id;timeouts.set(key,{fn,ms});return key;},clearTimeout:key=>timeouts.delete(key),setInterval(fn){const key=++id;intervals.set(key,fn);return key;},clearInterval:key=>intervals.delete(key),fire(ms){for(const [key,t] of [...timeouts])if(t.ms===ms){timeouts.delete(key);t.fn();}},interval(){for(const fn of [...intervals.values()])fn();},pending:()=>timeouts.size+intervals.size};
}
async function begin(p){p.host.ready(true);p.guest.ready(true);await tick();assert.equal(p.host.start({laps:1,weather:'clear'}),true);await tick();p.host.prepared();p.guest.prepared();await tick();}
const hostWire=p=>p.factory.registry.get(p.host.status().room).links[0];
const inject=(wire,message)=>wire.emit('data',{version:ONLINE_VERSION,...message});

test('an open data channel without hello cannot occupy a room indefinitely',async()=>{
 const timers=manualTimers(),factory=peers(),host=createOnlineRace({track,peerFactory:factory,timers});let peer;
 try{await host.host('supra');await tick();peer=await factory();await tick();peer.connect(host.status().room);await tick();timers.fire(ONLINE_TIMEOUTS.handshake);assert.equal(host.status().phase,'error');assert.match(host.status().error,/참가 확인/);}finally{peer?.destroy();host.close();assert.equal(timers.pending(),0);}
});
test('preparation times out even while the remote peer keeps answering pings',async()=>{
 const timers=manualTimers(),p=await pair({host:{timers}});
 try{p.host.ready(true);p.guest.ready(true);await tick();p.host.start({laps:1,weather:'clear'});await tick();p.host.prepared();timers.interval();await tick();timers.fire(ONLINE_TIMEOUTS.prepare);assert.equal(p.host.status().phase,'error');assert.equal(p.guest.status().phase,'error');}finally{p.close();assert.equal(timers.pending(),0);}
});
test('successful ready barrier cancels the preparation deadline and starts each side once',async()=>{
 const timers=manualTimers();let go=0;const p=await pair({host:{timers,onGo:()=>go++}});
 try{await begin(p);timers.fire(ONLINE_TIMEOUTS.prepare);assert.equal(p.host.status().phase,'racing');assert.equal(go,1);inject(hostWire(p),{type:'prepared',runId:p.host.status().runId});assert.equal(go,1);}finally{p.close();}
});
test('a preparation exception or rejected async task aborts both clients without starting',async()=>{
 for(const callback of [()=>{throw Error('compile failed');},()=>Promise.reject(Error('compile failed')),()=>Promise.resolve(false)]){
  let go=0;const p=await pair({host:{onPrepare:callback,onGo:()=>go++}});
  try{p.host.ready(true);p.guest.ready(true);await tick();p.host.start({laps:1,weather:'clear'});await tick();assert.equal(p.host.status().phase,'error');assert.equal(p.guest.status().phase,'error');assert.equal(go,0);}finally{p.close();}
 }
});
test('a congested control channel cannot silently start only one player',async()=>{
 let go=0;const p=await pair({host:{onGo:()=>go++}});
 try{p.host.ready(true);p.guest.ready(true);await tick();p.host.start({laps:1,weather:'clear'});await tick();p.host.prepared();hostWire(p).bufferSize=5;p.guest.prepared();await tick();assert.equal(p.host.status().phase,'error');assert.equal(p.guest.status().phase,'error');assert.equal(go,0);}finally{p.close();}
});
test('previous-race pause, lobby and recovery controls cannot affect a rematch',async()=>{
 let pauses=0,recoveries=0;const p=await pair({host:{onPause:()=>pauses++,onChange:s=>{if(s.requestRecovery)recoveries++;}}});
 try{await begin(p);const oldRun=p.host.status().runId;p.host.lobby();await tick();await begin(p);assert.notEqual(p.host.status().runId,oldRun);
  for(const type of ['pause-request','lobby-request','recover'])inject(hostWire(p),{type,runId:oldRun,paused:true});
  assert.equal(p.host.status().phase,'racing');assert.equal(pauses,0);assert.equal(recoveries,0);
  p.guest.recover();await tick();assert.equal(recoveries,1);
 }finally{p.close();}
});
test('guest ignores old host controls and go before its renderer is prepared',async()=>{
 let go=0;const p=await pair({guest:{onGo:()=>go++}});
 try{p.host.ready(true);p.guest.ready(true);await tick();p.host.start({laps:1,weather:'clear'});await tick();const wire=hostWire(p).other,runId=p.host.status().runId;
  inject(wire,{type:'go',runId});assert.equal(go,0);assert.equal(p.guest.status().phase,'preparing');p.host.prepared();p.guest.prepared();await tick();assert.equal(go,1);
  inject(wire,{type:'lobby',runId:'previous'});assert.equal(p.guest.status().phase,'racing');
 }finally{p.close();}
});
test('pause rejects held guest pedals; resume requires a newer sequence instead of replaying a queued input',async()=>{
 const p=await pair();try{await begin(p);p.guest.input({throttle:1},true);await tick();p.host.pause(true);await tick();
  const wire=hostWire(p),runId=p.host.status().runId;inject(wire,{type:'input',runId,sequence:100,input:{throttle:1}});assert.equal(p.host.remoteInput.read().throttle,0);
  p.host.pause(false);await tick();inject(wire,{type:'input',runId,sequence:1,input:{throttle:1}});assert.equal(p.host.remoteInput.read().throttle,0);
  p.guest.input({throttle:.4},true);await tick();assert.equal(p.host.remoteInput.read().throttle,.4);
 }finally{p.close();}
});
test('invalid race config and missing room values never strand players in preparation',async()=>{
 const p=await pair();try{p.host.ready(true);p.guest.ready(true);await tick();for(const next of [null,{}, {laps:2,weather:'clear'}, {laps:1,weather:'snow'}])assert.equal(p.host.start(next),false);assert.equal(p.host.status().phase,'lobby');}finally{p.close();}
 const guest=createOnlineRace({track,peerFactory:peers()});try{await guest.join(null,'supra');assert.equal(guest.status().phase,'error');}finally{guest.close();}
});
test('the unchanged eight-second response watchdog aborts instead of assigning a fictitious victory',async()=>{
 let time=0,disconnects=0;const timers=manualTimers(),p=await pair({host:{timers,now:()=>time,onDisconnect:()=>disconnects++}});
 try{await begin(p);time=ONLINE_TIMEOUTS.silence+1;timers.interval();assert.equal(p.host.status().phase,'error');assert.equal(disconnects,1);assert.equal(p.host.remoteInput.read().throttle,0);}finally{p.close();assert.equal(timers.pending(),0);}
});
test('a late peer factory result cannot resurrect a timed-out connection or leak its room',async()=>{
 const timers=manualTimers(),factory=peers();let resolvePeer;
 const host=createOnlineRace({track,timers,peerFactory:()=>new Promise(resolve=>{resolvePeer=resolve;})});
 try{const pending=host.host('supra'),room=host.status().room;timers.fire(ONLINE_TIMEOUTS.connect);assert.equal(host.status().phase,'error');const late=await factory(room);resolvePeer(late);await pending;await tick();assert.equal(host.status().phase,'error');assert.equal(factory.registry.has(room),false);}finally{host.close();}
});
