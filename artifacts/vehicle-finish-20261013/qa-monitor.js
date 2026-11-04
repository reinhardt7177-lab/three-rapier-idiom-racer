// Local inspection page only. Reads state on demand; no timer/profile/GPU queries.
const controls=document.createElement('div');controls.style.cssText='position:fixed;z-index:10000;top:0;right:0;font:10px monospace;background:#111;color:#ddd;max-width:180px';
const button=document.createElement('button');button.textContent='검증 상태 읽기';button.style.fontSize='10px';
const output=document.createElement('textarea');output.setAttribute('aria-label','검증 상태');output.style.cssText='display:none;width:175px;height:25px';controls.append(button,output);document.body.append(controls);
button.onclick=()=>{
 const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;};
 const selectors=['.garage-heading','.vehicle-heading','.garage-launch','.position-card','.race-route','.race-clock','.speed-card','.race-standings','.race-result','.race-menu','.touch-controls'];
 const boxes=selectors.flatMap(name=>[...document.querySelectorAll(name)].filter(visible).map(e=>{const r=e.getBoundingClientRect();return {name,x:r.x,y:r.y,w:r.width,h:r.height};}));
 const clipped=boxes.filter(r=>r.x<-.6||r.y<-.6||r.x+r.w>innerWidth+.6||r.y+r.h>innerHeight+.6),overlaps=[];
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];if([a.name,b.name].some(n=>['.race-menu','.race-result'].includes(n)))continue;if(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>.6&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>.6)overlaps.push([a.name,b.name]);}
 const canvas=document.querySelector('canvas'),gl=canvas?.getContext('webgl2'),ext=gl?.getExtension('WEBGL_debug_renderer_info');
 output.style.display='block';output.value=JSON.stringify({time:new Date().toISOString(),state:window.__mumuRebuild,layout:{width:innerWidth,height:innerHeight,boxes,clipped,overlaps},gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,resources:performance.getEntriesByType('resource').map(r=>({name:r.name,encoded:r.encodedBodySize,transferred:r.transferSize,duration:r.duration}))});
};
