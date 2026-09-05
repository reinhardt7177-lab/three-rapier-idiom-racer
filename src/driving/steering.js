import { GT_SPEC } from '../vehicleSpec.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// Road-friendly arcade tuning, not a claim of real tyre performance.
// Limit rack angle, not body yaw. Rapier still determines the actual turn.
export function steeringLimit(speedMps) {
  return Math.min(.52, Math.atan(GT_SPEC.wheelbase * 12.8 / Math.max(25, speedMps ** 2)));
}

export function updateSteering(previousInput, input, dt) {
  const target = -clamp(Number(input) || 0, -1, 1);
  const rate = target === 0 ? 16 : target * previousInput < 0 ? 22 : 14;
  const next = previousInput + (target - previousInput) * (1 - Math.exp(-rate * dt));
  return Math.abs(next) < .0001 ? 0 : next;
}

// The two front tyre axes meet on the rear axle's extended line (Ackermann).
// Returned order matches model/physics: -X rear/front, +X rear/front.
export function wheelSteering(centerAngle) {
  if (Math.abs(centerAngle) < .000001) return [0, 0, 0, 0];
  const sign = Math.sign(centerAngle), radius = GT_SPEC.wheelbase / Math.tan(Math.abs(centerAngle));
  const inner = sign * Math.atan(GT_SPEC.wheelbase / (radius - GT_SPEC.track / 2));
  const outer = sign * Math.atan(GT_SPEC.wheelbase / (radius + GT_SPEC.track / 2));
  return [0, sign < 0 ? inner : outer, 0, sign > 0 ? inner : outer];
}

export function applyWheelPose(wheels, previous, current, alpha) {
  const a = clamp(alpha, 0, 1);
  wheels.forEach((wheel, i) => {
    const before = previous[i], after = current[i];
    wheel.pivot.position.y = before.y + (after.y - before.y) * a;
    wheel.pivot.rotation.y = before.steering + (after.steering - before.steering) * a;
    // Continuous Rapier angle: don't wrap at 2π, or spinning reverses at the seam.
    // +X rotation makes the bottom tread move -Z relative to the forward (+Z) car.
    wheel.spin.rotation.x = before.rotation + (after.rotation - before.rotation) * a;
  });
}
