import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import {createInviteQr} from '../src/rebuild/inviteQr.js';
import {inviteLink} from '../src/rebuild/onlineProtocol.js';

const room='mumu-0123456789abcdef01234567';
// Rasterize the exact path passed to <svg>, then read it with an independent decoder.
function raster(qr,scale=4){
 const width=qr.size*scale,data=new Uint8ClampedArray(width*width*4).fill(255);
 const runs=[...qr.path.matchAll(/M(\d+),(\d+)h(\d+)v1h-(\d+)z/g)];
 assert.equal(runs.map(r=>r[0]).join(''),qr.path);
 for(const [,x,y,w,back] of runs){
  assert.equal(w,back);
  for(let row=Number(y)*scale;row<(Number(y)+1)*scale;row++)for(let col=Number(x)*scale;col<(Number(x)+Number(w))*scale;col++){
   const offset=(row*width+col)*4;data[offset]=data[offset+1]=data[offset+2]=0;
  }
 }
 return {data,width};
}
for(const track of ['coastal','namak','yeosu','seongsamjae'])test(`QR decodes to the exact ${track} room invitation`,()=>{
 const url=inviteLink('https://racing.mumuworld.com/?qaDriver=1&room=obsolete',room,track),qr=createInviteQr(url);
 assert.ok(qr);const {data,width}=raster(qr);
 assert.equal(jsQR(data,width,width,{inversionAttempts:'dontInvert'})?.data,url);
});
test('QR supports local/subdirectory invitations and canonical Unicode URL paths',()=>{
 for(const value of [`http://127.0.0.1:5191/artifacts/online-qr-20261015/game.html?track=namak&room=${room}`,`https://example.com/초대/?track=namak&room=${room}`]){
  const qr=createInviteQr(value),{data,width}=raster(qr);
  assert.equal(jsQR(data,width,width)?.data,new URL(value).href);
 }
});
test('QR has a clear four-module border on every side',()=>{
 const qr=createInviteQr(`https://racing.mumuworld.com/?track=namak&room=${room}`),{data,width}=raster(qr,1);
 assert.equal(qr.quiet,4);assert.equal(qr.size,qr.modules+8);
 for(let y=0;y<width;y++)for(let x=0;x<width;x++)if(x<4||y<4||x>=width-4||y>=width-4)assert.equal(data[(y*width+x)*4],255);
});
test('a new room produces a new readable QR without reusing the previous token',()=>{
 const first=createInviteQr(`https://racing.mumuworld.com/?track=namak&room=${room}`),second=createInviteQr('https://racing.mumuworld.com/?track=namak&room=mumu-abcdef0123456789abcdef01');
 assert.notEqual(first.path,second.path);const {data,width}=raster(second);
 assert.equal(jsQR(data,width,width)?.data,second.value);
});
test('invalid, missing and unsafe invitation URLs show a fallback instead of a broken QR',()=>{
 for(const value of [undefined,null,42,'','not a URL','javascript:alert(1)',`ftp://example.com/?room=${room}`,'https://racing.mumuworld.com/','https://racing.mumuworld.com/?room=1234',`https://example.com/${'a'.repeat(1024)}?room=${room}`])assert.equal(createInviteQr(value),null);
});
