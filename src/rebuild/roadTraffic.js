import {createVehiclePhysics,STEP} from '../driving/physics.js';
import {VEHICLES} from './fleet.js';
import {RACE_TUNING} from './vehicleDynamics.js';
import {aiInput,nearestRoute,routePose} from './course.js';

export const TRAFFIC_BUDGET=Object.freeze({high:6,medium:4,low:2});
const PROFILE=Object.freeze({maxSpeed:78,lateralAcceleration:3.7,fullBrakingHorizon:true});
// Every traffic car uses the same real Rapier wheel/chassis dynamics as racers.
// Never copy route positions into live bodies; only normal steering/pedals move.
export function createRoadTraffic(world,route,{count=6,surface=null}={}){
 const cars=[];
 for(let i=0;i<Math.max(0,Math.min(6,count));i++){
  const metres=250+i*route.length/7,index=route.points.findIndex(p=>p.distance>=metres),lane=i%2?3.2:-3.2;
  const pose=routePose(route,Math.max(0,index),lane),spec=VEHICLES.find(v=>v.id==='supra');
  const sim=createVehiclePhysics({sharedWorld:world,arcade:true,launchEnabled:false,progressiveAcceleration:true,start:pose.position,spec,raceTuning:RACE_TUNING.supra,surface});
  sim.reset(pose.position,pose.yaw,{stepWorld:false});
  cars.push({id:'traffic',name:`TRAFFIC ${i+1}`,traffic:true,index:Math.max(0,index),lane,pace:.76+i*.035,sim,state:sim.snapshot(),previous:sim.snapshot(),finish:null});
 }
 return {cars,step(racers=[],running=true){
  const participants=[...racers,...cars];
  for(const c of cars)c.sim.prepareStep(running?aiInput(route,c.state,c.index,c.lane,c.pace,participants.filter(o=>o!==c).map(o=>o.state),{speedProfile:PROFILE,trafficGap:12}):{brake:1});
 },finishStep(){for(const c of cars){c.previous=c.state;c.state=c.sim.finishStep();c.index=nearestRoute(route,c.state.position,c.index).index;}},
 snapshot:()=>({count:cars.length,vehicles:cars.map(c=>({name:c.name,kmh:c.state.kmh,position:c.state.position,contacts:c.state.contacts,lane:c.lane}))}),
 dispose(){for(const c of cars)c.sim.dispose();cars.length=0;}};
}
