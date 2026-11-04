// Higher straight pace with a bounded corner acceleration. The controller still
// brakes for real traffic and sends pedals only; no progress-based teleporting.
export const RIVAL_RACE_PROFILE=Object.freeze({maxSpeed:185,lateralAcceleration:5.2});
export const rivalPace=index=>.95+Math.max(0,Math.min(4,index))*.02;
