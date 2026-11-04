// Read-only comparison probe. Production code and the browser world are unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initPhysics, createVehiclePhysics} from '../../src/driving/physics.js';
import {RACE_TUNING} from '../../src/rebuild/vehicleDynamics.js';
import {VEHICLES} from '../../src/rebuild/fleet.js';
import {steeringLimit} from '../../src/driving/steering.js';
await initPhysics();
function sample(overrides) {
  const spec=VEHICLES.find(v=>v.id==='supra');
  const sim=createVehiclePhysics({barriers:false,arcade:true,launchEnabled:false,
    progressiveAcceleration:true,spec,raceTuning:{...RACE_TUNING.supra,...overrides},
    start:{x:0,y:.85,z:-300}});
  try {
    for(let i=0;i<240;i++)sim.step({brake:1});
    const trajectory=[];
    for(let i=0;i<720;i++){
      const s=sim.step({throttle:1,steer:.22*Math.sin(i/120)});
      trajectory.push([...Object.values(s.position),...Object.values(s.rotation),
        ...Object.values(s.velocity),s.kmh,...s.wheels.map(w=>w.load)]);
    }
    assert.equal(sim.controller.indexForwardAxis,2);
    return trajectory;
  } finally {sim.dispose();}
}
const baseline=sample({});
const cases=[['grip',{grip:.4}],['antiRoll',{antiRoll:0}],
  ['bodyDamping',{bodyDamping:50}],['aero',{aero:50}]];
const result={scope:'One Supra, flat default floor, 2 seconds settling and 6 seconds accelerating with sinusoidal steering. Separate temporary physics worlds; not a browser symptom reproduction.',
  results:cases.map(([setting,override])=>{
    const changed=sample(override);assert.deepEqual(changed,baseline);
    return {setting,override,identicalAll720Samples:true};
  }),
  steeringDegrees:[60,120,180,240].map(kmh=>({kmh,degrees:steeringLimit(kmh/3.6,true,VEHICLES[0])*180/Math.PI})),
  frameClamp:{wallFrameSeconds:.1,creditedSeconds:Math.min(.05,.1)},
  forwardAxisSetterVerified:true,
  externalSources:[
    {repo:'pmndrs/racing-game',sha:'7816a5d954b75e6ad853ae4e4f0cbbd628072643'},
    {repo:'pmndrs/ecctrl',sha:'e2cab804f9f15661a642e76f52d09f0b2db63f35'},
    {repo:'mrdoob/three.js',sha:'5d8e8a89347650ee210e120cdd70f9e9288f0abc'}
  ]};
fs.writeFileSync(new URL('./probe.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
