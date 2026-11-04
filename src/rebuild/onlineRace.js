import {ONLINE_VERSION,ONLINE_STEP_MS,ONLINE_TIMEOUTS,validOnlineConfig,createRemoteInput,sanitizeOnlineInput,validRoom,validVehicle,trackSignature,validOnlineFrame,inviteLink} from './onlineProtocol.js';

// PeerServer brokers the connection; WebRTC carries the race directly between
// browsers. Load the library only when the player creates or joins a room.
export function createOnlineRace({track,onChange=()=>{},onPrepare=()=>{},onGo=()=>{},onFrame=()=>{},onPause=()=>{},onLobby=()=>{},onDisconnect=()=>{},peerFactory,now=()=>performance.now(),timers=globalThis,url=typeof location==='undefined'?'http://localhost/':location.href}={}){
 let peer=null,connection=null,generation=0,timeout=null,ticker=null,lastRx=0,lastInputAt=0,lastFrameAt=0,inputSequence=0,frameSequence=0,lastFrameSequence=-1,readyLocal=false,readyRemote=false,preparedLocal=false,preparedRemote=false,runId=null,config=null;
 let role=null,phase='idle',room='',shareUrl='',vehicle=null,remoteVehicle=null,error='',errorCode='',errorDetails='',signallingDown=false,rtt=null,txBytes=0,rxBytes=0,racePaused=false;
 const remoteInput=createRemoteInput(now);
 const notify=()=>onChange(status());
 function status(){return {phase,role,room,vehicle,remoteVehicle,error,errorCode,errorDetails,signallingDown,readyLocal,readyRemote,connected:!!connection?.open,runId,config,rtt,txBytes,rxBytes,shareUrl};}
 function send(message){if(!connection?.open)return false;const packet={version:ONLINE_VERSION,...message};const size=JSON.stringify(packet).length;if(size>24000||connection.bufferSize>4){if(!['input','frame','ping','pong'].includes(message.type))fail('통신이 지연되어 대결을 중단했습니다. 방을 다시 만들어주세요.');return false;}try{connection.send(packet);txBytes+=size;return true;}catch{fail('상대와 연결이 끊겼습니다.');return false;}}
 function fail(message){if(phase==='idle'||phase==='error')return;timers.clearTimeout(timeout);timers.clearInterval(ticker);error=message;phase='error';remoteInput.clear();readyLocal=readyRemote=false;connection?.close();const failedPeer=peer;peer=null;failedPeer?.destroy();onDisconnect(message);notify();}
 function deadline(phases,ms,message){timers.clearTimeout(timeout);const token=generation;timeout=timers.setTimeout(()=>{if(token===generation&&phases.includes(phase))fail(message);},ms);}
 function prepare(){const token=generation,id=runId;try{Promise.resolve(onPrepare(config)).then(ok=>{if(ok===false&&token===generation&&runId===id&&phase==='preparing')fail('차량과 코스를 준비하지 못했습니다. 대기실에서 다시 시작해주세요.');},()=>{if(token===generation&&runId===id&&phase==='preparing')fail('차량과 코스를 준비하지 못했습니다.');});}catch{fail('차량과 코스를 준비하지 못했습니다.');}}
 function close(){generation++;timers.clearTimeout(timeout);timers.clearInterval(ticker);timeout=ticker=null;const c=connection;connection=null;const p=peer;peer=null;c?.close();p?.destroy();role=null;phase='idle';room=shareUrl='';vehicle=remoteVehicle=null;error=errorCode=errorDetails='';signallingDown=false;readyLocal=readyRemote=false;preparedLocal=preparedRemote=false;runId=config=null;racePaused=false;inputSequence=frameSequence=0;lastFrameSequence=-1;lastInputAt=lastFrameAt=-Infinity;remoteInput.clear({resetSequence:true});rtt=null;txBytes=rxBytes=0;notify();}
 function validateHello(message){return message?.version===ONLINE_VERSION&&message.track===trackSignature(track)&&validVehicle(message.vehicle);}
 function attach(c,token){
  if(connection){c.on('open',()=>{c.send({version:ONLINE_VERSION,type:'reject',reason:'방에 이미 두 사람이 있습니다.'});c.close();});return;}
  connection=c;
  c.on('open',()=>{if(token!==generation)return;lastRx=now();deadline(['hosting','joining'],ONLINE_TIMEOUTS.handshake,'참가 확인 시간이 초과됐습니다. 방을 다시 만들어주세요.');if(role==='guest')send({type:'hello',track:trackSignature(track),vehicle});notify();});
  c.on('data',message=>{
   if(token!==generation||!message||typeof message!=='object'||JSON.stringify(message).length>24000)return;
   rxBytes+=JSON.stringify(message).length;lastRx=now();
   if(message.type==='reject'){fail(message.reason||'방에 참가할 수 없습니다.');return;}
   if(message.version!==ONLINE_VERSION){send({type:'reject',reason:'게임 버전이 다릅니다. 두 사람 모두 새로고침해주세요.'});fail('게임 버전이 다릅니다.');return;}
   if(message.type==='hello'&&role==='host'&&phase==='hosting'){
    if(!validateHello(message)){send({type:'reject',reason:'코스 또는 게임 버전이 다릅니다.'});fail('코스 또는 게임 버전이 다릅니다.');return;}
    remoteVehicle=message.vehicle;phase='lobby';timers.clearTimeout(timeout);send({type:'welcome',track:trackSignature(track),vehicle});notify();return;
   }
   if(message.type==='welcome'&&role==='guest'&&phase==='joining'){
    if(!validateHello(message)){fail('코스 또는 게임 버전이 다릅니다.');return;}
    remoteVehicle=message.vehicle;phase='lobby';timers.clearTimeout(timeout);notify();return;
   }
   if(message.type==='ready'&&phase==='lobby'){readyRemote=message.ready===true;notify();return;}
   if(message.type==='prepare'&&role==='guest'&&phase==='lobby'){
    if(!readyLocal||!readyRemote||typeof message.runId!=='string'||message.runId.length>64||!validOnlineConfig(message.config))return;
    runId=message.runId;config={laps:message.config.laps,weather:message.config.weather};phase='preparing';preparedLocal=preparedRemote=false;lastFrameSequence=-1;remoteInput.clear({resetSequence:true});deadline(['preparing'],ONLINE_TIMEOUTS.prepare,'출발 준비 시간이 초과됐습니다. 대기실에서 다시 시작해주세요.');prepare();notify();return;
   }
   if(message.type==='prepared'&&role==='host'&&message.runId===runId&&phase==='preparing'){preparedRemote=true;beginIfReady();return;}
   if(message.type==='go'&&role==='guest'&&message.runId===runId&&phase==='preparing'&&preparedLocal){timers.clearTimeout(timeout);phase='racing';racePaused=false;onGo();notify();return;}
   if(message.type==='input'&&role==='host'&&message.runId===runId&&phase==='racing'&&!racePaused){remoteInput.receive(message);return;}
   if(message.type==='frame'&&role==='guest'&&message.runId===runId&&phase==='racing'&&message.sequence>lastFrameSequence&&validOnlineFrame(message)){
    lastFrameSequence=message.sequence;lastFrameAt=now();onFrame(message);return;
   }
   if(message.type==='pause-request'&&role==='host'&&message.runId===runId&&phase==='racing'&&typeof message.paused==='boolean'){setPaused(message.paused,'peer');return;}
   if(message.type==='pause'&&role==='guest'&&message.runId===runId&&phase==='racing'&&typeof message.paused==='boolean'){racePaused=message.paused;remoteInput.clear();onPause(racePaused,'peer');notify();return;}
   if(message.type==='lobby-request'&&role==='host'&&message.runId===runId&&phase==='racing'){lobby();return;}
   if(message.type==='lobby'&&role==='guest'&&message.runId===runId&&phase==='racing'){phase='lobby';readyLocal=readyRemote=false;remoteInput.clear();onLobby();notify();return;}
   if(message.type==='recover'&&role==='host'&&message.runId===runId&&phase==='racing'&&!racePaused)onChange({...status(),requestRecovery:true});
   if(message.type==='ping')send({type:'pong',stamp:message.stamp});
   if(message.type==='pong'&&finiteStamp(message.stamp))rtt=Math.max(0,Math.min(10000,now()-message.stamp));
  });
  c.on('close',()=>{if(token===generation&&phase!=='idle')fail('상대가 방을 나갔습니다. 대결을 중단했습니다.');});
  c.on('error',()=>{if(token===generation)fail('연결할 수 없습니다. 초대 코드와 네트워크를 확인해주세요.');});
 }
 const finiteStamp=stamp=>Number.isFinite(stamp)&&stamp>=0;
 async function connect(kind,id,selected){
  close();role=kind;vehicle=selected;phase=kind==='host'?'connecting':'joining';room=kind==='host'?`mumu-${crypto.randomUUID().replaceAll('-','').slice(0,24)}`:typeof id==='string'?id.trim():'';shareUrl=inviteLink(url,room,track.id);notify();
  if(!validVehicle(vehicle)||!validRoom(room)){fail('올바른 초대 코드와 차량을 선택해주세요.');return;}
  const token=generation;
  deadline(['connecting','joining'],ONLINE_TIMEOUTS.connect,'연결 시간이 초과됐습니다. 상대가 방을 열었는지 확인해주세요.');
  try{
   const makePeer=peerFactory??(async id=>{const {Peer}=await import('peerjs');return new Peer(id,{debug:0});});
   const next=await makePeer(kind==='host'?room:undefined);if(token!==generation||phase==='error'){next.destroy();return;}peer=next;
   peer.on('open',()=>{if(token!==generation)return;if(kind==='host'){phase='hosting';timers.clearTimeout(timeout);}else attach(peer.connect(room,{serialization:'json',reliable:true}),token);notify();});
   peer.on('connection',c=>{if(token!==generation||kind!=='host'){c.close();return;}attach(c,token);});
   peer.on('error',e=>{if(token===generation){
    errorCode=String(e.type||'unknown');errorDetails=String(e.message||'').slice(0,180);
    // An established WebRTC channel does not depend on the broker socket.
    // Keep real data-channel pings and the unchanged 8s watchdog in charge.
    if(connection?.open&&['network','socket-error','socket-closed','server-error','disconnected'].includes(e.type)){signallingDown=true;notify();return;}
    fail(e.type==='peer-unavailable'?'방을 찾지 못했습니다. 초대 코드를 확인해주세요.':'온라인 연결을 시작하지 못했습니다. 다시 시도해주세요.');
   }});
   peer.on('disconnected',()=>{if(token===generation&&connection?.open){signallingDown=true;notify();}});
   ticker=timers.setInterval(()=>{if(!connection?.open)return;if(now()-lastRx>ONLINE_TIMEOUTS.silence){fail('상대의 응답이 없어 대결을 중단했습니다.');return;}send({type:'ping',stamp:now()});},1000);
  }catch{if(token===generation)fail('이 브라우저에서 온라인 연결을 시작하지 못했습니다.');}
 }
 function beginIfReady(){if(role==='host'&&phase==='preparing'&&preparedLocal&&preparedRemote&&send({type:'go',runId})){timers.clearTimeout(timeout);phase='racing';racePaused=false;onGo();notify();}}
 function setPaused(value,reason='manual'){if(phase!=='racing'||typeof value!=='boolean')return;remoteInput.clear();if(role==='guest'){send({type:'pause-request',runId,paused:value});return;}if(!send({type:'pause',runId,paused:value}))return;racePaused=value;onPause(value,reason);notify();}
 function lobby(){if(phase!=='racing')return;if(role==='guest'){send({type:'lobby-request',runId});return;}if(!send({type:'lobby',runId}))return;phase='lobby';readyLocal=readyRemote=false;remoteInput.clear();onLobby();notify();}
 return {status,host:id=>connect('host','',id),join:(id,car)=>connect('guest',id,car),close,dispose:close,remoteInput,
  ready(value){if(phase!=='lobby')return;readyLocal=!!value;send({type:'ready',ready:readyLocal});notify();},
  start(next){if(role!=='host'||phase!=='lobby'||!readyLocal||!readyRemote||!validOnlineConfig(next))return false;config={laps:next.laps,weather:next.weather};runId=crypto.randomUUID();phase='preparing';preparedLocal=preparedRemote=false;inputSequence=frameSequence=0;remoteInput.clear({resetSequence:true});if(!send({type:'prepare',runId,config}))return false;deadline(['preparing'],ONLINE_TIMEOUTS.prepare,'출발 준비 시간이 초과됐습니다. 대기실에서 다시 시작해주세요.');prepare();notify();return true;},
  prepared(){if(phase!=='preparing')return;preparedLocal=true;if(role==='guest')send({type:'prepared',runId});else beginIfReady();},
  input(value,force=false){if(role!=='guest'||phase!=='racing'||racePaused||!force&&now()-lastInputAt<ONLINE_STEP_MS)return;lastInputAt=now();send({type:'input',runId,sequence:++inputSequence,input:sanitizeOnlineInput(value)});},
  frame(value){if(role!=='host'||phase!=='racing'||now()-lastFrameAt<ONLINE_STEP_MS)return false;lastFrameAt=now();return send({type:'frame',runId,sequence:++frameSequence,...(typeof value==='function'?value():value)});},
  alpha(spanMs=ONLINE_STEP_MS){return Math.min(1,Math.max(0,(now()-lastFrameAt)/Math.max(5,spanMs)));},pause:setPaused,lobby,recover(){if(phase==='racing'&&!racePaused)send({type:'recover',runId});}
 };
}
