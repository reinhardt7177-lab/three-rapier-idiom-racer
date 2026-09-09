import * as THREE from 'three';

export const TRAIL_LIMIT = 512;
const LIFE = 12;
export function createTireFeedback() {
  const positions = new Float32Array(TRAIL_LIMIT * 12), born = new Float32Array(TRAIL_LIMIT * 4).fill(-1000), indices = [];
  for (let i = 0; i < TRAIL_LIMIT; i++) { const v = i * 4; indices.push(v, v + 1, v + 2, v + 2, v + 1, v + 3); }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aBorn', new THREE.BufferAttribute(born, 1).setUsage(THREE.DynamicDrawUsage)); geometry.setIndex(indices); geometry.setDrawRange(0, 0);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    uniforms: { time: { value: 0 }, ink: { value: new THREE.Color('#263435') } },
    vertexShader: 'attribute float aBorn; varying float vBorn; void main(){vBorn=aBorn;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `uniform float time; uniform vec3 ink; varying float vBorn;
      void main(){float life=clamp(1.0-(time-vBorn)/12.0,0.0,1.0);gl_FragColor=vec4(ink,.38*life*life);
      #include <colorspace_fragment>
      }`,
  });
  const root = new THREE.Mesh(geometry, material); root.name = 'contact-tire-trails'; root.frustumCulled = false; root.renderOrder = 1;
  let cursor = 0, used = 0, clock = 0, newest = -1000; const last = [null, null, null, null]; root.visible = false;
  function clear() { cursor = used = clock = 0; newest = -1000; root.visible = false; last.fill(null); born.fill(-1000); geometry.setDrawRange(0, 0); material.uniforms.time.value = 0; geometry.attributes.aBorn.needsUpdate = true; }
  function update(state, signals, dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    clock += Math.min(.1, dt); material.uniforms.time.value = clock; root.visible = clock - newest < LIFE;
    let dirty = false;
    state.wheels.forEach((w, i) => {
      if (!signals.grounded || signals.wheelSlip[i] < .2 || state.speed < 3 || !w.contact || !w.point || !w.normal || w.normal.y < .8) { last[i] = null; return; }
      const p = w.point, old = last[i];
      if (!old) { last[i] = { ...p }; return; }
      const dx = p.x - old.x, dz = p.z - old.z, distance = Math.hypot(dx, dz);
      if (distance < .14) return;
      last[i] = { ...p };
      if (distance > 2 || Math.abs(p.y - old.y) > .25) return;
      const x = -dz / distance * .105, z = dx / distance * .105, start = cursor * 12;
      positions.set([old.x + x, old.y + .04, old.z + z, old.x - x, old.y + .04, old.z - z, p.x + x, p.y + .04, p.z + z, p.x - x, p.y + .04, p.z - z], start);
      born.fill(clock, cursor * 4, cursor * 4 + 4); cursor = (cursor + 1) % TRAIL_LIMIT; used = Math.min(TRAIL_LIMIT, used + 1); newest = clock; root.visible = true; dirty = true;
    });
    if (dirty) { geometry.attributes.position.needsUpdate = geometry.attributes.aBorn.needsUpdate = true; geometry.setDrawRange(0, used * 6); }
  }
  return { root, update, clear, stats: () => ({ allocated: TRAIL_LIMIT, used, live: Array.from({ length: used }, (_, i) => Number(clock - born[i * 4] < LIFE)).reduce((a, b) => a + b, 0) }), dispose() { geometry.dispose(); material.dispose(); } };
}
