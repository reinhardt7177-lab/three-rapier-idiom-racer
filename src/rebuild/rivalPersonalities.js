// Names determine a stable driving style. Only desired speeds, passing intent
// and nitro pedals vary; these values never write a vehicle transform/progress.
export const RIVAL_PERSONALITIES=Object.freeze([
 {name:'NOVA',label:'코너 강자',topSpeed:.99,cornerGrip:1.04,passGap:12,returnCooldown:3,boostGap:34},
 {name:'RAVEN',label:'공격형',topSpeed:1.015,cornerGrip:1,passGap:8,returnCooldown:2.2,boostGap:22},
 {name:'BLAZE',label:'직선 강자',topSpeed:1.025,cornerGrip:.99,passGap:10,returnCooldown:3.5,boostGap:18},
 {name:'MIST',label:'수비형',topSpeed:.98,cornerGrip:.98,passGap:18,returnCooldown:5,boostGap:38},
 {name:'LUNA',label:'균형형',topSpeed:1,cornerGrip:1,passGap:12,returnCooldown:3,boostGap:30},
].map(Object.freeze));
export const personalityByName=name=>RIVAL_PERSONALITIES.find(p=>p.name===name)||RIVAL_PERSONALITIES[4];
export function personalitySpeedProfile(base,personality){
 if(!base)return null;
 return Object.freeze({...base,maxSpeed:base.maxSpeed*personality.topSpeed,lateralAcceleration:base.lateralAcceleration*personality.cornerGrip});
}
