import * as THREE from 'three';

// Small, shared tangent-space grain. No image downloads or per-frame noise.
export function finishCockpitSurfaces(root){
  const size=128,data=new Uint8Array(size*size*4);let seed=371;
  for(let i=0;i<size*size;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const j=i*4;data[j]=124+(seed&7);data[j+1]=124+((seed>>>8)&7);data[j+2]=255;data[j+3]=255;
  }
  const grain=new THREE.DataTexture(data,size,size);grain.wrapS=grain.wrapT=THREE.RepeatWrapping;
  grain.repeat.set(12,12);grain.magFilter=grain.minFilter=THREE.LinearFilter;grain.needsUpdate=true;
  const materials=new Set();root.traverse(o=>{if(o.isMesh)for(const m of [o.material].flat())materials.add(m);});
  for(const m of materials){
    if(!/Cockpit_(Leather|Dash|Carbon)/.test(m.name))continue;
    m.normalMap=grain;m.normalScale.set(.23,.23);m.needsUpdate=true;
  }
  return {texture:grain,bytes:data.byteLength};
}
