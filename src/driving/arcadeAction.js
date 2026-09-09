// Free-drive tuning only. Time trials retain their original physics and records.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function createArcadeAction(){
  let charge=100, grip=1;
  return {
    reset(){charge=100;grip=1;},
    step({speed,lateral=0,contacts=0,throttle=0,brake=0,reverse=0,handbrake=false,boost=false},dt){
      dt=Number.isFinite(dt)?clamp(dt,0,.05):0;
      const grounded=contacts>=3;
      const slip=Math.atan2(Math.abs(lateral),Math.max(1,Math.abs(speed)));
      const initiating=grounded&&speed>8&&handbrake;
      const target=initiating?.4:1;
      grip+=(target-grip)*(1-Math.exp(-dt/(initiating?.12:.38)));
      const drifting=grounded&&speed>8&&slip>.1&&slip<.65;
      const active=!!boost&&grounded&&speed>5&&speed<280/3.6&&throttle>0&&!brake&&!reverse&&!handbrake&&slip<.3&&charge>0;
      const power=active?Math.min(1,charge/Math.max(.0001,25*dt)):0;
      if(active)charge=Math.max(0,charge-25*dt);
      // Holding an empty trigger never alternates recharge/boost every frame.
      else if(!boost&&grounded&&speed>5&&!brake&&!reverse)charge=Math.min(100,charge+dt*(drifting?18:6));
      return {charge,grip,drifting,slip,active:active&&power>0,power};
    },
  };
}
