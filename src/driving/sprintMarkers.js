import * as THREE from 'three';
import { box, canvasMap } from '../garage/procedural.js';
import { batchStaticMeshes } from '../garage/batchStatic.js';
import { SPRINT_GATES } from './sprint.js';
import { offsetPoint } from './coastRoute.js';

// Timing equipment outside the usable shoulder, no overhead arcade gates.
export function createSprintMarkers() {
  const root=new THREE.Group(),textures=[];
  const dark=new THREE.MeshStandardMaterial({color:'#233b32'}),ivory=new THREE.MeshStandardMaterial({color:'#e4d7b3'});
  for(const [i,gate] of SPRINT_GATES.entries()) {
    const marker=new THREE.Group();marker.position.set(gate.x,0,gate.z);marker.rotation.y=Math.atan2(gate.tx,gate.tz);root.add(marker);
    const tex=canvasMap((ctx,s)=>{ctx.fillStyle='#233b32';ctx.fillRect(0,0,s,s);ctx.fillStyle='#ead8a4';ctx.textAlign='center';ctx.font='bold 116px sans-serif';ctx.fillText(i===2?'FINISH':`0${i+1}`,s/2,235);ctx.font='38px sans-serif';ctx.fillText('COASTLINE GT',s/2,330);},512);textures.push(tex);
    const face=new THREE.MeshStandardMaterial({map:tex,roughness:.8,side:THREE.DoubleSide});
    for(const side of [-1,1]) {
      const x=side*(gate.halfWidth+3.2);
      box(marker,[.12,3.5,.12],dark,[x,1.75,0]);
      box(marker,[1.65,1.4,.14],dark,[x,2.8,0]);
      const board=new THREE.Mesh(new THREE.PlaneGeometry(1.55,1.3),face);board.position.set(x,2.8,-.08);board.rotation.y=Math.PI;marker.add(board);
    }
    // Thin transverse timing strip, existing asphalt and collision unchanged.
    for(let n=0;n<Math.floor(gate.halfWidth*2);n++)box(marker,[.9,.014,.32],n%2?dark:ivory,[-gate.halfWidth+.5+n,.047,0]);
  }
  // Harbor bend begins at s=420 (z=-390). Distance boards precede the bend.
  for(const metres of [100,50]) {
    const q=offsetPoint({x:0,z:-390-metres,tx:0,tz:1},13.4);
    box(root,[.12,2.1,.12],dark,[q.x,1.05,q.z]);
    const tex=canvasMap((ctx,s)=>{ctx.fillStyle='#dfd4b0';ctx.fillRect(0,0,s,s);ctx.fillStyle='#243a31';ctx.textAlign='center';ctx.font='bold 180px sans-serif';ctx.fillText(String(metres),s/2,280);ctx.font='55px sans-serif';ctx.fillText('BRAKE / m',s/2,385);});textures.push(tex);
    const board=new THREE.Mesh(new THREE.PlaneGeometry(1.15,1.15),new THREE.MeshStandardMaterial({map:tex,side:THREE.DoubleSide}));board.position.set(q.x,2.1,q.z);board.rotation.y=Math.PI;root.add(board);
  }
  batchStaticMeshes(root);
  return {root,dispose(){textures.forEach(t=>t.dispose());}};
}
