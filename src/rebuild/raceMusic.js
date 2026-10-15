// One local media element; never create a second track on restart or selection.
export function createRaceMusic(source,{makeAudio=src=>new Audio(src),storage=null}={}){
 const tracks=typeof source==='string'?[{id:'seven-mile-horizon',title:'Seven Mile Horizon',genre:'해변 힙합',url:source}]:source;
 if(!tracks?.length)throw new Error('배경음악 목록이 없습니다.');
 const preferenceKey='mumu.circuit.music.v1',getStorage=()=>typeof storage==='function'?storage():storage;
 let track=tracks[0];
 try{const saved=getStorage()?.getItem(preferenceKey);track=tracks.find(t=>t.id===saved)||track;}catch{}
 const media=makeAudio(track.url);media.loop=true;media.preload='none';media.volume=0;
 let wanted=true,master=true,active=false,paused=true,disposed=false,failed=false,blocked=false,volume=.24,playing=false,request=0;
 const allowed=()=>!disposed&&wanted&&master&&active&&!paused;
 function silence(){request++;media.pause();playing=false;media.volume=0;}
 async function play(){
  if(!allowed())return false;
  const ticket=++request;blocked=false;
  try{await media.play();if(disposed||ticket!==request){if(!allowed())media.pause();return false;}playing=true;failed=false;return true;}
  catch(error){if(ticket===request&&!disposed){playing=false;blocked=error?.name==='NotAllowedError';failed=!blocked;}return false;}
 }
 const error=()=>{failed=true;playing=false;};media.addEventListener('error',error);
 return {
  start(){if(disposed)return false;active=true;paused=false;media.currentTime=0;failed=false;return play();},
  stop(){active=false;paused=true;silence();media.currentTime=0;},
  setPaused(value){paused=!!value;if(!allowed())silence();else if(!playing&&!blocked&&!failed)return play();},
  setMaster(value){master=!!value;if(!allowed())silence();else return play();},
  setEnabled(value){wanted=!!value;if(!allowed())silence();else {failed=false;return play();}},
  resume(){if(allowed()){failed=false;return play();}},
  select(id){
   if(disposed)return false;
   const next=tracks.find(t=>t.id===id);if(!next)return false;
   if(next===track)return true;
   silence();track=next;failed=false;blocked=false;media.src=track.url;media.load();media.currentTime=0;
   try{getStorage()?.setItem(preferenceKey,track.id);}catch{}
   if(allowed())return play();
   return true;
  },
  setVolume(value){volume=Math.max(0,Math.min(.6,Number(value)||0));},
  update(dt){if(disposed)return;const target=allowed()&&playing?volume:0;media.volume+=(target-media.volume)*(1-Math.exp(-Math.max(0,dt)/.25));},
  status:()=>({wanted,enabled:wanted&&master,playing:allowed()&&playing&&!media.paused,paused,blocked,failed,volume,time:media.currentTime||0,duration:Number.isFinite(media.duration)?media.duration:0,trackId:track.id,title:track.title,genre:track.genre}),
  dispose(){if(disposed)return;disposed=true;silence();media.removeEventListener('error',error);media.removeAttribute('src');media.load();},
 };
}
