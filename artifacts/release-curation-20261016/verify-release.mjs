import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),task='artifacts/release-curation-20261016';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const before=JSON.parse(await fs.readFile(`${task}/product-before.json`,'utf8'));
const changed=[];for(const f of before.files){try{if(sha(await fs.readFile(f.path))!==f.sha256)changed.push(f.path);}catch{changed.push(f.path);}}
const files=[],links=[];
async function walk(base='') {for(const e of await fs.readdir(base||'.',{withFileTypes:true})){if(['.git','node_modules','dist','.wrangler','.vercel','.claude'].includes(e.name))continue;const p=path.posix.join(base,e.name),s=await fs.lstat(p);if(s.isSymbolicLink()){links.push(p);continue;}if(s.isDirectory())await walk(p);else if(s.isFile())files.push({path:p,bytes:s.size});}}
await walk();
const images=files.filter(f=>/\.(?:png|jpe?g|webp|gif|svg)$/i.test(f.path));
const imageIndex=JSON.parse(await fs.readFile('docs/blog/image-index.json','utf8'));
for(const f of imageIndex.images){if(sha(await fs.readFile(f.path))!==f.sha256)throw Error(`Selected image changed: ${f.path}`);}
const unwantedImages=images.filter(f=>!imageIndex.images.some(x=>x.path===f.path));
const patterns=[['github-token',/\b(?:gh[pousr]_[a-zA-Z0-9]{30,}|github_pat_[a-zA-Z0-9_]{40,})/],['google-key',/\bAIza[0-9A-Za-z_-]{30,}/],['openai-key',/\bsk-(?:proj-|svcacct-)?[a-zA-Z0-9_-]{35,}/],['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],['bearer-token',/\bBearer [a-zA-Z0-9_.-]{40,}/]];
const publishNames=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const findings=[];
for(const p of publishNames){
 if(/(?:^|\/)(?:\.env(?:\..*)?|[^/]*\.key|auth[^/]*\.json)$/.test(p)||/connector-transfer.*response|transfer-cell|api-probe\.log/.test(p))continue;
 if(!/\.(?:md|mjs|cjs|js|jsx|css|html|json|jsonc|txt|log|err|patch|py|ps1|yml|yaml)$/.test(p))continue;
 try{const s=await fs.lstat(p);if(!s.isFile()||s.isSymbolicLink())continue;const text=await fs.readFile(p,'utf8');for(const [type,re]of patterns){const match=re.exec(text);if(match)findings.push({path:p,type,line:text.slice(0,match.index).split('\n').length});}}catch(e){if(e.code!=='ENOENT')throw e;}
}
const docFiles=['README.md','docs/blog/MAKING_OF.md','docs/blog/IMAGES.md','docs/RELEASE_HANDOFF_20261016.md','docs/PR_RELEASE_20261016.md'];
const broken=[];for(const p of docFiles){let t;try{t=await fs.readFile(p,'utf8');}catch{continue;}for(const m of t.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){const href=m[1];if(/^(?:https?:|#)/.test(href))continue;try{await fs.access(path.resolve(path.dirname(p),href.split('#')[0]));}catch{broken.push({doc:p,href});}}}
const report={protected:before.files.length,productChanges:changed,images:images.length,imageBytes:images.reduce((n,f)=>n+f.bytes,0),unwantedImages:unwantedImages.map(f=>f.path),secretFindings:findings,brokenNewDocLinks:broken,linksPreserved:links.length,filesOver100MB:files.filter(f=>f.bytes>1e8)};
await fs.writeFile(`${task}/verification.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(changed.length||images.length!==20||unwantedImages.length||findings.length||broken.length)process.exitCode=1;
