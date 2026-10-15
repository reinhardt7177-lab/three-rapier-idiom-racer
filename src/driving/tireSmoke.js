import * as THREE from 'three';
import {createSmokeCloud} from './smokeCloud.js';

export const SMOKE_LIMIT = 160;
// One draw call; particles remain in world space after leaving the contact patch.
export function createTireSmoke({billboards=false,strong=false}={}) {
  const positions = new Float32Array(SMOKE_LIMIT * 3), velocities = new Float32Array(SMOKE_LIMIT * 3);
  const ages = new Float32Array(SMOKE_LIMIT).fill(10), lives = new Float32Array(SMOKE_LIMIT);
  const sizes = new Float32Array(SMOKE_LIMIT), alphas = new Float32Array(SMOKE_LIMIT);
  const strengths = new Float32Array(SMOKE_LIMIT);
  let geometry = new THREE.BufferGeometry();
  for (const [name, array, n] of [['position', positions, 3], ['aSize', sizes, 1], ['aAlpha', alphas, 1]])
    geometry.setAttribute(name, new THREE.BufferAttribute(array, n).setUsage(THREE.DynamicDrawUsage));
  let material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { viewportHeight: { value: 720 } },
    vertexShader: `attribute float aSize; attribute float aAlpha; uniform float viewportHeight; varying float opacity;
      void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;
        gl_PointSize=clamp(aSize*viewportHeight*projectionMatrix[1][1]/max(1.,-2.*p.z),1.,180.);
        opacity=aAlpha*smoothstep(1.,3.,-p.z);}`,
    fragmentShader: `varying float opacity;
      void main(){vec2 p=gl_PointCoord-.5;float r=length(p);
        float edge=.44+.025*sin(p.x*35.)*sin(p.y*29.);
        float soft=1.-smoothstep(.08,edge,r);float a=opacity*soft*soft;
        if(a<.003)discard;gl_FragColor=vec4(vec3(.79,.82,.81),a);
        #include <colorspace_fragment>
      }`,
  });
  let root = new THREE.Points(geometry, material);
  if(billboards){geometry.dispose();material.dispose();root=createSmokeCloud(positions,sizes,alphas,{color:'#c1c6c5',name:'contact-tire-smoke'});geometry=root.geometry;material=root.material;}
  root.name = 'contact-tire-smoke'; root.frustumCulled = false; root.visible = false;
  let cursor = 0, live = 0, budget = SMOKE_LIMIT, seed = 137;
  const carry = [0, 0, 0, 0];
  function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
  function clear() { ages.fill(10); alphas.fill(0); carry.fill(0); cursor = live = 0; root.visible = false; geometry.attributes.aAlpha.needsUpdate = true; }
  function update(state, signals, dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, .1);
    for (let i = 0; i < SMOKE_LIMIT; i++) {
      ages[i] += dt;
      if (ages[i] >= lives[i]) { alphas[i] = 0; continue; }
      const j = i * 3, t = ages[i] / lives[i];
      positions[j] += velocities[j] * dt; positions[j + 1] += velocities[j + 1] * dt; positions[j + 2] += velocities[j + 2] * dt;
      velocities[j] *= Math.exp(-dt * 1.6); velocities[j + 2] *= Math.exp(-dt * 1.6);
      sizes[i] = ((strong?.65:.5) + .4*strengths[i]) + t * (strong?3.1:2.6)*(.6+.4*strengths[i]);
      alphas[i] = (strong?.70:.40) * (.25+.75*strengths[i]) * Math.min(1, t * 12) * (1 - t) ** 1.3;
    }
    state.wheels.forEach((w, i) => {
      const slip = Math.min(1, Math.max(0, Math.max(signals.wheelSlip[i] || 0, state.brake > .5 ? (signals.braking || 0) * .8 : 0)));
      if (!signals.grounded || !w.contact || !w.point || !w.normal || w.normal.y < .8 || (Math.abs(state.speed) < 3 && !(signals.launchSpin > 0 && i % 2 === 0)) || slip < .18) { carry[i] = 0; return; }
      carry[i] += dt * (budget === SMOKE_LIMIT ? (strong?65:48) : 20) * slip;
      while (carry[i] >= 1) {
        carry[i]--; const k = cursor, j = k * 3; cursor = (cursor + 1) % budget;
        positions[j] = w.point.x + (random() - .5) * .15;
        positions[j + 1] = w.point.y + .16;
        positions[j + 2] = w.point.z + (random() - .5) * .15;
        velocities[j] = state.velocity.x * .08 + (random() - .5) * .7;
        velocities[j + 1] = .35 + random() * .35;
        velocities[j + 2] = state.velocity.z * .08 + (random() - .5) * .7;
        strengths[k]=slip;
        ages[k] = 0; lives[k] = (strong?.85:.65) + random() * .45; sizes[k] = (strong?.65:.5)+.4*slip; alphas[k] = .06*slip;
      }
    });
    live = 0; for (let i = 0; i < SMOKE_LIMIT; i++) if (alphas[i] > 0) live++;
    root.visible = live > 0;
    for (const attribute of Object.values(geometry.attributes)) attribute.needsUpdate = true;
  }
  return { root, update, clear,
    setQuality(quality) { const next = quality === 'light' ? 64 : SMOKE_LIMIT; if (next !== budget) { budget = next; clear(); } },
    setViewport(height) { if(material.uniforms.viewportHeight)material.uniforms.viewportHeight.value = Math.max(1, height); },
    stats: () => ({ live, budget }), dispose() { geometry.dispose(); material.dispose(); },
  };
}
