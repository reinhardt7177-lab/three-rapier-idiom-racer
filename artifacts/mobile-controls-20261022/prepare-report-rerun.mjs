// Isolate output reports from transient Windows errors opening watched Git files.
// Only import locations and report destinations change; test assertions stay exact.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const isolated='D:/racing/.work/mobile-controls-20261022/isolated';
const files=['duel-race.test.mjs','online-physics.test.mjs','rival-personality-race.test.mjs'];
const manifest=[];
fs.mkdirSync(path.join(isolated,'tests'),{recursive:true});
fs.mkdirSync(path.join(isolated,'reports'),{recursive:true});
for(const name of files){
 const original=path.join(root,'scripts',name),source=fs.readFileSync(original,'utf8');
 let redirects=0;
 const copy=source.replace(/from '(\.\.?\/[^']+)'/g,(_,specifier)=>`from '${pathToFileURL(path.resolve(path.dirname(original),specifier)).href}'`)
  .replace(/new URL\('(\.\.\/artifacts\/[^']+)',import\.meta\.url\)/g,(_,specifier)=>{
   redirects++;
   const suffix=specifier.slice('../artifacts/'.length),output=path.join(isolated,'reports',suffix);
   fs.mkdirSync(specifier.endsWith('/')?output:path.dirname(output),{recursive:true});
   return `new URL('${pathToFileURL(output).href}${specifier.endsWith('/')?'/':''}')`;
  });
 if(!redirects)throw new Error(`No report redirection: ${name}`);
 const assertions=text=>text.split(/\r?\n/).filter(line=>line.includes('assert.'));
 if(JSON.stringify(assertions(source))!==JSON.stringify(assertions(copy)))throw new Error('Assertion changed');
 const target=path.join(isolated,'tests',name);fs.writeFileSync(target,copy);
 manifest.push({original,sha256:crypto.createHash('sha256').update(source).digest('hex'),copy:target,redirects,assertionsUnchanged:true});
}
fs.writeFileSync(new URL('isolated-report-manifest.json',import.meta.url),JSON.stringify({execution:'Local Windows CPU / Rapier WASM; no Colab',manifest},null,2)+'\n');
console.log(JSON.stringify(manifest));
