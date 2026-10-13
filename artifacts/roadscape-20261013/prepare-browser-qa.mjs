import fs from 'node:fs';
import path from 'node:path';
const dir='artifacts/roadscape-20261013';
const absoluteImports=text=>text.replace(/(from\s+|import\s*)(['"])(\.\.?\/[^'"]+)\2/g,(all,prefix,q,relative)=>`${prefix}${q}/${path.posix.normalize('src/rebuild/'+relative)}${q}`);
const main=absoluteImports(fs.readFileSync('src/rebuild/main.jsx','utf8'));
for(const mode of ['baseline','current']){
 fs.writeFileSync(`${dir}/${mode}-main.jsx`,main.replace("from '/src/rebuild/runtime.js'",`from '${mode==='baseline'?'./baseline-runtime.js':'/src/rebuild/runtime.js'}'`));
 fs.writeFileSync(`${dir}/${mode}-game.html`,`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><div id="root"></div><script type="module" src="./${mode}-main.jsx"></script><script type="module" src="./qa-monitor.js"></script></html>`);
}
fs.writeFileSync(`${dir}/baseline-runtime.js`,absoluteImports(fs.readFileSync(`${dir}/before/src/rebuild/runtime.js`,'utf8')));
fs.copyFileSync('artifacts/release-repair-20261012/run-check.mjs',`${dir}/run-check.mjs`);
const check=fs.readFileSync(`${dir}/run-check.mjs`,'utf8').replace("dir=path.join(root,'artifacts/release-repair-20261012')","dir=path.join(root,'artifacts/roadscape-20261013')");
fs.writeFileSync(`${dir}/run-check.mjs`,check);
console.log('Created separate current/baseline local QA entries and full regression runner.');
