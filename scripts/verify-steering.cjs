const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
  const output = path.resolve('artifacts/steering-redesign'); await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.GARAGE_BROWSER_PATH, args: ['--enable-unsafe-swiftshader'] });
  const errors = [], failures = [], results = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('requestfailed', r => failures.push(r.url()));
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '해안도로 드라이브 →' }).click();
    await page.waitForFunction(() => +document.querySelector('[data-time]')?.dataset.time > 1, null, { timeout: 60000 });
    const read = () => page.locator('[data-time]').evaluate(e => ({ x: +e.dataset.x, z: +e.dataset.z, speed: +e.dataset.speed, yaw: +e.dataset.heading, contacts: +e.dataset.contacts }));
    const angles = () => page.locator('[data-left-angle]').evaluate(e => ({ left: +e.dataset.leftAngle, right: +e.dataset.rightAngle }));
    await page.getByRole('button', { name: '정차 후 바퀴 점검', exact: true }).click();
    const start = await read();
    for (const [code, sign] of [['KeyA', 1], ['KeyD', -1]]) {
      await page.keyboard.down(code); await page.waitForTimeout(600);
      const a = await angles(); results.push({ code, ...a });
      assert.ok(a.left * sign > 20 && a.right * sign > 20);
      assert.ok(sign > 0 ? a.left > a.right : a.right < a.left);
      await page.screenshot({ path: path.join(output, code + '.jpg'), type: 'jpeg', quality: 80 });
      await page.keyboard.up(code); await page.waitForTimeout(650);
      const centred = await angles(); assert.ok(Math.abs(centred.left) < .1 && Math.abs(centred.right) < .1);
    }
    await page.keyboard.down('KeyW'); await page.waitForTimeout(500); await page.keyboard.up('KeyW');
    assert.ok(Math.abs((await read()).z - start.z) < .1, 'inspection is safely stationary');
    await page.getByRole('button', { name: '점검 닫고 주행', exact: true }).click();
    for (const [code, sign] of [['KeyA', 1], ['KeyD', -1]]) {
      await page.keyboard.press('KeyR'); await page.waitForTimeout(700);
      const origin = await read();
      await page.keyboard.down('KeyW'); await page.keyboard.down(code);
      await page.waitForFunction(({ sign, x }) => (Number(document.querySelector('[data-x]')?.dataset.x) - x) * sign > 2, { sign, x: origin.x }, { timeout: 15000 });
      await page.keyboard.up('KeyW'); await page.keyboard.up(code);
      const moved = await read(); assert.ok(moved.speed > 5); assert.ok((moved.x - origin.x) * sign > 2); results.push({ code, originX: origin.x, ...moved });
    }
    await page.keyboard.press('KeyR'); await page.waitForTimeout(700);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: '정차 후 바퀴 점검', exact: true }).click();
    const left = page.getByRole('button', { name: '왼쪽 조향', exact: true }); const rect = await left.boundingBox();
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down(); await page.waitForTimeout(600);
    assert.ok((await angles()).left > 30);
    await page.screenshot({ path: path.join(output, 'mobile.jpg'), type: 'jpeg', quality: 75 });
    await page.mouse.up(); await page.waitForTimeout(650); assert.ok(Math.abs((await angles()).left) < .1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole('button', { name: '점검 닫고 주행', exact: true }).click();
    await page.getByRole('button', { name: '차고로 돌아가기', exact: true }).click();
    await page.getByRole('heading', { name: '항구 정비소' }).waitFor(); assert.equal(await page.locator('canvas').count(), 1);
    assert.deepEqual(errors, []); assert.deepEqual(failures, []);
    const report = { checkedAt: new Date().toISOString(), results, errors, failures, checks: ['real keyboard left/right', 'inside tyre turns further', 'automatic rack centring', 'inspection prevents acceleration', 'normal driving resumes', 'mobile touch steering/release/layout', 'garage return'], note: 'Software GPU browser check, not a physical-device frame-rate claim.' };
    await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
