const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
  const output = path.resolve('artifacts/harbor-road'); await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.GARAGE_BROWSER_PATH, args: ['--enable-unsafe-swiftshader'] });
  const errors = [], failures = [], external = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('requestfailed', r => failures.push(r.url()));
    page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:5173') && /^https?:/.test(r.url())) external.push(r.url()); });
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '아이보리', exact: true }).click(); await page.getByRole('button', { name: 'GT 테스트 주행 →' }).click();
    await page.waitForFunction(() => +document.querySelector('[data-time]')?.dataset.time > .6, null, { timeout: 60000 });
    assert.equal(await page.locator('canvas').count(), 1); assert.equal(await page.locator('[role=alert],vite-error-overlay').count(), 0);
    await page.screenshot({ path: path.join(output, 'harbor-start.jpg'), type: 'jpeg', quality: 70 });
    await page.screenshot({ path: path.join(output, 'harbor-start.png') });
    const perf = page.evaluate(() => new Promise(resolve => {
      const frames = [], start = performance.now(), el = document.querySelector('[data-time]'); const simStart = +el.dataset.time; let last = start;
      const tick = now => { frames.push(now - last); last = now; if (now - start < 8000) requestAnimationFrame(tick); else { frames.sort((a, b) => a - b); resolve({ wallSeconds: (now - start) / 1000, simulationSeconds: +el.dataset.time - simStart, fps: frames.length * 1000 / (now - start), p95FrameMs: frames[Math.floor(frames.length * .95)], framesOver100ms: frames.filter(v => v > 100).length, drawCalls: +el.dataset.drawCalls, speed: +el.dataset.speed, z: +el.dataset.z }); } }; requestAnimationFrame(tick);
    }));
    await page.locator('canvas').focus(); await page.keyboard.down('KeyW');
    const measurement = await perf;
    await page.waitForFunction(() => +document.querySelector('[data-speed]')?.dataset.speed > 220, null, { timeout: 30000 });
    await page.screenshot({ path: path.join(output, 'harbor-fast.jpg'), type: 'jpeg', quality: 70 }); await page.keyboard.up('KeyW');
    await page.keyboard.press('KeyR'); await page.waitForTimeout(500);
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(output, 'harbor-mobile.jpg'), type: 'jpeg', quality: 65 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole('button', { name: '차고로 돌아가기', exact: true }).click(); await page.getByRole('heading', { name: '항구 정비소' }).waitFor();
    assert.equal(await page.getByRole('button', { name: '아이보리', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.deepEqual(errors, []); assert.deepEqual(failures, []); assert.deepEqual(external, []);
    const report = { checkedAt: new Date().toISOString(), errors, failures, external, measurement, checks: ['detailed harbor road renders', '220+ km/h', 'desktop/mobile layout', 'garage return preserves ivory paint'], note: 'Headless software GPU; performance measurements are not the user in-app browser.' };
    await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
