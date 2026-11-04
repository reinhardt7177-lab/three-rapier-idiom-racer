import fs from 'node:fs';
import path from 'node:path';
const out=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const pages=[
 ['muan-home','https://www.muan.go.kr/'],
 ['jeonnam-central-park','https://www.jeonnam.go.kr/FIELDSKETCH/boardList.do?menuId=cyber0201000000&pageIndex=18&searchText=&searchType=&seq=7164'],
 ['jndc-development','https://www.jndc.co.kr/web/main/bbs/bdctydevlop'],
];
const result=[];
for(const [name,url] of pages){
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(15000)}),html=await r.text();
  fs.writeFileSync(path.join(out,`${name}.html`),html);
  const matches=[...html.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/g)].map(m=>new URL(m[1],url).href);
  const related=matches.filter(u=>/photo|image|boardDown|bdctydevlop|IMG|jpg|png|jpeg|down/i.test(u));
  result.push({name,url,status:r.status,bytes:Buffer.byteLength(html),related});
 }catch(error){result.push({name,url,error:String(error)});}
}
fs.writeFileSync(path.join(out,'research-pages.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
