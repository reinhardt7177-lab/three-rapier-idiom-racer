const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
  const output = path.resolve('artifacts/vehicle-stage1'); await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.GARAGE_BROWSER_PATH, args: ['--enable-unsafe-swiftshader'] });
  const errors = [], failures = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('requestfailed', r => failures.push(r.url()));
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '테라코타', exact: true }).click();
    await page.getByRole('button', { name: 'GT 테스트 주행 →' }).click();
    await page.waitForFunction(() => Number(document.querySelector('[data-time]')?.dataset.time) > .5, null, { timeout: 60000 });
    assert.equal(await page.locator('canvas').count(), 1);
    const measure = () => page.locator('[data-testid=telemetry]').evaluate(e => ({ speed: +e.dataset.speed, z: +e.dataset.z, x: +e.dataset.x, time: +e.dataset.time }));
    await page.locator('canvas').focus(); await page.keyboard.down('KeyW');
    await page.waitForFunction(() => Number(document.querySelector('[data-speed]')?.dataset.speed) > 200, null, { timeout: 60000 });
    await page.keyboard.up('KeyW'); const fast = await measure();
    await page.getByRole('button', { name: '일시정지', exact: true }).click();
    await page.screenshot({ path: path.join(output, 'paused.jpg'), type: 'jpeg', quality: 60 });
    const beforePause = await measure(); await page.waitForTimeout(350); assert.deepEqual(await measure(), beforePause);
    await page.getByRole('button', { name: '주행 재개', exact: true }).click();
    await page.keyboard.down('KeyB');
    await page.waitForFunction(() => Number(document.querySelector('[data-speed]')?.dataset.speed) < 1, null, { timeout: 30000 });
    await page.keyboard.up('KeyB'); const stopped = await measure();
    await page.keyboard.down('KeyS');
    await page.waitForFunction(z => Number(document.querySelector('[data-z]')?.dataset.z) < z - 3, stopped.z, { timeout: 15000 });
    await page.keyboard.up('KeyS'); const reverse = await measure();
    await page.keyboard.press('KeyR');
    await page.waitForFunction(() => Math.abs(Number(document.querySelector('[data-z]')?.dataset.z) + 720) < .2);
    await page.keyboard.down('KeyW'); await page.keyboard.down('KeyD');
    await page.waitForFunction(() => Number(document.querySelector('[data-x]')?.dataset.x) < -2, null, { timeout: 15000 });
    await page.keyboard.up('KeyD'); await page.keyboard.up('KeyW'); const turned = await measure();
    const steeringChecks = [{ input: 'KeyD', ...turned }];
    for (const [key, worldSign] of [['KeyA', 1], ['ArrowLeft', 1], ['ArrowRight', -1]]) {
      await page.keyboard.press('KeyR');
      await page.waitForFunction(() => Math.abs(Number(document.querySelector('[data-x]')?.dataset.x)) < .1);
      await page.keyboard.down('KeyW'); await page.keyboard.down(key);
      await page.waitForFunction(sign => Number(document.querySelector('[data-x]')?.dataset.x) * sign > 2, worldSign, { timeout: 15000 });
      await page.keyboard.up(key); await page.keyboard.up('KeyW');
      steeringChecks.push({ input: key, ...await measure() });
    }
    await page.keyboard.press('KeyR'); await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(output, 'test-drive.jpg'), type: 'jpeg', quality: 65 });
    await page.screenshot({ path: path.join(output, 'test-drive.png') });
    // Losing focus clears throttle and requires deliberate resume.
    await page.keyboard.down('KeyW'); await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.keyboard.up('KeyW');
    await page.getByRole('heading', { name: '잠시 정차합니다' }).waitFor();
    await page.getByRole('button', { name: '주행 재개', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    const gas = page.getByRole('button', { name: '가속', exact: true }); const rect = await gas.boundingBox();
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
    await page.waitForFunction(() => Number(document.querySelector('[data-speed]')?.dataset.speed) > 20, null, { timeout: 15000 });
    await page.mouse.up();
    for (const [label, worldSign] of [['왼쪽 조향', 1], ['오른쪽 조향', -1]]) {
      await page.getByRole('button', { name: '시작점 복귀 · R' }).click();
      await page.waitForFunction(() => Math.abs(Number(document.querySelector('[data-x]')?.dataset.x)) < .1);
      await page.locator('canvas').focus(); await page.keyboard.down('KeyW');
      const bounds = await page.getByRole('button', { name: label, exact: true }).boundingBox();
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.down();
      await page.waitForFunction(sign => Number(document.querySelector('[data-x]')?.dataset.x) * sign > 2, worldSign, { timeout: 15000 });
      await page.mouse.up(); await page.keyboard.up('KeyW');
      steeringChecks.push({ input: label, ...await measure() });
    }
    await page.getByRole('button', { name: '시작점 복귀 · R' }).click(); await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(output, 'mobile.jpg'), type: 'jpeg', quality: 65 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole('button', { name: '차고로 돌아가기', exact: true }).click();
    await page.getByRole('heading', { name: '항구 정비소' }).waitFor();
    assert.equal(await page.getByRole('button', { name: '테라코타', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('canvas').count(), 1);
    await page.getByRole('button', { name: 'GT 테스트 주행 →' }).click();
    await page.waitForFunction(() => Number(document.querySelector('[data-time]')?.dataset.time) > .5);
    assert.equal(await page.locator('canvas').count(), 1);
    assert.equal(await page.locator('vite-error-overlay,[role=alert]').count(), 0);
    assert.deepEqual(errors, []); assert.deepEqual(failures, []);
    const report = { checkedAt: new Date().toISOString(), errors, failures, fast, stopped, reverse, turned, steeringChecks, checks: ['200+ real physics km/h', 'brake', 'reverse', 'A/D and arrows: screen-correct left/right', 'pointer buttons: screen-correct left/right', 'reset', 'pause freezes simulation', 'blur clears controls', 'mobile pointer throttle', 'garage return preserves paint', 'reentry has one canvas'], note: 'Rear camera looking +Z: screen-right is world -X at spawn. Headless software rendering, not a hardware FPS benchmark.' };
    await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
