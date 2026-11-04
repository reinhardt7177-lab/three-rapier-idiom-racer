import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRaceMusic} from '../src/rebuild/raceMusic.js';
import {MUSIC_TRACKS} from '../src/rebuild/musicTracks.js';

const tracks=MUSIC_TRACKS.map(t=>({...t,url:`/assets/audio/${t.file}`}));
function setup(storage=null){
 let count=0;
 const media={src:'',paused:true,volume:0,currentTime:0,duration:60,loads:0,plays:0,events:new Map(),
  play(){this.plays++;this.paused=false;return Promise.resolve();},pause(){this.paused=true;},
  load(){this.loads++;this.paused=true;this.duration=NaN;},removeAttribute(){this.src='';},
  addEventListener(e,f){this.events.set(e,f);},removeEventListener(e){this.events.delete(e);}};
 const music=createRaceMusic(tracks,{storage,makeAudio:url=>{count++;media.src=url;return media;}});
 return {media,music,count:()=>count};
}

test('paused track selection changes one media source without autoplay; resume, restart and garage keep the choice',async()=>{
 const {media,music,count}=setup();await music.start();media.currentTime=20;music.setVolume(.41);music.setPaused(true);
 await music.select('slipstream-pursuit');assert.equal(media.src,tracks[1].url);assert.equal(media.currentTime,0);assert.equal(media.plays,1);assert.ok(media.paused);
 assert.equal(music.status().title,'Slipstream Pursuit');assert.equal(music.status().volume,.41);
 await music.resume();assert.ok(media.paused,'resume cannot bypass menu pause');
 await music.setPaused(false);assert.ok(music.status().playing);
 music.stop();await music.start();assert.equal(music.status().trackId,'slipstream-pursuit');assert.equal(count(),1);
 music.dispose();assert.equal(await music.select(tracks[0].id),false);
});

test('changing tracks while music or master sound is disabled never re-enables sound',async()=>{
 for(const control of ['setEnabled','setMaster']){
  const {media,music}=setup();await music.start();music[control](false);await music.select(tracks[1].id);
  music.update(1);assert.equal(media.volume,0);assert.ok(media.paused);assert.equal(media.plays,1);
  await music.start();assert.ok(media.paused);await music[control](true);assert.ok(music.status().playing);
  music.dispose();
 }
});

test('active switching resets time and gain on the same element; same or unknown choices leave the playhead alone',async()=>{
 const {media,music,count}=setup();await music.start();music.update(1);assert.ok(media.volume>0);
 media.currentTime=16;await music.select(tracks[0].id);assert.equal(media.currentTime,16);assert.equal(media.loads,0);
 assert.equal(await music.select('not-a-track'),false);assert.equal(media.currentTime,16);
 await music.select(tracks[1].id);assert.equal(media.currentTime,0);assert.equal(media.volume,0);assert.ok(music.status().playing);
 assert.equal(media.loads,1);assert.equal(count(),1);music.update(1);assert.ok(media.volume>.2&&media.volume<.25);
 music.dispose();assert.equal(media.events.size,0);
});

test('a rejected play promise from the old track cannot mark the newly selected track failed',async()=>{
 const {media,music}=setup();let reject;
 media.play=()=>new Promise((resolve,r)=>reject=r);const old=music.start();
 media.play=()=>{media.paused=false;return Promise.resolve();};await music.select(tracks[1].id);
 reject(new Error('old source aborted'));await old;
 assert.equal(music.status().failed,false);assert.ok(music.status().playing);assert.equal(music.status().trackId,tracks[1].id);
 music.dispose();
});

test('track choice survives a new runtime, while invalid preferences and blocked storage safely use defaults',async()=>{
 const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,v)=>values.set(key,v)};
 const a=setup(storage);await a.music.select(tracks[1].id);a.music.dispose();
 const b=setup(()=>storage);assert.equal(b.media.src,tracks[1].url);assert.equal(b.music.status().playing,false);b.music.dispose();
 values.set('mumu.circuit.music.v1','unknown');const c=setup(storage);assert.equal(c.music.status().trackId,tracks[0].id);c.music.dispose();
 const d=setup(()=>{throw Error('storage disabled');});assert.equal(d.music.status().trackId,tracks[0].id);
 await d.music.select(tracks[1].id);assert.equal(d.music.status().trackId,tracks[1].id);d.music.dispose();
});

test('both published catalog entries resolve to distinct packaged MP3 files containing their actual titles',()=>{
 assert.equal(MUSIC_TRACKS.length,2);const files=[];
 for(const track of MUSIC_TRACKS){
  const bytes=fs.readFileSync(new URL(`../public/assets/audio/${track.file}`,import.meta.url));
  assert.equal(bytes.subarray(0,3).toString(),'ID3');assert.ok(bytes.length>1_000_000);assert.ok(bytes.includes(Buffer.from(track.title)));
  files.push(bytes);
 }
 assert.notDeepEqual(files[0],files[1]);
});
