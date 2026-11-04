import qrcode from 'qrcode-generator';
import {validRoom} from './onlineProtocol.js';

// Encode locally: invite tokens must never be sent to an external QR service.
export function createInviteQr(value){
 if(typeof value!=='string'||value.length>1024)return null;
 try{
  const url=new URL(value);
  if(!['http:','https:'].includes(url.protocol)||!validRoom(url.searchParams.get('room')))return null;
  const qr=qrcode(0,'M');
  qr.addData(url.href,'Byte');qr.make();
  const modules=qr.getModuleCount(),quiet=4,size=modules+quiet*2;
  let path='';
  for(let row=0;row<modules;row++){
   for(let col=0;col<modules;){
    if(!qr.isDark(row,col)){col++;continue;}
    const start=col;while(col<modules&&qr.isDark(row,col))col++;
    const width=col-start;path+=`M${start+quiet},${row+quiet}h${width}v1h-${width}z`;
   }
  }
  return {value:url.href,size,modules,quiet,path};
 }catch{return null;}
}
