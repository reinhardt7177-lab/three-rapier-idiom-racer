import { Vector3 } from 'three';

// An explicit in-game choice wins; the OS preference supplies the initial default.
export const drivingMotionEnabled = (choice, reduced) => typeof choice === 'boolean' ? choice : !reduced;

// Smooth the vehicle-relative offset, not the world position: translation has no
// velocity-dependent lag. At 230 km/h the old world-space lerp added ~8 m.
export function createChaseCamera(camera) {
  const offset = new Vector3(), target = new Vector3(), aim = new Vector3(),heading=new Vector3(0,0,1),viewHeading=new Vector3(),travel=new Vector3();
  let surge = 0,hit=0,hitTime=0,hitSide=0,hitForward=0,anchorY=null,pedalCue=0,orbitYaw=null,orbitRadius=0;
  return {
    update(position, forward, kmh, dt, { compact = false, snap = false, motion = true, push = 0, braking = 0, boost = false,impact=0,impactDirection=null,stableRide=false,contactResponse=false,pedalResponse=false,drive=0,grounded=true,velocity=null } = {}) {
      // Isolate road/suspension heave from the chase rig. Horizontal tracking is
      // still exact, and real chassis/wheel poses are never filtered or rewritten.
      const seconds=Math.max(0,dt);
      if(anchorY===null||snap||!stableRide)anchorY=position.y;
      else {
        anchorY+=(position.y-anchorY)*(1-Math.exp(-seconds/.14));
        // Follow hills and falls without letting the camera float far away.
        anchorY=Math.max(position.y-.22,Math.min(position.y+.22,anchorY));
      }
      push = Math.min(1, Math.max(0, Number(push) || 0)); braking = Math.min(1, Math.max(0, Number(braking) || 0));
      const speedBlend = Math.min(1, Math.max(0, kmh) / 240);
      // Pitch/roll are suspension motion, not a change to chase distance.
      // A tilted +Z vector has a shorter XZ projection; normalize that heading.
      if(!stableRide)heading.copy(forward);
      else if(Math.hypot(forward.x,forward.z)>.001)heading.set(forward.x,0,forward.z).normalize();
      // Vehicle-relative inertia: visible pedal response without unbounded world lag.
      // Stable race view must not breathe in/out at every torque cut or gear
      // shift. Physical suspension/pitch and contact impact still remain visible.
      const pedalDemand=grounded?(braking>0?-braking:drive>0?.35+.65*push:0):0;
      if(snap||!motion)pedalCue=0;
      else pedalCue+=(pedalDemand-pedalCue)*(1-Math.exp(-seconds/(pedalDemand<0?.16:pedalDemand>pedalCue?.42:.65)));
      const demand = motion ? pedalResponse?pedalCue:!stableRide?push-braking:0 : 0;
      surge = snap || !motion ? demand : surge + (demand - surge) * (1 - Math.exp(-Math.max(0, dt) / (braking > 0 ? .12 : .22)));
      const thrust = motion && boost ? push : 0;
      const distance = (compact ? 8.2 : 7.2) + (motion ? .2 * speedBlend + (pedalResponse?.55:.25) * surge + .1 * thrust : 0);
      target.copy(heading).multiplyScalar(-distance); target.y = (compact ? 3.2 : 2.7) - .16 * surge;
      const desiredYaw=Math.atan2(heading.x,heading.z),desiredRadius=Math.hypot(target.x,target.z);
      if (orbitYaw===null||snap||!motion) {
        orbitYaw=desiredYaw;orbitRadius=desiredRadius;offset.copy(target);
      } else {
        const follow=1-Math.exp(-seconds*10);
        // Interpolate on the orbit, not across its chord. A crash-induced yaw
        // reversal must not pull a seven-metre chase rig through the chassis.
        orbitYaw+=Math.atan2(Math.sin(desiredYaw-orbitYaw),Math.cos(desiredYaw-orbitYaw))*follow;
        orbitRadius+=(desiredRadius-orbitRadius)*follow;
        offset.set(-Math.sin(orbitYaw)*orbitRadius,offset.y+(target.y-offset.y)*follow,-Math.cos(orbitYaw)*orbitRadius);
      }
      camera.position.copy(position).add(offset);
      camera.position.y+=anchorY-position.y;
      viewHeading.set(Math.sin(orbitYaw),0,Math.cos(orbitYaw));
      if(snap||!motion){hit=0;hitTime=0;hitSide=hitForward=0;}
      if(seconds>0&&motion&&impact>0){hit=Math.max(hit,Math.min(1,impact));hitTime=0;hitSide=Math.max(-1,Math.min(1,Number(impactDirection?.side)||0));hitForward=Math.max(-1,Math.min(1,Number(impactDirection?.forward)||0));}
      hitTime+=Math.max(0,dt);hit*=Math.exp(-Math.max(0,dt)*12);
      // An actual contact is a short decaying cue even on the stable race rig.
      // No ambient road/gear wobble; reduced motion disables it entirely.
      if(motion&&(!stableRide||contactResponse)&&hit>.001){
        camera.position.y+=Math.sin(hitTime*55)*hit*.12;
        camera.position.x+=(viewHeading.z*hitSide+viewHeading.x*hitForward)*hit*.08;
        camera.position.z+=(-viewHeading.x*hitSide+viewHeading.z*hitForward)*hit*.08;
      }
      // Keep the look-ahead on that same orbit. During a spin, aiming behind
      // the moving camera can otherwise put the car outside the frame.
      aim.copy(position).addScaledVector(viewHeading, 4 + 4 * speedBlend); aim.y = anchorY + .65 + .22 * surge;
      // During a real slide, look partway toward travel so the corner remains
      // readable. No sideways cue at rest, in reverse, or after recovery snap.
      if(pedalResponse&&motion&&grounded&&velocity){
        travel.set(velocity.x,0,velocity.z);
        if(travel.lengthSq()>25&&travel.dot(heading)>5){travel.normalize().sub(heading);aim.addScaledVector(travel,1.5);}
      }
      camera.lookAt(aim);
      if(motion&&contactResponse)camera.rotateZ(hitSide*hit*.008);
      const fov = (compact ? 60 : 54) + (motion ? (pedalResponse?4.5:3) * speedBlend + 2 * surge + .5 * thrust : 0);
      camera.fov += (fov - camera.fov) * (snap || !motion ? 1 : 1 - Math.exp(-dt * 4));
      camera.updateProjectionMatrix();
      return { distance: camera.position.distanceTo(position), fov: camera.fov, surge };
    },
  };
}
