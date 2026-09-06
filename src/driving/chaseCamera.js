import { Vector3 } from 'three';

// Smooth the vehicle-relative offset, not the world position: translation has no
// velocity-dependent lag. At 230 km/h the old world-space lerp added ~8 m.
export function createChaseCamera(camera) {
  const offset = new Vector3(), target = new Vector3(), aim = new Vector3();
  return {
    update(position, forward, kmh, dt, { compact = false, snap = false, motion = true } = {}) {
      const speedBlend = Math.min(1, Math.max(0, kmh) / 240);
      const distance = (compact ? 12 : 9.4) + (motion ? .4 * speedBlend : 0);
      target.copy(forward).multiplyScalar(-distance); target.y = compact ? 4.4 : 3.3;
      if (snap || !motion) offset.copy(target);
      else offset.lerp(target, 1 - Math.exp(-Math.max(0, dt) * 10));
      camera.position.copy(position).add(offset);
      aim.copy(position).addScaledVector(forward, 13 + 10 * speedBlend); aim.y = position.y + .65;
      camera.lookAt(aim);
      const fov = (compact ? 65 : 57) + (motion ? 6 * speedBlend : 0);
      camera.fov += (fov - camera.fov) * (snap || !motion ? 1 : 1 - Math.exp(-dt * 4));
      camera.updateProjectionMatrix();
      return { distance: camera.position.distanceTo(position), fov: camera.fov };
    },
  };
}
