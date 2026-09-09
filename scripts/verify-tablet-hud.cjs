const BASE_URL = (process.env.GARAGE_BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { openMenu, resume, resetDrive, inspectDrive, exitDrive } = require('./drive-ui.cjs');
(async () => {
  const output = path.resolve(process.env.GARAGE_ARTIFACT_ROOT || 'artifacts','tablet-hud'); await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.GARAGE_BROWSER_PATH, args: ['--enable-unsafe-swiftshader'] });
  const errors = [], failures = [], layouts = [], checks = [];
  let page;
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true, deviceScaleFactor: 2 });
    page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('requestfailed', r => failures.push(r.url()));
    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '해안도로 드라이브 →' }).click();
    await page.waitForFunction(() => +document.querySelector('[data-time]')?.dataset.time > 1, null, { timeout: 60000 });
    const read = () => page.locator('[data-time]').evaluate(e => ({ x:+e.dataset.x,z:+e.dataset.z,speed:+e.dataset.speed,time:+e.dataset.time,quality:e.dataset.quality,ratio:+e.dataset.pixelRatio,shadow:+e.dataset.shadowSize }));
    const screenshot = name => page.screenshot({ path: path.join(output,name+'.jpg'), type:'jpeg',quality:72,scale:'css' });
    assert.equal((await read()).quality,'light'); assert.equal((await read()).shadow,1024); assert.ok((await read()).ratio <= 1);
    for (const [width,height] of [[1280,800],[800,1280],[1024,600],[600,960],[390,844],[640,400]]) {
      await page.setViewportSize({width,height});
      // Wait for the WebGL resize (not only the browser viewport). A delayed
      // ResizeObserver correctly opens the safety pause, even after 400ms.
      await page.waitForFunction(({width,height})=>{const c=document.querySelector('canvas');return c&&Math.abs(c.clientWidth-width)<2&&Math.abs(c.clientHeight-height)<2;},{width,height});
      await page.waitForTimeout(250);await resume(page);
      await page.getByRole('button',{name:'주행 사운드 켜기',exact:true}).waitFor({state:'visible'});
      const layout = await page.evaluate(() => {
        const zone = {left:innerWidth*.25,right:innerWidth*.75,top:innerHeight*.24,bottom:innerHeight*.8};
        const overlaps = [...document.querySelectorAll('[data-driving-overlay]')].filter(e=>{
          const b=e.getBoundingClientRect(); return b.width && b.height && getComputedStyle(e).display!=='none' && b.left<zone.right && b.right>zone.left && b.top<zone.bottom && b.bottom>zone.top;
        }).map(e=>e.className);
        const buttons=[...document.querySelectorAll('.driving-controls button,.pause-trigger,.sound-trigger')].filter(e=>e.getBoundingClientRect().width).map(e=>{const b=e.getBoundingClientRect();return {label:e.getAttribute('aria-label')||e.textContent,w:b.width,h:b.height,left:b.left,right:b.right,top:b.top,bottom:b.bottom};});
        return {width:innerWidth,height:innerHeight,layout:document.querySelector('.driving-shell').dataset.layout,overlaps,buttons,overflow:document.documentElement.scrollWidth>innerWidth};
      });
      assert.deepEqual(layout.overlaps,[],'protected road corridor'); assert.equal(layout.overflow,false);
      assert.ok(layout.buttons.every(b=>b.w>=48 && b.h>=48 && b.left>=0 && b.right<=width && b.bottom<=height),'touch targets contained and large');
      assert.equal(layout.buttons.filter(b=>b.label==='주행 사운드 켜기').length,1,'sound control included in every touch layout');
      for (let i=0;i<layout.buttons.length;i++) for(let j=i+1;j<layout.buttons.length;j++) {
        const a=layout.buttons[i],b=layout.buttons[j];
        assert.ok(!(a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top),`touch controls overlap: ${a.label} / ${b.label}`);
      }
      assert.equal(await page.getByLabel('그래픽 품질',{exact:true}).count(),0,'settings absent while driving');
      layouts.push(layout); await screenshot(`${width}x${height}`);
    }
    await page.setViewportSize({width:1280,height:800}); await page.waitForTimeout(400); await resume(page);
    await openMenu(page); const frozen=await read(); await page.waitForTimeout(400); assert.equal((await read()).time,frozen.time);
    await screenshot('menu');
    await page.getByLabel('그래픽 품질',{exact:true}).selectOption('standard'); await page.waitForTimeout(250);
    assert.equal((await read()).shadow,2048); assert.ok((await read()).ratio>1);
    assert.equal((await read()).time,frozen.time,'graphics changes do not advance physics');
    await page.getByLabel('그래픽 품질',{exact:true}).selectOption('light');
    await page.getByLabel('터치 버튼 표시',{exact:true}).selectOption('off'); await resume(page);
    assert.equal(await page.locator('.driving-controls').count(),0);
    await openMenu(page); await page.getByLabel('터치 버튼 표시',{exact:true}).selectOption('auto');
    await page.keyboard.press('Tab'); assert.ok(await page.evaluate(()=>document.activeElement.closest('dialog')!==null),'focus remains in modal');
    await page.keyboard.press('Escape'); await page.waitForTimeout(200); assert.equal(await page.getByRole('dialog').count(),0);
    checks.push('pause freezes physics; graphics/touch settings; modal keyboard focus/Escape');
    await resetDrive(page); await page.waitForTimeout(700);
    const cdp=await context.newCDPSession(page);
    const point=async(label,id)=>{const b=await page.getByRole('button',{name:label,exact:true}).boundingBox();return {id,x:b.x+b.width/2,y:b.y+b.height/2,radiusX:8,radiusY:8,force:1};};
    const origin=await read();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[await point('가속',1),await point('왼쪽 조향',2)]});
    await page.waitForTimeout(900); const turned=await read(); assert.ok(turned.speed>5 && turned.x>origin.x+.2,'real two-finger gas+left');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]}); await page.waitForTimeout(300); const coast=await read(); await page.waitForTimeout(400); assert.ok((await read()).speed<coast.speed+.3,'cancel releases gas');
    await resetDrive(page); await page.waitForTimeout(600);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[await point('가속',3)]}); await page.waitForTimeout(700);
    await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor(); const stopped=await read(); await page.waitForTimeout(400); assert.equal((await read()).time,stopped.time);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await resume(page); await page.waitForTimeout(400); assert.ok((await read()).speed<stopped.speed+.3,'menu clears held touch');
    await resetDrive(page); await page.waitForTimeout(600);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[await point('가속',4)]}); await page.waitForTimeout(600);
    await page.setViewportSize({width:800,height:1280}); await page.getByRole('dialog').waitFor();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); const rotated=await read(); await resume(page); await page.waitForTimeout(400); assert.ok((await read()).speed<rotated.speed+.3);
    checks.push('CDP native two-finger gas+steering; touch cancellation; held-input menu and rotation safety');
    await resetDrive(page); await page.waitForTimeout(700); await inspectDrive(page);
    await page.keyboard.down('KeyA'); await page.waitForTimeout(400); assert.ok(+await page.locator('[data-left-angle]').getAttribute('data-left-angle')>30); await page.keyboard.up('KeyA');
    await page.getByRole('button',{name:'점검 닫고 주행',exact:true}).click();
    await page.keyboard.down('KeyW'); await page.waitForTimeout(700); await page.keyboard.up('KeyW'); assert.ok((await read()).speed>5,'focus restored after inspection');
    await exitDrive(page); await page.getByRole('heading',{name:'항구 정비소'}).waitFor(); await page.reload({waitUntil:'networkidle'});
    await page.getByRole('button',{name:'해안도로 드라이브 →'}).click(); await page.waitForFunction(()=>+document.querySelector('[data-time]')?.dataset.time>.5);
    assert.equal((await read()).quality,'light'); assert.equal(await page.locator('canvas').count(),1);
    checks.push('parked inspection through menu; driving focus restored; garage/reload settings persist');
    assert.deepEqual(errors,[]); assert.deepEqual(failures,[]);
    const report={checkedAt:new Date().toISOString(),layouts,checks,errors,failures,note:'Chrome touch emulation/software GPU. Samsung Internet/physical Galaxy Tab sustained FPS and thermal testing remain unverified. No vehicle transform writes.'};
    await fs.writeFile(path.join(output,'verification.json'),JSON.stringify(report,null,2)); console.log(JSON.stringify(report,null,2));
  } catch(e) { if(page) await page.screenshot({path:path.join(output,'failure.jpg'),type:'jpeg',quality:70,timeout:5000}).catch(()=>{}); throw e; }
  finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
