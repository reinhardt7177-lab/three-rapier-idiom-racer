import fs from 'node:fs';
const source=new URL('../../../src/rebuild/yeosuVisuals.js',import.meta.url),test=new URL('../../../scripts/yeosu-visuals.test.mjs',import.meta.url);
// The recorded before-state is absent for both independently assigned files.
// Never overwrite another editor's file during candidate promotion.
if(fs.existsSync(source)||fs.existsSync(test))throw new Error('Assigned target appeared after before-state audit; inspect it before promotion.');
fs.copyFileSync(new URL('./yeosuVisuals.candidate.js',import.meta.url),source);
const text=fs.readFileSync(new URL('./yeosu-visuals.candidate.test.mjs',import.meta.url),'utf8')
 .replace("'./yeosuVisuals.candidate.js'","'../src/rebuild/yeosuVisuals.js'")
 .replaceAll('../../../public/','../public/');
fs.writeFileSync(test,text);
console.log('Promoted only src/rebuild/yeosuVisuals.js and scripts/yeosu-visuals.test.mjs.');
