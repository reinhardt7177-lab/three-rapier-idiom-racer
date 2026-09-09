// Read-only presentation signals. No force, velocity or transform writes.
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const rotate = (v, q) => {
  const tx = 2 * (q.y * v.z - q.z * v.y), ty = 2 * (q.z * v.x - q.x * v.z), tz = 2 * (q.x * v.y - q.y * v.x);
  return { x: v.x + q.w * tx + q.y * tz - q.z * ty, y: v.y + q.w * ty + q.z * tx - q.x * tz, z: v.z + q.w * tz + q.x * ty - q.y * tx };
};
export const emptySignals = () => ({ acceleration: 0, push: 0, braking: 0, scrub: 0, slipAngle: 0, sliding: false, wheelSlip: [0, 0, 0, 0], grounded: false });

export function createDrivingSignals() {
  let result = emptySignals(), enter = 0, leave = 0;
  function reset() { enter = leave = 0; return result = emptySignals(); }
  function update(previous, current, dt) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > .1) return reset();
    const p = current.position, old = previous.position;
    if (Math.hypot(p.x - old.x, p.y - old.y, p.z - old.z) > 3) return reset();
    const q = current.rotation, v = current.velocity, omega = current.angularVelocity || { x: 0, y: 0, z: 0 };
    const f = rotate({ x: 0, y: 0, z: 1 }, q), right = rotate({ x: 1, y: 0, z: 0 }, q), up = rotate({ x: 0, y: 1, z: 0 }, q);
    const grounded = current.contacts >= 2 && up.y > .75;
    const dv = { x: v.x - previous.velocity.x, y: v.y - previous.velocity.y, z: v.z - previous.velocity.z };
    // Project world acceleration, not d(local speed)/dt: yaw alone is not braking.
    const rawAcceleration = clamp(dot(dv, f) / dt, -20, 15);
    const acceleration = result.acceleration + (rawAcceleration - result.acceleration) * (1 - Math.exp(-dt / .12));
    const forwardSpeed = dot(v, f), lateralSpeed = dot(v, right), speed = Math.abs(forwardSpeed);
    const slipAngle = Math.atan2(Math.abs(lateralSpeed), Math.max(speed, 2));
    const wheelSlip = current.wheels.map(w => {
      if (!grounded || !w.contact || !w.point || !w.normal || w.normal.y < .75 || speed < 3) return 0;
      const r = { x: w.point.x - p.x, y: w.point.y - p.y, z: w.point.z - p.z };
      const velocity = { x: v.x + omega.y * r.z - omega.z * r.y, y: v.y + omega.z * r.x - omega.x * r.z, z: v.z + omega.x * r.y - omega.y * r.x };
      const lateral = rotate({ x: Math.cos(w.steering), y: 0, z: -Math.sin(w.steering) }, q);
      const rolling = rotate({ x: Math.sin(w.steering), y: 0, z: Math.cos(w.steering) }, q);
      const side = Math.abs(dot(velocity, lateral)), along = Math.abs(dot(velocity, rolling));
      return clamp((Math.atan2(side, Math.max(along, 2)) - .045) / .22) * clamp((side - .55) / 2.5);
    });
    const candidate = grounded && forwardSpeed > 6 && slipAngle > .14 && Math.abs(lateralSpeed) > 1.2;
    enter = candidate ? enter + dt : 0;
    const recovered = !grounded || forwardSpeed < 4 || slipAngle < .075;
    leave = recovered ? leave + dt : 0;
    let sliding = result.sliding;
    if (enter >= .12) sliding = true;
    if (leave >= .16 || !grounded || forwardSpeed < 4) sliding = false;
    const push = grounded && forwardSpeed > 1 && current.drive > 0 ? clamp(acceleration / 5.5) : 0;
    const braking = grounded && speed > 1 && (current.brake > .05 || current.handbrake)
      ? clamp(-acceleration * Math.sign(forwardSpeed) / 9) : 0;
    const targetScrub = grounded ? Math.max(...wheelSlip) : 0;
    const scrub = grounded && speed > 3 ? result.scrub + (targetScrub - result.scrub) * (1 - Math.exp(-dt / .065)) : 0;
    return result = { acceleration, push, braking, scrub, slipAngle, sliding, wheelSlip, grounded };
  }
  return { update, reset, snapshot: () => result };
}
