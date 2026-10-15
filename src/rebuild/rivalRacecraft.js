// Stateful race decisions use physical gaps, charge and road conditions only.
// Position, progress, grip and engine power always belong to the simulation.
export function createRacecraftState(){return {draftAge:0,boostAge:0,boostCooldown:0,boosting:false,tactic:'pace',boosts:0,draftSetups:0,drafting:false,attacking:false};}

export function updateRacecraft(state,{dt,car,lead,openRoad,config,style,remaining}){
 state.boostCooldown=Math.max(0,state.boostCooldown-dt);
 const speed=Math.max(0,car.state.kmh/3.6),charge=car.state.action?.charge??100;
 const drafting=!!config&&openRoad&&lead&&lead.v>40/3.6&&lead.along>=14&&lead.along<=30&&Math.abs(lead.lane-lead.ownLane)<1.5&&Math.abs(speed-lead.v)<5;
 state.draftAge=drafting?state.draftAge+dt:0;
 if(drafting&&!state.drafting)state.draftSetups++;
 state.drafting=!!drafting;
 const attacking=!!config&&Number.isFinite(remaining)&&remaining>0&&remaining<config.attackWindow;
 state.attacking=attacking;
 const patience=(config?.draftPatience??0)*(style?.draftPatience??1);
 const holdDraft=!!drafting&&!attacking&&charge<(config?.boostReserve??0)+15&&state.draftAge<patience;
 state.tactic=holdDraft?'build-draft':attacking?'finish-attack':'pace';
 return {holdDraft,attacking};
}

export function racecraftBoost(state,{dt,car,input,changing,openRoad,enabled,config,style}){
 const s=car.state,charge=s.action?.charge??100;
 const gap=input.targetKmh-s.kmh;
 const safe=enabled&&!changing&&openRoad&&state.tactic!=='build-draft'&&s.contacts>=3&&s.ride?.locked!==false&&(s.surface?.grip??1)>=.8&&!car.scrape&&input.throttle>0&&!input.brake&&!input.waitingForTraffic&&Math.abs(input.steer)<.35;
 const threshold=(style?.boostGap??30)*(state.attacking?.8:1);
 const reserve=state.attacking?8:(config?.boostReserve??8)*(style?.boostReserve??1);
 const minimum=state.boosting?2:reserve;
 const enoughGap=gap>(state.boosting?Math.max(10,threshold*.5):threshold);
 const maxBurst=config?.boostBurst??1.5;
 if(state.boosting&&(!safe||!enoughGap||charge<minimum||state.boostAge>=maxBurst)){
  state.boosting=false;state.boostAge=0;state.boostCooldown=config?.boostCooldown??1.2;
 }
 if(!state.boosting&&safe&&enoughGap&&charge>=minimum&&state.boostCooldown===0){state.boosting=true;state.boosts++;}
 if(state.boosting){state.boostAge+=dt;state.tactic='boost-attack';return true;}
 return false;
}
