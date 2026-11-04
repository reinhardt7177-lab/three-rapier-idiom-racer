import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=new URL('./',import.meta.url);
const layouts=JSON.parse(fs.readFileSync(new URL('layouts.json',base),'utf8'));
const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
const results=layouts.map(({viewport,stage,buttons,camera,speed,display,paused})=>{
 assert.equal(display,'grid');assert.equal(paused,false);assert.equal(buttons.length,6);
 for(const {name,rect,hit} of buttons){
  assert.ok(rect.width>=44&&rect.height>=44,`${viewport}: ${name} hit size`);
  assert.ok(rect.left>=stage.left&&rect.top>=stage.top&&rect.right<=stage.right+.01&&rect.bottom<=stage.bottom+.01,`${viewport}: ${name} stage clipping`);
  assert.ok(rect.left>=0&&rect.top>=0&&rect.right<=viewport[0]+1&&rect.bottom<=viewport[1]+1,`${viewport}: ${name} viewport clipping`);
  assert.equal(hit,true,`${viewport}: ${name} centre occluded`);
  assert.ok(!overlaps(rect,camera)&&!overlaps(rect,speed),`${viewport}: ${name} HUD overlap`);
 }
 for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++)assert.ok(!overlaps(buttons[i].rect,buttons[j].rect));
 return {viewport,buttons:buttons.length,size:buttons[0].rect.width,clipped:0,occluded:0,overlaps:0};
});
fs.writeFileSync(new URL('layout-validation.json',base),JSON.stringify({passed:true,results},null,2)+'\n');
console.log(JSON.stringify({passed:true,results}));
