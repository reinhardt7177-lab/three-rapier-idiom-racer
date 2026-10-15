// Free-drive tuning only. Time trials retain their original physics and records.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const initialArcadeAction=()=>({charge:100,grip:1,drifting:false,slip:0,recovery:0,handbrakeScale:1,active:false,power:0,recoveryTorque:0});
// passiveCharge: nitro refilled per second simply by driving. Drifting and
// drafting (slipstream 0..1) always earn charge on top of it.
export function createArcadeAction({recoveryAssist=true,passiveCharge=6,driftCharge=18,draftCharge=0,smoothHandbrake=false}={}){
  let charge=100, grip=1, assist=recoveryAssist;
  return {
    reset({charge:remaining=100}={}){charge=clamp(remaining,0,100);grip=1;},
    addCharge(amount){charge=clamp(charge+(Number(amount)||0),0,100);return charge;},
    setRecoveryAssist(value){assist=!!value;},
    step({speed,groundSpeed=Math.abs(speed),lateral=0,contacts=0,throttle=0,brake=0,reverse=0,handbrake=false,boost=false,draft=0},dt){
      dt=Number.isFinite(dt)?clamp(dt,0,.05):0;
      const grounded=contacts>=3;
      const slip=Math.atan2(Math.abs(lateral),Math.max(1,Math.abs(speed)));
      const motionSpeed=smoothHandbrake&&assist?groundSpeed:speed;
      const initiating=grounded&&motionSpeed>8&&handbrake;
      const t=grounded&&motionSpeed>8&&assist?clamp((slip-.2)/.35,0,1):0;
      const recovery=t*t*(3-2*t);
      const target=initiating?(smoothHandbrake&&assist?.65+.35*recovery:.4+.6*recovery):1;
      grip+=(target-grip)*(1-Math.exp(-dt/(recovery>0?.16:initiating?.12:.38)));
      const drifting=grounded&&motionSpeed>8&&slip>.1&&slip<.65;
      const active=!!boost&&grounded&&speed>5&&speed<280/3.6&&throttle>0&&!brake&&!reverse&&!handbrake&&slip<.3&&charge>0;
      const power=active?Math.min(1,charge/Math.max(.0001,25*dt)):0;
      if(active)charge=Math.max(0,charge-25*dt);
      // Holding an empty trigger never alternates recharge/boost every frame.
      else if(!boost&&grounded&&speed>5&&!brake&&!reverse)charge=Math.min(100,charge+dt*(drifting?driftCharge:passiveCharge)+dt*draftCharge*clamp(Number(draft)||0,0,1));
      return {charge,grip,drifting,slip,recovery,handbrakeScale:(smoothHandbrake&&assist?.25:1)*(1-.85*recovery),assistedDrift:smoothHandbrake&&assist&&grounded&&motionSpeed>8&&(handbrake||slip>.15),active:active&&power>0,power};
    },
  };
}
