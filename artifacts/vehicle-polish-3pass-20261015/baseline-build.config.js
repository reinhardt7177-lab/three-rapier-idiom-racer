import base from '../../vite.config.js';
import {resolve} from 'node:path';
export default env=>{
 const config=base(env);
 return {...config,publicDir:false,plugins:[...config.plugins.filter(p=>p?.name!=='rebuild-assets-only'),{
  name:'baseline-vehicle-coatings-only',enforce:'pre',
  resolveId(id){
   if(id.endsWith('/surfacePolish.js'))return resolve('artifacts/vehicle-polish-3pass-20261015/baseline-surface.js');
   if(id.endsWith('/vehicleStudio.js'))return resolve('artifacts/vehicle-polish-3pass-20261015/baseline-studio.js');
  }
 }],build:{...config.build,outDir:'artifacts/vehicle-polish-3pass-20261015/baseline-dist',manifest:true}};
};
