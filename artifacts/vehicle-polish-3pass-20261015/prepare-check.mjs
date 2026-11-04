import fs from 'node:fs';
const dir='artifacts/vehicle-polish-3pass-20261015';
let source=fs.readFileSync('artifacts/vehicle-finish-20261013/run-check.mjs','utf8');
source=source.replace("dir=path.join(root,'artifacts/vehicle-finish-20261013')",`dir=path.join(root,'${dir}')`);
source=source.replace('const inputs=[',`const inputs=['${dir}/pass3-blender.json','${dir}/before-manifest.json',`);
fs.writeFileSync(dir+'/run-check.mjs',source);
console.log('Prepared local full regression runner; prior generated evidence will be restored.');
