const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {openMenu,resume,exitDrive}=require('./drive-ui.cjs');
(async()=>{
 const out='artifacts/arcade-action';await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.GARAGE_BROWSER_PATH,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.GARAGE_BASE_URL||'http://127.0.0.1:5175/',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'해안도로 드라이브 →'}).click();await page.locator('[data-nitro]').waitFor({timeout:60000});
  await page.locator('canvas').focus();await page.keyboard.down('ShiftLeft');
  await page.waitForFunction(()=>document.querySelector('[data-boost]')?.dataset.boost==='true');
  await page.waitForTimeout(700);
  const used=+await page.locator('[data-nitro]').getAttribute('data-nitro');assert.ok(used<100);
  await page.screenshot({path:out+'/nitro.jpg',type:'jpeg',quality:75});
  await openMenu(page);const t=await page.locator('[data-time]').getAttribute('data-time');await page.waitForTimeout(400);assert.equal(await page.locator('[data-time]').getAttribute('data-time'),t);
  await page.keyboard.up('ShiftLeft');await resume(page);await page.waitForTimeout(400);assert.equal(await page.locator('[data-boost]').getAttribute('data-boost'),'false');
  const cdp=await page.context().newCDPSession(page);
  const b=await page.getByRole('button',{name:'니트로 가속',exact:true}).boundingBox();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]});
  await page.waitForFunction(()=>document.querySelector('[data-boost]')?.dataset.boost==='true');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await page.waitForTimeout(400);assert.equal(await page.locator('[data-boost]').getAttribute('data-boost'),'false');
  await exitDrive(page);await page.getByRole('button',{name:/해안 스프린트 →/}).click();await page.locator('[data-sprint-phase="briefing"]').waitFor({timeout:60000});
  assert.equal(await page.locator('[data-nitro]').count(),0);assert.deepEqual(errors,[]);
  const report={checkedAt:new Date().toISOString(),remainingAfterBoost:used,checks:['real keyboard boost consumes charge','pause freezes physics and clears boost','native touch boost and cancellation','sprint has no arcade controls'],errors,note:'Headless Chrome software GPU; not physical Samsung certification.'};
  await fs.writeFile(out+'/verification.json',JSON.stringify(report,null,2));console.log(report);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
