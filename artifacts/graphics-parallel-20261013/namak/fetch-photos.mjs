import fs from 'node:fs';
const base=new URL('./',import.meta.url);
const photos=[
 ['jeonnam-park-1.jpg','https://www.jeonnam.go.kr/upload/bbs/IELDSKETCH/7164_1.jpg'],
 ['jeonnam-park-5.jpg','https://www.jeonnam.go.kr/upload/bbs/IELDSKETCH/7164_5.jpg'],
 ['jndc-oryong-render.jpg','https://www.jndc.co.kr/web/main/file/image/uu/2af73fd107c846dc909327a2671d6266'],
];
const result=[];
for(const [file,url] of photos){
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(15000)}),bytes=Buffer.from(await r.arrayBuffer());
  const type=r.headers.get('content-type');
  if(!r.ok||!type?.startsWith('image/'))throw new Error(`status ${r.status}, content-type ${type}`);
  fs.writeFileSync(new URL(file,base),bytes);result.push({file,url,type,bytes:bytes.length});
 }catch(error){result.push({file,url,error:String(error)});}
}
const html=fs.readFileSync(new URL('muan-home.html',base),'utf8');
const anchor=html.match(/href="([^"]+)"[^>]*>무안군 사진DB/);
console.log(JSON.stringify({photos:result,photoDB:anchor?.[1]},null,2));
fs.writeFileSync(new URL('photo-fetch.json',base),JSON.stringify(result,null,2));
