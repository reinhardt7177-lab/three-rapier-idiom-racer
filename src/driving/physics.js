import RAPIER from '@dimforge/rapier3d-compat';
import { harborWallColliders, harborPavementColliders } from './harborSectorSpec.js';
import { COAST_SURFACES, COAST_BARRIERS } from './coastRoute.js';
import harborStage1Colliders from './harborStage1Colliders.json' with { type: 'json' };
import beachStage2Colliders from './beachStage2Colliders.json' with { type: 'json' };
import cityStage3Colliders from './cityStage3Colliders.json' with { type: 'json' };
import lighthouseStage4Colliders from './lighthouseStage4Colliders.json' with { type: 'json' };
import { GT_SPEC } from '../vehicleSpec.js';
import { steeringLimit, updateSteering, wheelSteering, steeringCornerGain } from './steering.js';
import { createArcadeAction, initialArcadeAction } from './arcadeAction.js';
import { createLaunch, idleLaunch } from './launch.js';
import { createRaceDrivetrain } from '../rebuild/vehicleDynamics.js';
import {createActiveRide} from '../rebuild/activeRide.js';
import {registerRideSupport,stepVehicleWorld} from './vehicleWorld.js';
export {stepVehicleWorld} from './vehicleWorld.js';

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
export function createVehiclePhysics({ barriers = true, harbor = false, coast = false, arcade = false, launchEnabled = arcade, progressiveAcceleration = false, recoveryAssist = true, sharedWorld = null, spec = GT_SPEC, raceTuning = null, steeringSensitivity = 1, surface = null, nitro = null, start = { x: 0, y: .8, z: -720 } } = {}) {
  // Race nitro economy: { startCharge, passiveCharge, draftCharge }. Defaults keep free-drive behaviour.
  const startCharge=nitro?.startCharge??100;
  const actionController=arcade?createArcadeAction({recoveryAssist,passiveCharge:nitro?.passiveCharge??6,draftCharge:nitro?.draftCharge??0}):null;
  let action=arcade?{...initialArcadeAction(),charge:startCharge}:null;
  actionController?.reset({charge:startCharge});
  // Story/road driving shares progressive tyre grip without enabling nitro.
  const driftController=!arcade&&progressiveAcceleration?createArcadeAction({recoveryAssist}):null;
  let drift=driftController?initialArcadeAction():null;
  const launchController = launchEnabled ? createLaunch({ duration: progressiveAcceleration ? 1.6 : .9 }) : null;
  let launch = idleLaunch();
  const world = sharedWorld || new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = STEP; world.numSolverIterations = 8;
  if (!sharedWorld) {
  if (coast) {
    for (const surface of COAST_SURFACES) world.createCollider(RAPIER.ColliderDesc.trimesh(surface.vertices, surface.indices).setFriction(1));
    for (const b of COAST_BARRIERS) world.createCollider(RAPIER.ColliderDesc.cuboid(b.hx, b.hy, b.hz).setTranslation(b.x, b.y, b.z).setRotation(b.rotation ?? { x: 0, y: Math.sin(b.yaw / 2), z: 0, w: Math.cos(b.yaw / 2) }).setFriction(.25).setRestitution(.05));
  } else world.createCollider(RAPIER.ColliderDesc.cuboid(70, .5, 930).setTranslation(0, -.5, 0).setFriction(1));
  if (barriers && !coast) for (const b of BARRIERS) world.createCollider(RAPIER.ColliderDesc.cuboid(b.hx, .8, b.hz).setTranslation(b.x, .8, b.z).setFriction(.3).setRestitution(.08));
  if (coast) for (const b of [...harborStage1Colliders,...beachStage2Colliders,...cityStage3Colliders,...lighthouseStage4Colliders]) world.createCollider(RAPIER.ColliderDesc.cuboid(b.hx,b.hy,b.hz).setTranslation(b.x,b.y,b.z).setFriction(b.hy < .2 ? 1 : .3).setRestitution(.05));
  if (harbor && !coast) for (const b of harborWallColliders()) world.createCollider(RAPIER.ColliderDesc.cuboid(b.hx, b.hy, b.hz).setTranslation(b.x, b.y, b.z).setFriction(.3).setRestitution(.08));
  if (harbor && !coast) for (const b of harborPavementColliders()) world.createCollider(RAPIER.ColliderDesc.cuboid(b.hx, b.hy, b.hz).setTranslation(b.x, b.y, b.z).setFriction(1));
  }
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(start.x, start.y, start.z).setCcdEnabled(true).setAngularDamping(.65).setCanSleep(false));
  const mass=raceTuning?.mass??VEHICLE.mass,colliders=[];
  const collision=desc=>{if(raceTuning)desc.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min).setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(mass*6);if(raceTuning?.activeRide)desc.setActiveHooks(RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS);const c=world.createCollider(desc,body);colliders.push(c);return c;};
  if(raceTuning){
    // Match the authored lower body (model Y .18..1.0), not an undersized
    // mechanical box. The old .6m box left the painted shoulders unprotected.
    const w=raceTuning.collisionWidth??raceTuning.width,l=raceTuning.length,h=.80;
    collision(RAPIER.ColliderDesc.roundCuboid(w/2-.025,h/2,l/2-.065,.025).setTranslation(0,-.025,0)
      .setMassProperties(mass,{x:0,y:-.10,z:0},{x:mass*(l*l+h*h)/12,y:mass*(l*l+w*w)/12,z:mass*(w*w+h*h)/12},{x:0,y:0,z:0,w:1}).setFriction(.22).setRestitution(.10));
    if(raceTuning.openTop){
      collision(RAPIER.ColliderDesc.cuboid(.73,.17,.09).setTranslation(0,.50,.25).setMass(0).setFriction(.25));
      collision(RAPIER.ColliderDesc.cuboid(.56,.17,.24).setTranslation(0,.50,-.75).setMass(0).setFriction(.25));
    }else collision(RAPIER.ColliderDesc.roundCuboid(.70,.21,spec.wheelbase*.26,.03).setTranslation(0,raceTuning.roof-.84,-.35).setMass(0).setFriction(.25));
  }else{
    collision(RAPIER.ColliderDesc.cuboid(1.06, .24, 2.3).setTranslation(0, .02, 0).setMass(mass).setFriction(.35).setRestitution(.08));
    collision(RAPIER.ColliderDesc.cuboid(.65, .27, .72).setTranslation(0, .66, -.2).setMass(0).setFriction(.35));
  }
  const controller = world.createVehicleController(body);
  controller.indexUpAxis = 1; controller.setIndexForwardAxis = 2;
  const connections = [];
  const wheelRadius = spec.wheelRadius ?? VEHICLE.wheelRadius;
  const steeringSpec={...spec,steeringAcceleration:raceTuning?.steeringAcceleration??12.8};
  const tireGrip=raceTuning?.grip??2.3,frontDriveBias=clamp(raceTuning?.frontDriveBias??0,0,1),frontBrakeBias=clamp(raceTuning?.frontBrakeBias??.64,0,1);
  const drivetrain=raceTuning?createRaceDrivetrain(raceTuning,wheelRadius):null;
  let powertrain=drivetrain?.snapshot()??null;
  const activeRide=raceTuning?.activeRide?createActiveRide(body,controller,wheelRadius):null;
  const unregisterRide=activeRide?registerRideSupport(world,colliders,activeRide):()=>{};
  // Match createGT's wheel order: -X rear/front, +X rear/front.
  // With +Z forward and +Y up, driver-right is local -X.
  for (const x of [-spec.track / 2, spec.track / 2]) for (const z of [-spec.wheelbase / 2, spec.wheelbase / 2]) {
    const connection = { x, y: .1, z }; connections.push(connection);
    controller.addWheel(connection, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, .34, wheelRadius);
    const i = connections.length - 1;
    controller.setWheelSuspensionStiffness(i, progressiveAcceleration ? (i % 2 === 1 ? 38 : 34) : 40);
    controller.setWheelSuspensionCompression(i, raceTuning?.suspensionCompression??4.4);
    controller.setWheelSuspensionRelaxation(i, raceTuning?.suspensionRelaxation??5.2);
    controller.setWheelMaxSuspensionTravel(i, .2);
    controller.setWheelMaxSuspensionForce(i, 18000);
    controller.setWheelFrictionSlip(i, tireGrip);
    controller.setWheelSideFrictionStiffness(i, 1);
  }
  let steer = 0, steerInput = 0, peakKmh = 0, elapsed = 0, brake = 0, drifting = false, drive = 0, handbrake = false, scrape = 0, draft = 0;
  // Per-tyre surface under the wheel (grip multiplier, rolling drag m/s²).
  // Filtered so a single ray through a road-mesh seam cannot be felt.
  const surfaceGrip = [1, 1, 1, 1], surfaceDrag = [0, 0, 0, 0];
  function updateSurfaces() {
    if (!surface) return;
    for (let i = 0; i < 4; i++) {
      const ground = controller.wheelIsInContact(i) ? controller.wheelGroundObject(i) : null;
      if (!ground) continue;
      const target = surface(ground), blend = 1 - Math.exp(-STEP / (target.grip < surfaceGrip[i] ? .15 : .08));
      surfaceGrip[i] += (target.grip - surfaceGrip[i]) * blend; surfaceDrag[i] += (target.drag - surfaceDrag[i]) * blend;
    }
  }
  // Only the world owner may integrate. A shared vehicle must not move the
  // other chassis before its suspension controller has been updated too.
  if (!sharedWorld) stepVehicleWorld(world);
  function snapshot() {
    const p = body.translation(), q = body.rotation(), v = body.linvel(), f = forwardOf(q);
    const speed = v.x * f.x + v.y * f.y + v.z * f.z;
    const kmh = Math.hypot(v.x, v.z) * 3.6;
    const contacts = connections.reduce((n, _, i) => n + Number(controller.wheelIsInContact(i)), 0);
    return { position: { ...p }, rotation: { ...q }, velocity: { ...v }, angularVelocity: { ...body.angvel() }, ride:activeRide?.snapshot()??null, speed, kmh, peakKmh, elapsed, steer, steerInput, steeringSensitivity, steeringLimit: steeringLimit(Math.abs(speed), progressiveAcceleration, steeringSpec, steeringSensitivity), brake, drifting, drive, handbrake, contacts,
      draft, surface: { grip: (surfaceGrip[0] + surfaceGrip[1] + surfaceGrip[2] + surfaceGrip[3]) / 4, drag: (surfaceDrag[0] + surfaceDrag[1] + surfaceDrag[2] + surfaceDrag[3]) / 4, scrape },
      action:action?{...action}:null, drift:drift?{...drift}:null, launch: { ...launch },
      gear: powertrain?.gear??(speed < -.25 ? 'R' : kmh < 1 ? 'N' : String(Math.min(6, 1 + Math.floor(kmh / 42)))),mass,powertrain:powertrain?{...powertrain}:null,
      wheels: connections.map((c, i) => ({ y: VEHICLE.modelOffset + c.y - (controller.wheelSuspensionLength(i) ?? .34), suspensionLength:controller.wheelSuspensionLength(i)??.34,load:controller.wheelSuspensionForce(i)??0,radius:wheelRadius,steering: controller.wheelSteering(i) || 0, rotation: controller.wheelRotation(i) || 0, launchAngle: i % 2 === 0 ? launch.wheelAngle : 0, contact: !!controller.wheelIsInContact(i), point: controller.wheelIsInContact(i) ? { ...controller.wheelContactPoint(i) } : null, normal: controller.wheelIsInContact(i) ? { ...controller.wheelContactNormal(i) } : null })),
    };
  }
  function step(input = {}, integrate = true) {
    const v = body.linvel(), f = forwardOf(body.rotation());
    const speed = v.x * f.x + v.y * f.y + v.z * f.z, abs = Math.abs(speed);
    const throttle = clamp(Number(input.throttle) || 0, 0, 1), reverse = clamp(Number(input.reverse) || 0, 0, 1);
    brake = clamp(Number(input.brake) || 0, 0, 1);
    drive = 0; handbrake = !!input.handbrake;
    // S/down is brake while travelling forward, then reverse at walking speed.
    if (throttle && speed < -.5) brake = Math.max(brake, throttle);
    else if (reverse && speed > .5) brake = Math.max(brake, reverse);
    else if (!brake) drive = throttle - reverse;
    if(actionController)action=actionController.step({speed,lateral:v.x*f.z-v.z*f.x,contacts:connections.reduce((n,_,i)=>n+Number(controller.wheelIsInContact(i)),0),throttle,brake,reverse,handbrake,boost:input.boost,draft:clamp(Number(input.draft)||0,0,1)},STEP);
    if(driftController)drift=driftController.step({speed,lateral:v.x*f.z-v.z*f.x,contacts:connections.reduce((n,_,i)=>n+Number(controller.wheelIsInContact(i)),0),throttle,brake,reverse,handbrake},STEP);
    const handling=action??drift;
    if (launchController) launch = launchController.step({ speed, throttle, brake, reverse, handbrake,
      grounded: [0, 2].every(i => controller.wheelIsInContact(i)) && 1 - 2 * (body.rotation().x ** 2 + body.rotation().z ** 2) > .75 }, STEP);
    const cap = drive >= 0 ? (action?.active?280:VEHICLE.maxKmh) / 3.6 : VEHICLE.reverseKmh / 3.6;
    const taper = clamp((cap - abs) / (drive >= 0 ? 8 : 2), 0, 1);
    if(drivetrain)powertrain=drivetrain.update({speed,drive,brake},STEP);
    const force = ((powertrain?.force??(drive * (drive >= 0 ? 12500 / (1 + abs * .012) : 5000)))+(action?.power||0)*7000) * taper;
    // Smooth the rack input before applying the current speed envelope: accelerating
    // cannot leave a stale low-speed angle on the tyres. Rack angles remain physical.
    steerInput = updateSteering(steerInput, input.steer, STEP, progressiveAcceleration, steeringSensitivity);
    steer = steerInput * steeringLimit(abs, progressiveAcceleration, steeringSpec, steeringSensitivity);
    const angles = wheelSteering(steer, spec);
    // Extra rack angle alone saturated the tyres on several cars. Match its
    // useful-speed envelope with bounded tyre capacity, preserving AI/highway
    // calibration. Rapier tyre forces still produce all heading changes.
    const cornerCapacity = 1 + (steeringCornerGain(abs, progressiveAcceleration, steeringSensitivity) - 1) * (2 / 3);
    drifting = handling? handling.drifting : !!input.handbrake && abs > 3;
    updateSurfaces();
    scrape = clamp(Number(input.scrape) || 0, 0, 1);
    for (let i = 0; i < 4; i++) {
      const front = i % 2 === 1;
      controller.setWheelSteering(i, angles[i]);
      const driveWeight=raceTuning?(front?frontDriveBias:1-frontDriveBias)/2:progressiveAcceleration?(front?0:.5):.25;
      const brakeWeight=raceTuning?(front?frontBrakeBias:1-frontBrakeBias)/2:progressiveAcceleration?(front?.32:.18):.25;
      controller.setWheelEngineForce(i, force * launch.traction * (!raceTuning&&progressiveAcceleration && drive > 0 ? .78 : 1) * driveWeight);
      controller.setWheelBrake(i, brake * (raceTuning?mass*10.2:14000) * STEP * brakeWeight + (!front && input.handbrake ? 2200 * STEP * (handling?.handbrakeScale??1) : 0) + (drive === 0 && abs < .2 ? 5 : 0));
      controller.setWheelFrictionSlip(i, (!front && handling ? tireGrip*handling.grip : !front && drifting ? .7 : tireGrip) * surfaceGrip[i] * cornerCapacity);
      // Rear drive spends part of its lateral grip on propulsion in a turn.
      // This bounded arcade approximation supplements Rapier suspension loading.
      const powerSlip = progressiveAcceleration && driveWeight>0 && speed > 5 && speed < 40 && brake === 0
        ? .14 * Math.abs(steerInput) * Math.max(0, drive) * (1 - (handling?.recovery || 0)) : 0;
      controller.setWheelSideFrictionStiffness(i, (tireGrip/2.3) * (!front && handling ? handling.grip : !front && drifting ? .3 : 1) * (1 - powerSlip) * surfaceGrip[i] * cornerCapacity);
    }
    body.resetForces(true);
    body.resetTorques(true);
    // Explicit arcade yaw damping, only during grounded forward large-slip recovery.
    // Opposes existing rotation; never writes heading/velocity or adds forward power.
    let recoveryTorque=0;
    if(handling?.recovery>0){
      const q=body.rotation(),up=1-2*(q.x*q.x+q.z*q.z);
      if(up>.75)recoveryTorque=-clamp(body.angvel().y*9000,-10000,10000)*handling.recovery;
    }
    // Slipstream (0..1) removes up to half of the aerodynamic drag.
    draft = clamp(Number(input.draft) || 0, 0, 1);
    const drag = .42 * abs * abs * (1 - .5 * draft) + (abs > .2 ? 150 : 0);
    body.addForce({ x: -f.x * Math.sign(speed) * drag, y: 0, z: -f.z * Math.sign(speed) * drag }, true);
    // Grass/paving rolling resistance and wall scraping oppose actual ground
    // motion. Faded in below 4 m/s so a parked car never creeps or jitters.
    const groundSpeed = Math.hypot(v.x, v.z);
    if (groundSpeed > .05) {
      let resist = scrape * 5.5;
      for (let i = 0; i < 4; i++) if (controller.wheelIsInContact(i)) resist += surfaceDrag[i] / 4;
      const magnitude = mass * resist * Math.min(1, groundSpeed / 4) / groundSpeed;
      if (magnitude) body.addForce({ x: -v.x * magnitude, y: 0, z: -v.z * magnitude }, true);
    }
    // Tyre rays use the road/static scenery; other cars remain physical body
    // colliders, but their bumpers must not act as a moving suspension floor.
    controller.updateVehicle(STEP,raceTuning?RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC:undefined);
    // The vehicle cast now reflects this step's wheel support. Previous-step
    // contacts must not authorize a new recovery torque after leaving the road.
    const supported=connections.reduce((n,_,i)=>n+Number(controller.wheelIsInContact(i)),0)>=3;
    if(raceTuning&&supported&&!activeRide){
      const q=body.rotation(),up={x:2*(q.x*q.y-q.w*q.z),y:1-2*(q.x*q.x+q.z*q.z),z:2*(q.y*q.z+q.w*q.x)};
      if(up.y>.5){
        // Oppose pitch/roll rate only while supported. Preserve steering yaw,
        // jumps and collision motion; never rewrite rotation or velocity.
        const omega=body.angvel(),damping=mass*(raceTuning.bodyDamping??0);
        body.addTorque({x:-omega.x*damping,y:0,z:-omega.z*damping},true);
        const aero=raceTuning.aero??0;
        body.addForce({x:-up.x*aero*abs*abs,y:-up.y*aero*abs*abs,z:-up.z*aero*abs*abs},true);
        for(const [left,right] of [[0,2],[1,3]]){
          if(!controller.wheelIsInContact(left)||!controller.wheelIsInContact(right))continue;
          const stabilizer=clamp((controller.wheelSuspensionLength(right)-controller.wheelSuspensionLength(left))*(raceTuning.antiRoll??0),-mass*2,mass*2);
          for(const [i,sign] of [[left,1],[right,-1]]){
            const point=controller.wheelHardPoint(i);
            if(point)body.addForceAtPoint({x:up.x*stabilizer*sign,y:up.y*stabilizer*sign,z:up.z*stabilizer*sign},point,true);
          }
        }
      }
    }
    if(handling){
      handling.recoveryTorque=supported?recoveryTorque:0;
      if(handling.recoveryTorque)body.addTorque({x:0,y:handling.recoveryTorque,z:0},true);
    }
    activeRide?.update(STEP,v);
    if (!integrate) return snapshot();
    stepVehicleWorld(world); return finishStep();
  }
  function finishStep() {
    elapsed += STEP;
    const state = snapshot(); peakKmh = Math.max(peakKmh, state.kmh); state.peakKmh = peakKmh;
    return state;
  }
  // A shared-world coordinator resets all bodies before the next common step.
  function reset(position = start, yaw = 0, { stepWorld = !sharedWorld,rotation=null,preserveCharge=false } = {}) {
    activeRide?.reset();
    drivetrain?.reset();powertrain=drivetrain?.snapshot()??null;
    launchController?.reset(); launch = idleLaunch();
    driftController?.reset(); drift=driftController?initialArcadeAction():null;
    if(actionController){const charge=preserveCharge?action.charge:startCharge;actionController.reset({charge});action={...initialArcadeAction(),charge};}
    body.setTranslation(position, true); body.setRotation(rotation??{ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true); body.setAngvel({ x: 0, y: 0, z: 0 }, true); body.resetForces(true); body.resetTorques(true);
    steer = 0; steerInput = 0; peakKmh = 0; elapsed = 0; brake = 0; drifting = false; drive = 0; handbrake = false; scrape = 0; draft = 0;
    surfaceGrip.fill(1); surfaceDrag.fill(0);
    for (let i = 0; i < 4; i++) { controller.setWheelEngineForce(i, 0); controller.setWheelBrake(i, 0); controller.setWheelSteering(i, 0); controller.setWheelFrictionSlip(i, tireGrip); controller.setWheelSideFrictionStiffness(i, tireGrip/2.3); }
    if (stepWorld) stepVehicleWorld(world);
  }
  return { world, body, colliders,controller, step, finishStep, snapshot, reset,
    addCharge:amount=>{if(!actionController)return 0;const charge=actionController.addCharge(amount);action={...action,charge};return charge;},
    setRecoveryAssist:value=>actionController?.setRecoveryAssist(value), dispose: () => { unregisterRide();if(sharedWorld){world.removeVehicleController(controller);world.removeRigidBody(body);}else world.free();} };
}
