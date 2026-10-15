import fs from 'node:fs';
const p=JSON.parse(fs.readFileSync('package.json','utf8'));
for(const name of ['check:race','check:rebuild']){
 p.scripts[name]=p.scripts[name].replace(/--test-concurrency=1\s*/g,'').replace('node --test ','node --test --test-concurrency=1 scripts/vehicle-finish.test.mjs ');
}
fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');
let runner=fs.readFileSync('artifacts/roadscape-20261013/run-check.mjs','utf8').replaceAll('artifacts/roadscape-20261013','artifacts/vehicle-finish-20261013');
fs.writeFileSync('artifacts/vehicle-finish-20261013/run-check.mjs',runner);
