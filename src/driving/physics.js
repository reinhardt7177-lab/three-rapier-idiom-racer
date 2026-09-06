import RAPIER from '@dimforge/rapier3d-compat';
import { harborWallColliders, harborPavementColliders } from './harborSectorSpec.js';
import { COAST_SURFACES, COAST_BARRIERS } from './coastRoute.js';
import { GT_SPEC } from '../vehicleSpec.js';
import { steeringLimit, updateSteering, wheelSteering } from './steering.js';

let ready;
export function initPhysics() { return ready ||= RAPIER.init(); }
export const STEP = 1 / 120;
export const VEHICLE = Object.freeze({ mass: 1200, maxKmh: 240, reverseKmh: 30, wheelRadius: GT_SPEC.wheelRadius, modelOffset: .6 });
export const BARRIERS = Object.freeze([
  { x: -51, z: 0, hx: .6, hz: 900 }, { x: 51, z: 0, hx: .6, hz: 900 },
  { x: 0, z: 900, hx: 51, hz: .6 }, { x: 0, z: -900, hx: 51, hz: .6 },
  { x: 20, z: -440, hx: 7, hz: .6 }, { x: -20, z: -340, hx: 7, hz: .6 },
]);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export function forwardOf(q) { return { x: 2 * (q.x * q.z + q.w * q.y), y: 2 * (q.y * q.z - q.w * q.x), z: 1 - 2 * (q.x * q.x + q.y * q.y) }; }

// Metres, seconds, kilograms. Rendering never writes the dynamic body's transform.
export function createVehiclePhysics({ barriers = true, harbor = false, coast = false, start = { x: 0, y: .8, z: -720 } } = {}) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = STEP; world.numSolverIterations = 8;
  if (coast) {
    for (const surface of COAST_SURFACES) world.createCollider(RAPIER.ColliderDesc.trimesh(surface.vertices, surface.indices).setFriction(1));
    for (const b of COAST_BARRIERS) world.createCollider(RAPIER.ColliderDesc.cuboid(b.hx, b.hy, b.hz).setTranslation(b.x, b.y, b.z).setRotation({ x: 0, y: Math.sin(b.yaw / 2), z: 0, w: Math.cos(b.yaw / 2) }).setFriction(.25).setRestitution(.05));
  } else world.createCollider(RAPIER.ColliderDesc.cuboid(70, .5, 930).setTranslation(0, -.5, 0).setFriction(1));
  if (barriers && !coast) for (const b of BARRIERS) world.createCollider(RAPIER.ColliderDesc.cuboid(b.hx, .8, b.hz).setTranslation(b.x, .8, b.z).setFriction(.3).setRestitution(.08));
  if (harbor) for (const b of harborWallColliders()) world.createCollider(RAPIER.ColliderDesc.cuboid(b.hx, b.hy, b.hz).setTranslation(b.x, b.y, b.z).setFriction(.3).setRestitution(.08));
  if (harbor) for (const b of harborPavementColliders()) world.createCollider(RAPIER.ColliderDesc.cuboid(b.hx, b.hy, b.hz).setTranslation(b.x, b.y, b.z).setFriction(1));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(start.x, start.y, start.z).setCcdEnabled(true).setAngularDamping(.65).setCanSleep(false));
  world.createCollider(RAPIER.ColliderDesc.cuboid(1.06, .24, 2.3).setTranslation(0, .02, 0).setMass(VEHICLE.mass).setFriction(.35).setRestitution(.08), body);
  world.createCollider(RAPIER.ColliderDesc.cuboid(.65, .27, .72).setTranslation(0, .66, -.2).setMass(0).setFriction(.35), body);
  const controller = world.createVehicleController(body);
  controller.indexUpAxis = 1; controller.setIndexForwardAxis = 2;
  const connections = [];
  // Match createGT's wheel order: -X rear/front, +X rear/front.
  // With +Z forward and +Y up, driver-right is local -X.
  for (const x of [-GT_SPEC.track / 2, GT_SPEC.track / 2]) for (const z of [-GT_SPEC.wheelbase / 2, GT_SPEC.wheelbase / 2]) {
    const connection = { x, y: .1, z }; connections.push(connection);
    controller.addWheel(connection, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, .34, VEHICLE.wheelRadius);
    const i = connections.length - 1;
    controller.setWheelSuspensionStiffness(i, 40);
    controller.setWheelSuspensionCompression(i, 4.4);
    controller.setWheelSuspensionRelaxation(i, 5.2);
    controller.setWheelMaxSuspensionTravel(i, .2);
    controller.setWheelMaxSuspensionForce(i, 18000);
    controller.setWheelFrictionSlip(i, 2.3);
    controller.setWheelSideFrictionStiffness(i, 1);
  }
  let steer = 0, steerInput = 0, peakKmh = 0, elapsed = 0, brake = 0, drifting = false;
  // Populate scene queries before the first wheel cast.
  world.step();
  function snapshot() {
    const p = body.translation(), q = body.rotation(), v = body.linvel(), f = forwardOf(q);
    const speed = v.x * f.x + v.y * f.y + v.z * f.z;
    const kmh = Math.hypot(v.x, v.z) * 3.6;
    const contacts = connections.reduce((n, _, i) => n + Number(controller.wheelIsInContact(i)), 0);
    return { position: { ...p }, rotation: { ...q }, velocity: { ...v }, speed, kmh, peakKmh, elapsed, steer, steerInput, steeringLimit: steeringLimit(Math.abs(speed)), brake, drifting, contacts,
      gear: speed < -.25 ? 'R' : kmh < 1 ? 'N' : String(Math.min(6, 1 + Math.floor(kmh / 42))),
      wheels: connections.map((c, i) => ({ y: VEHICLE.modelOffset + c.y - (controller.wheelSuspensionLength(i) ?? .34), steering: controller.wheelSteering(i) || 0, rotation: controller.wheelRotation(i) || 0 })),
    };
  }
  function step(input = {}) {
    const v = body.linvel(), f = forwardOf(body.rotation());
    const speed = v.x * f.x + v.y * f.y + v.z * f.z, abs = Math.abs(speed);
    const throttle = clamp(Number(input.throttle) || 0, 0, 1), reverse = clamp(Number(input.reverse) || 0, 0, 1);
    brake = clamp(Number(input.brake) || 0, 0, 1);
    let drive = 0;
    // S/down is brake while travelling forward, then reverse at walking speed.
    if (throttle && speed < -.5) brake = Math.max(brake, throttle);
    else if (reverse && speed > .5) brake = Math.max(brake, reverse);
    else if (!brake) drive = throttle - reverse;
    const cap = drive >= 0 ? VEHICLE.maxKmh / 3.6 : VEHICLE.reverseKmh / 3.6;
    const taper = clamp((cap - abs) / (drive >= 0 ? 8 : 2), 0, 1);
    const force = drive * (drive >= 0 ? 12500 / (1 + abs * .012) : 5000) * taper;
    // Smooth the rack input before applying the current speed envelope: accelerating
    // cannot leave a stale low-speed angle on the tyres. No artificial yaw impulse.
    steerInput = updateSteering(steerInput, input.steer, STEP);
    steer = steerInput * steeringLimit(abs);
    const angles = wheelSteering(steer);
    drifting = !!input.handbrake && abs > 3;
    for (let i = 0; i < 4; i++) {
      const front = i % 2 === 1;
      controller.setWheelSteering(i, angles[i]);
      controller.setWheelEngineForce(i, force / 4);
      controller.setWheelBrake(i, brake * 14000 * STEP / 4 + (!front && input.handbrake ? 2200 * STEP : 0) + (drive === 0 && abs < .2 ? 5 : 0));
      controller.setWheelFrictionSlip(i, !front && drifting ? .7 : 2.3);
      controller.setWheelSideFrictionStiffness(i, !front && drifting ? .3 : 1);
    }
    body.resetForces(true);
    const drag = .42 * abs * abs + (abs > .2 ? 150 : 0);
    body.addForce({ x: -f.x * Math.sign(speed) * drag, y: 0, z: -f.z * Math.sign(speed) * drag }, true);
    controller.updateVehicle(STEP);
    world.step(); elapsed += STEP;
    const state = snapshot(); peakKmh = Math.max(peakKmh, state.kmh); state.peakKmh = peakKmh;
    return state;
  }
  function reset(position = start, yaw = 0) {
    body.setTranslation(position, true); body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true); body.setAngvel({ x: 0, y: 0, z: 0 }, true); body.resetForces(true); body.resetTorques(true);
    steer = 0; steerInput = 0; peakKmh = 0; elapsed = 0; brake = 0; drifting = false;
    for (let i = 0; i < 4; i++) { controller.setWheelEngineForce(i, 0); controller.setWheelBrake(i, 0); controller.setWheelSteering(i, 0); controller.setWheelFrictionSlip(i, 2.3); controller.setWheelSideFrictionStiffness(i, 1); }
    world.step();
  }
  return { world, body, controller, step, snapshot, reset, dispose: () => world.free() };
}
