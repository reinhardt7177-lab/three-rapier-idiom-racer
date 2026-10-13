import { GT_SPEC } from '../vehicleSpec.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// An additional 30% over the previous player setting; AI keeps sensitivity 1.
export const PLAYER_STEERING_SENSITIVITY = 1.3 * 1.3;
// Road-friendly arcade tuning, not a claim of real tyre performance.
// Limit rack angle, not body yaw. Rapier still determines the actual turn.
export function steeringLimit(speedMps, responsive = false, spec = GT_SPEC, sensitivity = 1) {
  return Math.min(.52, Math.max(1, Math.min(PLAYER_STEERING_SENSITIVITY, sensitivity)) * Math.atan(spec.wheelbase * (spec.steeringAcceleration??12.8) * (responsive ? 1 + .4 * Math.max(0, 1 - Math.max(0, Math.abs(speedMps) - 25) / 30) : 1) / Math.max(25, speedMps ** 2)));
}

export function updateSteering(previousInput, input, dt, responsive = false) {
  const target = -clamp(Number(input) || 0, -1, 1);
  const rate = target === 0 ? 16 : target * previousInput < 0 ? 22 : 14;
  const next = previousInput + (target - previousInput) * (1 - Math.exp(-rate * (responsive ? 1.4 : 1) * dt));
  return Math.abs(next) < .0001 ? 0 : next;
}

// The two front tyre axes meet on the rear axle's extended line (Ackermann).
// Returned order matches model/physics: -X rear/front, +X rear/front.
export function wheelSteering(centerAngle, spec = GT_SPEC) {
  if (Math.abs(centerAngle) < .000001) return [0, 0, 0, 0];
  const sign = Math.sign(centerAngle), radius = spec.wheelbase / Math.tan(Math.abs(centerAngle));
  const inner = sign * Math.atan(spec.wheelbase / (radius - spec.track / 2));
  const outer = sign * Math.atan(spec.wheelbase / (radius + spec.track / 2));
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
    wheel.spin.rotation.x = before.rotation + (after.rotation - before.rotation) * a
      + (before.launchAngle || 0) + ((after.launchAngle || 0) - (before.launchAngle || 0)) * a;
  });
}
