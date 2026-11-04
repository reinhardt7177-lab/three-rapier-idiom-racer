import * as THREE from 'three';
import { GT_SPEC } from '../vehicleSpec.js';

export function deckHeight(z) { return 1.015 - .12 * (Math.abs(z) / (GT_SPEC.length / 2)) ** 3; }

// Cover the tyre shoulders locally; retain the cabin, sill and physical hubs.
export function bodyHalfWidth(z) {
  const flare=Math.max(...[-1,1].map(side=>Math.max(0,1-((z-side*GT_SPEC.wheelbase/2)/.8)**2)**2));
  const rearFlare=Math.max(0,1-((z+GT_SPEC.wheelbase/2)/.8)**2)**2;
  const tail=Math.max(0,Math.min(1,(-z-1.65)/.65));
  return 1.04-.18*(Math.abs(z)/2.3)**4+.16*flare+.022*rearFlare+.12*tail*tail*(3-2*tail);
}

// Faceted rear fascia: a broad shoulder and tucked lower corners, not a flat slab.
export function createRearBumperGeometry() {
  const shape=new THREE.Shape();
  const outline=[[-.94,.84],[.94,.84],[1,.68],[.92,.30],[.66,.26],[-.66,.26],[-.92,.30],[-1,.68]];
  outline.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
  return new THREE.ExtrudeGeometry(shape,{depth:.13,bevelEnabled:true,bevelSegments:4,steps:1,bevelSize:.025,bevelThickness:.025}).translate(0,0,-2.40);
}

// A closed longitudinal shell. Wheel pockets only cut the OUTER sill, never
// lift the floor or central bonnet. +Z front; winding faces outwards.
export function createBodyGeometry() {
  const positions = [], uv = [], indices = [], steps = 120, ringSize = 12;
  let firstRing, lastRing;
  for (let i = 0; i <= steps; i++) {
    const z = -GT_SPEC.length / 2 + i / steps * GT_SPEC.length;
    const width = bodyHalfWidth(z);
    let pocket = .34;
    for (const hubZ of [-GT_SPEC.wheelbase / 2, GT_SPEC.wheelbase / 2]) {
      const dz = z - hubZ;
      if (Math.abs(dz) < .53) pocket = Math.max(pocket, GT_SPEC.hubHeight + Math.sqrt(.53 ** 2 - dz ** 2));
    }
    const deck = deckHeight(z), shoulder = Math.max(deck - .065, pocket + .065), inner = .75;
    const ring = [[-inner,.3],[-inner,pocket],[-width,pocket],[-width,shoulder-.02],[-width*.86,shoulder+.025],[-.58,deck],
      [.58,deck],[width*.86,shoulder+.025],[width,shoulder-.02],[width,pocket],[inner,pocket],[inner,.3]];
    if (!i) firstRing = ring; lastRing = ring;
    for (const [x,y] of ring) { positions.push(x,y,z); uv.push((x+1.1)/2.2, i/steps); }
    if (i) for (let k=0;k<ringSize;k++) {
      const a=(i-1)*ringSize+k,b=(i-1)*ringSize+(k+1)%ringSize,c=i*ringSize+k,d=i*ringSize+(k+1)%ringSize;
      indices.push(a,c,b,b,c,d);
    }
  }
  for (const [ring,offset,front] of [[firstRing,0,false],[lastRing,steps*ringSize,true]]) {
    for (const tri of THREE.ShapeUtils.triangulateShape(ring.map(([x,y])=>new THREE.Vector2(x,y)),[])) {
      const [a,b,c]=tri.map(i=>i+offset);
      // ShapeUtils returns CCW triangles (+Z); rear cap must face -Z.
      indices.push(...(front?[a,b,c]:[c,b,a]));
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}
