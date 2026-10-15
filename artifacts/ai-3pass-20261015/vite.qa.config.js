import base from '../../vite.config.js';
export default env=>({...base(env),server:{watch:{ignored:['**/artifacts/**','**/assets-sources/**']}}});
