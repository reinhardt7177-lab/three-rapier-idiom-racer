const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {openMenu,resume,exitDrive}=require('./drive-ui.cjs');
(async()=>{
 const out=process.env.GARAGE_ARTIFACT_ROOT||'artifacts/rival-duel';await fs.mkdir(out,{recursive:true});
 const {createRivalDriver}=await import('../src/driving/rival.js');
 const browser=await chromium.launch({headless:true,executablePath:process.env.GARAGE_BROWSER_PATH,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.GARAGE_BASE_URL||'http://127.0.0.1:5175/',{waitUntil:'networkidle'});
  const records=()=>page.evaluate(()=>Object.fromEntries(['mumu.coast.sprint.v1','mumu.coast.ghost.v1'].map(k=>[k,localStorage.getItem(k)])));
  const original=await records();
  await page.getByRole('button',{name:/해안 라이벌 대결 →/}).click();await page.getByRole('button',{name:'라이벌 대결 출발 →'}).waitFor({timeout:60000});
  await page.screenshot({path:out+'/brief.jpg',type:'jpeg',quality:70});
  await page.getByRole('button',{name:'라이벌 대결 출발 →'}).click();await page.locator('[data-sprint-phase="running"]').waitFor();
  await page.waitForFunction(()=>document.querySelector('[data-duel-place]')?.dataset.duelPlace==='2');
  await openMenu(page);const time=await page.locator('[data-rival-time]').getAttribute('data-rival-time');await page.waitForTimeout(300);assert.equal(await page.locator('[data-rival-time]').getAttribute('data-rival-time'),time);await resume(page);
  const driver=createRivalDriver(3.5),held=new Set();let sigma=0,final;
  const keys=async list=>{for(const k of held)if(!list.includes(k)){await page.keyboard.up(k);held.delete(k);}for(const k of list)if(!held.has(k)){await page.keyboard.down(k);held.add(k);}};
  for(let i=0;i<2000;i++){
   const s=await page.locator('[data-time]').evaluate(e=>({position:{x:+e.dataset.x,z:+e.dataset.z},kmh:+e.dataset.speed,yaw:+e.dataset.heading,phase:document.querySelector('[data-sprint-phase]').dataset.sprintPhase,valid:document.querySelector('[data-sprint-valid]').dataset.sprintValid}));
   if(s.phase==='complete'){final=s;break;}
   if(s.phase==='cooldown'){await keys([]);await page.waitForTimeout(70);continue;}
   assert.equal(s.valid,'true');s.rotation={x:0,y:Math.sin(s.yaw/2),z:0,w:Math.cos(s.yaw/2)};
   const a=driver.input(s);sigma=Math.max(-1.5,Math.min(1.5,sigma+a.steer));let steer=sigma>.5?'KeyD':sigma<-.5?'KeyA':null;if(steer)sigma-=steer==='KeyD'?1:-1;
   await keys([steer,a.brake?'KeyB':a.throttle?'KeyW':null].filter(Boolean));await page.waitForTimeout(55);
  }
  await keys([]);assert.ok(final);const result=await page.locator('[data-duel-result]').getAttribute('data-duel-result');assert.ok(['승리','패배','무승부'].includes(result));
  await page.screenshot({path:out+'/result.jpg',type:'jpeg',quality:70});assert.deepEqual(await records(),original);
  await page.getByRole('button',{name:'라이벌 재도전 →'}).click();assert.equal(await page.locator('[data-rival-time]').getAttribute('data-rival-time'),'0');await page.locator('[data-sprint-phase="running"]').waitFor();
  for(const [width,height] of [[390,844],[640,400],[800,1280],[1024,600]]){
   await page.setViewportSize({width,height});await page.waitForFunction(({width,height})=>{const c=document.querySelector('canvas');return c&&Math.abs(c.clientWidth-width)<2&&Math.abs(c.clientHeight-height)<2;},{width,height});await page.waitForTimeout(250);await resume(page);
   await page.getByRole('button',{name:'니트로 가속',exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:out+`/${width}x${height}.jpg`,type:'jpeg',quality:65});
   assert.ok(await page.locator('.duel-clock').evaluate(e=>{const r=e.getBoundingClientRect();return r.right<=innerWidth&&r.bottom<=innerHeight&&!(r.left<innerWidth*.75&&r.right>innerWidth*.25&&r.top<innerHeight*.8&&r.bottom>innerHeight*.24);}), 'race board keeps protected road corridor clear');
  }
  await exitDrive(page);assert.deepEqual(await records(),original);assert.deepEqual(errors,[]);
  const report={checkedAt:new Date().toISOString(),result,checks:['real keyboard finish against physics rival','pause freezes both vehicles','retry resets rival','4 touch layouts','ordinary records unchanged','garage return'],errors};await fs.writeFile(out+'/verification.json',JSON.stringify(report,null,2));console.log(report);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
