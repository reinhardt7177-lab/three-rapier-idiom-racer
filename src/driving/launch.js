// Short arcade clutch/traction transient, not a full longitudinal tyre solver.
// Story/journey/test drives also launch; timed records retain their baseline.
export const launchEnabledForMode = ({ sprint = false, duel = false } = {}) => !sprint || !!duel;
export const idleLaunch = () => ({ spin: 0, traction: 1, wheelAngle: 0, active: false });
export function createLaunch({ duration = .9 } = {}) {
  let time = 2, armed = true, released = 0, angle = 0;
  let current = idleLaunch();
  return {
    reset() { time = 2; armed = true; released = angle = 0; current = idleLaunch(); },
    step({ speed, throttle, brake, reverse, handbrake, grounded }, dt) {
      dt = Math.max(0, Math.min(.05, Number(dt) || 0));
      if (!dt) return { ...current };
      if (throttle < .1 && Math.abs(speed) < 1) released += dt; else released = 0;
      if (released >= .15) armed = true;
      const eligible = grounded && !brake && !reverse && !handbrake && throttle > .8 && speed >= -.1;
      if (armed && eligible && speed < 1.5) { time = 0; armed = false; }
      if (!eligible || speed > 12) time = 2;
      time += dt;
      const attack = duration > .9 ? .28 : .07, hold = duration > .9 ? .5 : .22;
      const fade = Math.max(0, Math.min(1, (time - hold) / (duration - hold)));
      const spin = time < duration ? Math.min(1, time / attack) * (1 - fade * fade * (3 - 2 * fade)) : 0;
      angle += spin * 55 * dt;
      current = { spin, traction: 1 - .68 * spin, wheelAngle: angle, active: spin > 0 };
      return { ...current };
    },
  };
}
