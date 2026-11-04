import * as THREE from 'three';

// Both Blender display planes share this small atlas and a single material.
export function createCockpitDisplay(material,{canvas=typeof document==='undefined'?null:document.createElement('canvas')}={}){
  if(canvas){canvas.width=256;canvas.height=256;}
  const context=canvas?.getContext('2d');
  const texture=context?new THREE.CanvasTexture(canvas):new THREE.DataTexture(new Uint8Array([5,12,18,255]),1,1);
  texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=texture.magFilter=THREE.LinearFilter;
  // glTF uses a downward UV origin; Blender's exporter already flips its UVs.
  texture.flipY=false;texture.generateMipmaps=false;texture.needsUpdate=true;
  material.map=material.emissiveMap=texture;material.color.setRGB(0,0,0);material.emissive.setRGB(1,1,1);
  material.emissiveIntensity=1;material.toneMapped=false;material.needsUpdate=true;
  let lastDraw=-Infinity,lastKey='',readout=null,uploads=0;
  function update(vehicle,music,redline,now,force=false){
    const finite=v=>Number.isFinite(v)?v:0;
    const next={kmh:Math.round(Math.max(0,finite(vehicle?.kmh))),gear:String(vehicle?.gear??'N'),
      rpm:Math.round(Math.max(0,finite(vehicle?.powertrain?.rpm))),redline,
      musicTitle:music?.title||'COASTAL SIX',musicState:music?.playing?'PLAYING':music?.wanted?'PAUSED':'OFF'};
    const key=JSON.stringify(next);
    if(key===lastKey||(!force&&now-lastDraw<100))return;
    readout=next;lastDraw=now;lastKey=key;
    if(context){
      const c=context;c.fillStyle='#050e15';c.fillRect(0,0,256,256);
      c.textAlign='center';c.fillStyle='#769aab';c.font='12px monospace';c.fillText('GEAR',36,21);
      c.fillStyle='#b9e8ee';c.font='bold 43px monospace';c.fillText(next.gear,36,77);
      c.fillStyle='#29414d';c.fillRect(68,14,1,85);
      c.textAlign='right';c.fillStyle='#f3f5f3';c.font='bold 48px monospace';c.fillText(String(next.kmh),239,75);
      c.fillStyle='#769aab';c.font='12px monospace';c.fillText('KM/H',239,94);
      c.textAlign='left';c.fillStyle='#8aafbb';c.font='11px monospace';c.fillText(`${next.rpm} RPM`,12,110);
      c.fillStyle='#1c3542';c.fillRect(12,118,232,3);
      c.fillStyle=next.rpm>=redline-700?'#ffbb84':'#8abecb';c.fillRect(12,118,232*Math.min(1,next.rpm/redline),3);
      c.fillStyle='#6d91a3';c.font='11px monospace';c.fillText('COASTAL / AUDIO',14,155);
      c.fillStyle='#e6eff1';c.font='bold 14px monospace';c.fillText(next.musicTitle.toUpperCase(),14,189);
      c.fillStyle='#9fc8d4';c.font='12px monospace';c.fillText(next.musicState,14,227);
      c.fillStyle='#254653';c.fillRect(201,215,4,12);c.fillRect(211,208,4,19);c.fillRect(221,213,4,14);c.fillRect(231,203,4,24);
    }
    texture.needsUpdate=true;uploads++;
  }
  return {texture,update,status:()=>({readout:readout?{...readout}:null,uploads})};
}
