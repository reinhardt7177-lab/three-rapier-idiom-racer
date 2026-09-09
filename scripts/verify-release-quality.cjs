const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const BASE = (process.env.GARAGE_BASE_URL || 'http://127.0.0.1:5175').replace(/\/$/, '');
const output = path.resolve(process.env.GARAGE_ARTIFACT_ROOT || 'artifacts/release-quality', 'shell');

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.GARAGE_BROWSER_PATH, args: ['--enable-unsafe-swiftshader'] });
  const result = { checkedAt: new Date().toISOString(), layouts: [], checks: [], failures: [], note: 'Chrome software GPU; viewport checks are not physical Samsung testing.' };
  let page;
  try {
    page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '챕터 선택 →', exact: true }).waitFor();
    for (const [width, height] of [[1280,800], [800,1280], [390,844], [640,400]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(150);
      const layout = await page.evaluate(() => {
        const rect = e => { const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,right:r.right}; };
        const toolbar = document.querySelector('.toolbar');
        return { width:innerWidth, height:innerHeight, scrollHeight:document.documentElement.scrollHeight, scrollWidth:document.documentElement.scrollWidth, scene:rect(document.querySelector('.prototype')), toolbar:rect(toolbar), story:rect(document.querySelector('.garage-story')), entry:rect(document.querySelector('.campaign-entry')), tools:[...toolbar.querySelectorAll('button')].map(e=>({name:e.getAttribute('aria-label')||e.textContent,...rect(e)})) };
      });
      result.layouts.push(layout);
      if (layout.scrollHeight > height + 1) result.failures.push(`garage vertical overflow at ${width}x${height}: ${layout.scrollHeight}`);
      if (layout.scrollWidth > width + 1) result.failures.push(`garage horizontal overflow at ${width}x${height}`);
      if (layout.toolbar.bottom > height || layout.toolbar.y < 0) result.failures.push(`garage tools outside viewport at ${width}x${height}`);
      if (layout.story.bottom > layout.toolbar.y) result.failures.push(`garage story overlaps tools at ${width}x${height}`);
      for (const tool of layout.tools) if(tool.h < 44 || tool.w < 44) result.failures.push(`small garage control ${tool.name} at ${width}x${height}`);
      await page.getByRole('button',{name:'테라코타',exact:true}).click();
      await page.getByRole('button',{name:'차량 가까이',exact:true}).click();
      await page.getByRole('button',{name:'차고 전체',exact:true}).click();
      await page.getByRole('button', { name: '챕터 선택 →', exact:true }).click();
      await page.getByRole('button', { name: '챕터 선택 닫기' }).click();
      await page.screenshot({ path:path.join(output, `garage-${width}x${height}.jpg`), type:'jpeg', quality:65 });
    }
    // Isolate a genuine failed dynamic import. No game-state or record injection.
    await page.close();
    page = await browser.newPage({viewport:{width:1280,height:800}});
    const expectedErrors=[];
    page.on('pageerror', e => expectedErrors.push(e.message));
    await page.route('**/src/driving/DrivingMode.jsx*', route => route.abort('failed'));
    await page.goto(BASE, {waitUntil:'networkidle'});
    await page.getByRole('button', {name:'GT 테스트 주행 →',exact:true}).click();
    // Give React the rejected import promise; immediate visibility is not required.
    await page.getByRole('alert').waitFor({timeout:8000}).catch(()=>{});
    const canExit = await page.getByRole('button',{name:'차고로 돌아가기',exact:true}).isVisible();
    if (!canExit) result.failures.push('failed driving module import has no garage recovery');
    else {
      await page.screenshot({path:path.join(output,'module-failed.jpg'),type:'jpeg',quality:65});
      await page.getByRole('button',{name:'차고로 돌아가기',exact:true}).click();
      await page.getByRole('button',{name:'챕터 선택 →',exact:true}).waitFor();
      result.checks.push('network-failed driving module returns to garage without reload');
    }
    result.expectedImportErrors=expectedErrors;
    await page.close();
    page = await browser.newPage({viewport:{width:390,height:844}});
    let delayed;
    await page.route('**/src/driving/DrivingMode.jsx*',route=>{delayed=route;});
    await page.goto(BASE,{waitUntil:'networkidle'});
    await page.getByRole('button',{name:'GT 테스트 주행 →',exact:true}).click();
    await page.getByRole('main',{name:'주행 준비',exact:true}).waitFor();
    await page.getByRole('button',{name:'차고로 돌아가기',exact:true}).click();
    await page.getByRole('button',{name:'챕터 선택 →',exact:true}).waitFor();
    if(delayed) await delayed.abort();
    result.checks.push('pending network load can be cancelled without a reload');
    await fs.writeFile(path.join(output,'verification.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result,null,2));
    assert.deepEqual(result.failures, []);
  } catch(e) {
    await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({...result,error:e.stack},null,2));
    console.error(e); process.exitCode=1;
  } finally { await browser.close(); }
})();
