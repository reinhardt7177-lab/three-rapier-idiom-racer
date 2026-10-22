import {personalityByName,personalitySpeedProfile} from './rivalPersonalities.js';
import {aiInput,curveSpeeds} from './course.js';
import {RACE_TUNING,RACE_GRID_LANE} from './vehicleDynamics.js';
import {createRacecraftState,updateRacecraft,racecraftBoost} from './rivalRacecraft.js';

const smooth=t=>t*t*(3-2*t);
const dimensions=c=>RACE_TUNING[c.id]||{length:4.8,collisionWidth:2.05};
const speed=(s,p)=>s.velocity?s.velocity.x*p.dx+s.velocity.z*p.dz:Math.max(0,s.kmh/3.6);
function local(route,car,other=car){
  const p=route.points[car.index],s=other.state;
  return {along:(s.position.x-car.state.position.x)*p.dx+(s.position.z-car.state.position.z)*p.dz,
    lane:(s.position.x-p.x)*p.dz-(s.position.z-p.z)*p.dx,v:speed(s,p),side:(s.velocity?.x||0)*p.dz-(s.velocity?.z||0)*p.dx};
}
function easyRoad(route,car){
  const limits=curveSpeeds(route),p=route.points,n=p.length,horizon=35+Math.max(0,car.state.kmh/3.6)*3;
  for(let k=0;k<n;k++){
    const i=(car.index+k)%n,distance=(p[i].distance-p[car.index].distance+route.length)%route.length;
    if(distance>horizon)break;
    if(limits[i]<80)return false;
  }
  return true;
}

// The planner only supplies steering/pedals. Rapier owns every car transform.
// One shared planner arbitrates five rivals before the single world step.
// Advanced traffic prediction belongs to the explicit racecraft configuration.
// Classic, easy and standalone QA callers retain the proven braking envelope.
export function createRivalPlanner(route,{roadClear=()=>false,speedProfile=null,nitro=false,personalities=false,racecraft=null,raceDistance=route.length}={}){
  const plans=new Map();
  function record(car){
    if(!plans.has(car)){const style=personalities?personalityByName(car.name):null;plans.set(car,{style,craft:createRacecraftState(),profile:style?personalitySpeedProfile(speedProfile,style):speedProfile,home:car.lane,target:car.lane,mode:'follow',reason:'following',timer:0,age:0,queueAge:0,cooldown:0,attackCooldown:0,lead:null,passes:0,attempts:0,aborts:0,stop:false,changeSpeed:95});}
    return plans.get(car);
  }
  function mergeClear(car,target,cars,committed=null){
    const own=local(route,car),a=dimensions(car),ownV=Math.max(2,own.v);
    for(const other of cars){
      if(other===car)continue;
      const b=dimensions(other),s=local(route,car,other),plan=plans.get(other);
      if(Math.abs(other.state.position.y-car.state.position.y)>3)continue;
      // Once committed, the actual steering-direction brake guard in aiInput
      // handles the original lead. Re-running a fresh 2.6s crossing from each
      // partial position otherwise deadlocks halfway. A lead that cuts sideways
      // loses this exemption immediately and goes through the full prediction.
      if(other===committed?.lead&&s.along>0&&Math.abs(s.side)<.5&&Math.abs(s.lane-committed.leadLane)<.6)continue;
      // A stopped rear car already behind a lane-centred chassis cannot enter
      // its forward crossing. Omit the prediction buffer for that car only;
      // Rapier retains real bumper contact. Partial crossings, moving rear
      // traffic, reverse motion and sideways traffic still use the full guard.
      if(Math.abs(own.lane)>RACE_GRID_LANE-.6&&s.along<0&&Math.abs(s.lane-own.lane)<1&&own.v>=-.1&&Math.abs(s.v)<.1&&Math.abs(s.side)<.1)continue;
      const lateral=(a.collisionWidth+b.collisionWidth)/2+.55,longitudinal=(a.length+b.length)/2+1.5;
      // Evaluate the entire crossing, including traffic approaching from behind.
      // Also reserve the intended path of an AI that already started merging.
      const relative=s.v-ownV,times=[0,.5,1,1.5,2,2.6];
      if(Math.abs(relative)>.01)for(const gap of [-longitudinal+.001,0,longitudinal-.001]){
        const t=(gap-s.along)/relative;if(t>=0&&t<=2.6)times.push(t);
      }
      for(const t of times){
        const delta=target-own.lane,duration=Math.max(.6,2.6*Math.abs(delta)/(2*RACE_GRID_LANE));
        const fraction=Math.max(smooth(Math.min(1,t/duration)),Math.min(1,Math.max(0,own.side*t/(delta||1))));
        const lane=own.lane+delta*fraction,along=s.along+(s.v-ownV)*t;
        const predicted=s.lane+s.side*t;
        const reserved=plan&&plan.mode!=='follow'?s.lane+(plan.target-s.lane)*smooth(t/2.6):predicted;
        if(Math.abs(along)<longitudinal&&(Math.abs(predicted-lane)<lateral||Math.abs(reserved-lane)<lateral))return false;
      }
      if(plan&&['changing','returning','aborting'].includes(plan.mode)&&Math.abs(plan.target-target)<1&&Math.abs(s.along)<Math.max(25,ownV*3))return false;
    }
    return true;
  }
  function pavement(car,from,to){return roadClear({index:car.index,fromLane:from,toLane:to,state:car.state,dimensions:dimensions(car)});}
  // A high-speed bend still forbids passing. A queue behind a stationary car
  // may use the same full pavement/merge proof at walking speed, otherwise a
  // human stopping in a bend can permanently park every rival behind them.
  function queueEscape(car,lead,plan){return !!speedProfile&&plan.queueAge>=1.2&&car.state.kmh<8&&Math.abs(lead.v)<1&&lead.along>=9&&lead.along<35;}
  function decide(car,cars,plan,trafficEnabled=false){
    const own=local(route,car);plan.stop=false;
    if(car.state.contacts<3||car.state.ride?.locked===false){plan.reason='airborne';return;}
    if(['changing','returning','aborting'].includes(plan.mode)){
      if(Math.abs(own.lane-plan.target)<.45){
        if(plan.mode==='changing'){plan.mode='passing';plan.reason='overtake';}
        else {if(plan.mode==='returning')plan.passes++;plan.mode='follow';plan.lead=null;plan.queuePass=false;plan.cooldown=plan.style?.returnCooldown??3;plan.reason='following';}
        plan.age=0;return;
      }
      const trafficClear=mergeClear(car,plan.target,cars,plan.mode==='changing'?plan:null),roadAvailable=pavement(car,own.lane,plan.target);
      if(!trafficClear||!roadAvailable){
        // A blocked return is a lateral conflict, not a reason to park in front
        // of the car we just passed. Hold the current track, keep normal front
        // braking, and retry the home lane after gaining rear clearance.
        if(plan.mode==='returning'){
          plan.mode='passing';plan.target=own.lane;plan.reason='defer-return';plan.age=0;return;
        }
        // Lost pavement ahead also aborts from mid-crossing: stopping across
        // the lanes would only block every car behind.
        if(plan.mode==='changing'&&(Math.abs(own.lane-plan.home)<1.1||!roadAvailable)&&mergeClear(car,plan.home,cars)&&pavement(car,own.lane,plan.home)){
          plan.mode='aborting';plan.target=plan.home;plan.aborts++;plan.reason='yield';plan.age=0;
        }else if(plan.mode==='changing'&&!trafficClear&&roadAvailable&&pavement(car,own.lane,own.lane)&&cars.some(c=>c!==car&&local(route,car,c).along<0&&local(route,car,c).v>own.v&&!mergeClear(car,plan.target,[car,c],plan))&&mergeClear(car,plan.target,cars.filter(c=>c===car||local(route,car,c).along>=0),plan)){
          // A faster rear car owns the rest of this crossing. Yield laterally
          // by holding the current paved track, not by stopping in its path.
          // Front/cut-in conflicts still fail the separate forward prediction.
          // aiInput retains normal braking for traffic on the held track.
          plan.mode='passing';plan.target=own.lane;plan.reason='yield-rear';plan.age=0;
        }else if(speedProfile&&!trafficClear&&roadAvailable&&own.v<1&&cars.some(c=>{
          if(c===car)return false;const other=local(route,car,c);
          return other.along<0&&other.along>-8&&Math.abs(other.lane-own.lane)<2.6&&Math.abs(other.v)<1;
        })){
          // Two stopped cars can remain inside the conservative merge buffer.
          // Hold this lateral track and drive forward away from the rear car;
          // normal front-car braking stays active. No transform/reset is used.
          plan.mode='passing';plan.target=own.lane;plan.reason='defer-crossing';plan.age=0;
        }else if(!roadAvailable&&pavement(car,own.lane,own.lane)){
          // The target lane narrows ahead but the current track stays paved:
          // keep driving on it with normal front braking, retry later.
          plan.mode='passing';plan.target=own.lane;plan.reason='defer-road';plan.age=0;
        }else {plan.stop=true;plan.reason=trafficClear?'road':'occupied';}
      }else plan.reason=plan.mode==='changing'?'overtake':'return';
      return;
    }
    if(plan.mode==='passing'){
      if(plan.queuePass&&(!plan.lead||!cars.includes(plan.lead)||local(route,car,plan.lead).along<-dimensions(car).length-12))plan.queuePass=false;
      // A pass can meet another slow moving car before the first lead is behind.
      // Re-plan it with the same road, closing-traffic and speed-advantage proof.
      const blocker=cars.filter(c=>c!==car&&Math.abs(c.state.position.y-car.state.position.y)<3)
        .map(c=>({car:c,...local(route,car,c)}))
        .filter(s=>s.along>0&&s.along<Math.max(35,own.v*3+20)&&Math.abs(s.lane-own.lane)<2.3&&(Math.abs(s.v)<1||((trafficEnabled||racecraft)&&speedProfile&&s.v>1&&curveSpeeds(route,plan.profile)[car.index]*(car.pace??1)-s.v*3.6>=plan.passGap)))
        .sort((a,b)=>a.along-b.along)[0];
      if(blocker){
        plan.stop=Math.abs(blocker.v)<1&&blocker.along<16+Math.max(0,own.v)*.5+Math.max(0,own.v)**2/12;plan.reason=Math.abs(blocker.v)<1?'stopped-ahead':'slow-ahead';
        // A rear yield can hold a partial crossing. Pick the side away from the
        // obstruction rather than treating that partial position as a full lane.
        const target=(trafficEnabled||racecraft?blocker.lane:own.lane)<0?RACE_GRID_LANE:-RACE_GRID_LANE;
        const escape=queueEscape(car,blocker,plan);
        if(blocker.along>=9&&(!racecraft||Math.abs(target-own.lane)>.9)&&(!racecraft||Math.abs(blocker.v)<1||plan.attackCooldown===0)&&(easyRoad(route,car)||escape)&&mergeClear(car,target,cars)&&pavement(car,own.lane,target)){
          plan.mode='changing';plan.target=target;plan.lead=blocker.car;plan.leadLane=blocker.lane;
          plan.age=0;plan.stop=false;plan.reason='overtake';plan.attempts++;
          plan.attackCooldown=racecraft?(plan.style?.returnCooldown??3):0;
          plan.changeSpeed=escape?14:car.state.kmh<25?14:Math.max(35,Math.min(speedProfile?150:95,car.state.kmh+10));
          plan.queuePass=escape;
        }
        return;
      }
      const behind=!plan.lead||!cars.includes(plan.lead)||local(route,car,plan.lead).along<-dimensions(car).length-12;
      if(behind&&easyRoad(route,car)&&mergeClear(car,plan.home,cars)&&pavement(car,own.lane,plan.home)){
        plan.mode='returning';plan.target=plan.home;plan.age=0;plan.reason='return';plan.changeSpeed=Math.max(35,Math.min(speedProfile?140:95,car.state.kmh));
      }
      return;
    }
    const lead=cars.filter(c=>c!==car&&Math.abs(c.state.position.y-car.state.position.y)<3)
      .map(c=>({car:c,...local(route,car,c)}))
      .filter(s=>s.along>0&&s.along<Math.max(25,own.v*3+20)&&Math.abs(s.lane-own.lane)<2.3)
      .sort((a,b)=>a.along-b.along)[0];
    plan.reason='following';
    if(!lead||lead.v*3.6>=(plan.profile?.maxSpeed??138)*(car.pace??1)-8)return;
    // Following already matches the lead's speed. Compare available road pace,
    // otherwise a faster rival can never start passing a moving slow player.
    if(lead.v>1&&(speedProfile?curveSpeeds(route,plan.profile)[car.index]*(car.pace??1)-lead.v*3.6<plan.passGap:own.v<lead.v+2))return;
    // Hold the approach gap for a stopped lead instead of creeping so close
    // that there is no room left to steer around it.
    if(lead.v<1&&lead.along<16)plan.stop=true;
    if(lead.v<-2){plan.reason='oncoming';return;}
    if(lead.along<9){plan.reason='too-close';return;}
    if(plan.cooldown>0){plan.reason='cooldown';return;}
    if(plan.holdDraft){plan.reason='drafting';return;}
    const escape=queueEscape(car,lead,plan);
    if(!easyRoad(route,car)&&!escape){plan.reason='curve';return;}
    const target=plan.home<0?RACE_GRID_LANE:-RACE_GRID_LANE;
    if(!mergeClear(car,target,cars)){plan.reason='occupied';return;}
    if(!pavement(car,own.lane,target)){plan.reason='road';return;}
    plan.mode='changing';plan.target=target;plan.lead=lead.car;plan.leadLane=lead.lane;plan.age=0;plan.stop=false;plan.reason='overtake';plan.attempts++;
    plan.attackCooldown=racecraft?(plan.style?.returnCooldown??3):0;
    plan.changeSpeed=escape?14:car.state.kmh<25?14:Math.max(35,Math.min(speedProfile?150:95,car.state.kmh+10));
    plan.queuePass=escape;
  }
  return {
    update(cars,dt,traffic=[]){
      if(!(dt>0&&dt<=.1))return new Map();
      const inputs=new Map(),active=cars.filter(c=>!c.player&&(c.finish==null));
      const participants=traffic.length?[...cars,...traffic]:cars;
      // Front cars commit first; ties use stable race order, never randomness.
      active.sort((a,b)=>(b.progress??0)-(a.progress??0));
      for(const car of active){
        const plan=record(car);plan.age+=dt;plan.queueAge=car.state.kmh<8?plan.queueAge+dt:0;plan.cooldown=Math.max(0,plan.cooldown-dt);plan.attackCooldown=Math.max(0,plan.attackCooldown-dt);plan.timer-=dt;
        if(plan.timer<=0){
          plan.openRoad=easyRoad(route,car);
          const own=local(route,car);
          plan.draftLead=participants.filter(c=>c!==car&&Math.abs(c.state.position.y-car.state.position.y)<3).map(c=>({...local(route,car,c),ownLane:own.lane})).filter(s=>s.along>0&&Math.abs(s.lane-own.lane)<1.5).sort((a,b)=>a.along-b.along)[0];
        }
        const craft=updateRacecraft(plan.craft,{dt,car,lead:plan.draftLead,openRoad:plan.openRoad,config:racecraft,style:plan.style,remaining:raceDistance-(car.progress??0)});
        plan.holdDraft=craft.holdDraft;
        plan.passGap=Math.max(6,(plan.style?.passGap??12)-(craft.attacking?2:0));
        if(plan.timer<=0){plan.timer=.2;decide(car,participants,plan,traffic.length>0);}
        const changing=['changing','returning','aborting'].includes(plan.mode);
        // A car that began passing on the preceding straight can also reach a
        // stopped queue mid-bend. Its normal long look-ahead cuts across the
        // inner lane. Keep the short, slow path until the stopped car is behind.
        const queueNearby=plan.mode==='passing'&&!plan.openRoad&&participants.some(c=>{
          if(c===car||c.state.kmh>=4||Math.abs(c.state.position.y-car.state.position.y)>3)return false;
          const s=local(route,car,c);return s.along>-dimensions(car).length-12&&s.along<35&&Math.hypot(c.state.position.x-car.state.position.x,c.state.position.z-car.state.position.z)<40;
        });
        const careful=plan.queuePass||queueNearby;
        const target=plan.stop?local(route,car).lane:plan.target;
        const input=aiInput(route,car.state,car.index,target,car.pace??1,participants.filter(c=>c!==car).map(c=>c.state),{
          lookAheadMinimum:(changing||careful)&&car.state.kmh<35?4:12,preciseAim:changing||careful,speedProfile:plan.profile,
          adaptiveBraking:!!racecraft,predictiveTraffic:!!racecraft,
          // Keep the approach outside the 9m crossing guard. Closing to the
          // former 6m following gap made every later passing request too close.
          trafficGap:changing?6:12,restoreFollowGap:traffic.length>0&&!changing,
          speedLimit:plan.stop?0:careful?14:changing?plan.changeSpeed:Infinity,stop:plan.stop,waitingForTraffic:plan.stop,
        });
        if(plan.stop)input.throttle=0;
        // Same nitro rules as the player: spent only while settled on a clear
        // straight with plenty of permitted speed left, never during a merge.
        const boost=racecraftBoost(plan.craft,{dt,car,input,changing:changing||plan.stop||careful,openRoad:plan.openRoad,enabled:nitro,config:racecraft,style:plan.style});
        if(boost)input.boost=true;
        inputs.set(car,input);
      }
      return inputs;
    },
    snapshot(car){const p=plans.get(car);return p?{personality:p.style?.name??null,style:p.style?.label??null,mode:p.mode,reason:p.reason,homeLane:p.home,targetLane:p.target,passes:p.passes,attempts:p.attempts,aborts:p.aborts,age:p.age,tactic:p.craft.tactic,boosts:p.craft.boosts,draftSetups:p.craft.draftSetups}:null;},
    reset(car,lane=car?.lane){if(!car){plans.clear();return;}const old=plans.get(car);plans.delete(car);const p=record(car);p.home=p.target=lane;p.cooldown=2;p.passes=old?.passes??0;p.attempts=old?.attempts??0;p.aborts=old?.aborts??0;},
  };
}
