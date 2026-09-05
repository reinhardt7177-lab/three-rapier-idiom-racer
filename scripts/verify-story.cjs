const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
  const output = path.resolve('artifacts/story-road'); await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.GARAGE_BROWSER_PATH, args: ['--enable-unsafe-swiftshader'] });
  const errors = [], failures = [], external = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('requestfailed', r => failures.push(r.url()));
    page.on('request', r => { if (/^https?:/.test(r.url()) && !r.url().startsWith('http://127.0.0.1:5173')) external.push(r.url()); });
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '아이보리', exact: true }).click();
    await page.screenshot({ path: path.join(output, 'garage-story.jpg'), type: 'jpeg', quality: 70 });
    await page.getByRole('button', { name: '첫 번째 호출 시작 →' }).click();
    await page.locator('[data-story-phase=intro]').waitFor({ timeout: 60000 });
    await page.screenshot({ path: path.join(output, 'intro.jpg'), type: 'jpeg', quality: 70 });
    await page.locator('canvas').focus(); await page.keyboard.down('KeyW'); await page.waitForTimeout(500); await page.keyboard.up('KeyW');
    assert.equal(await page.locator('[data-time]').getAttribute('data-time'), '0');
    await page.getByRole('button', { name: '일시정지', exact: true }).click();
    await page.waitForTimeout(300); assert.equal(await page.locator('[data-time]').getAttribute('data-time'), '0');
    await page.getByRole('button', { name: '주행 재개', exact: true }).click();
    await page.getByRole('button', { name: '컷신 건너뛰고 주행 →' }).click();
    await page.locator('[data-story-phase=drive]').waitFor();
    await page.screenshot({ path: path.join(output, 'public-road.jpg'), type: 'jpeg', quality: 70 });
    // Real keyboard inputs only. No writes to body transforms, game state or save data.
    const held = new Set(); let arrived = false;
    for (let i = 0; i < 700; i++) {
      const state = await page.locator('[data-time]').evaluate(e => ({ z: +e.dataset.z, speed: +e.dataset.speed, phase: document.querySelector('[data-story-phase]').dataset.storyPhase }));
      if (state.phase === 'complete') { arrived = true; break; }
      const distance = -470 - state.z;
      const target = Math.min(52, Math.sqrt(Math.max(0, Math.abs(distance) - 1) * 2 * 2.2) * 3.6);
      const desired = distance < -2 ? 'KeyS' : state.speed > target + 1 || Math.abs(distance) < 2 ? 'KeyB' : 'KeyW';
      for (const code of held) if (code !== desired) { await page.keyboard.up(code); held.delete(code); }
      if (!held.has(desired)) { await page.keyboard.down(desired); held.add(desired); }
      await page.waitForTimeout(100);
    }
    for (const code of held) await page.keyboard.up(code);
    assert.equal(arrived, true, 'arrived through actual physics / road checkpoints');
    await page.screenshot({ path: path.join(output, 'complete.jpg'), type: 'jpeg', quality: 70 });
    assert.equal(await page.locator('canvas').count(), 1);
    await page.getByRole('button', { name: '차고로 돌아가 초대 확인' }).click();
    await page.getByRole('heading', { name: '해안 주행 클럽의 초대' }).waitFor();
    assert.equal(await page.getByRole('button', { name: '아이보리', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '프롤로그 다시 보기 →' }).click();
    await page.locator('[data-story-phase=intro]').waitFor({ timeout: 60000 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, 'mobile-intro.jpg'), type: 'jpeg', quality: 70 });
    await page.getByRole('button', { name: '컷신 건너뛰고 주행 →' }).click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(output, 'mobile-road.jpg'), type: 'jpeg', quality: 70 });
    assert.equal(await page.locator('[data-checkpoint]').getAttribute('data-checkpoint'), '0');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole('button', { name: '시작점 복귀 · R' }).click();
    await page.locator('[data-story-phase=intro]').waitFor();
    // Natural playback, without skip, also gives control back.
    await page.locator('[data-story-phase=drive]').waitFor({ timeout: 25000 });
    assert.equal(await page.locator('canvas').count(), 1);
    await page.getByRole('button', { name: '차고로 돌아가기', exact: true }).click();
    await page.getByRole('button', { name: 'GT 테스트 주행 →' }).click();
    await page.waitForFunction(() => +document.querySelector('[data-time]')?.dataset.time > .3);
    assert.equal(await page.locator('[data-story-phase]').count(), 0);
    assert.deepEqual(errors, []); assert.deepEqual(failures, []); assert.deepEqual(external, []);
    const report = { checkedAt: new Date().toISOString(), errors, failures, external, checks: ['3D intro blocks driving, supports pause/skip and natural end', 'real-input mission complete via ordered gates and 2s stop', 'garage paint preserved', 'completion survives reload', 'replay/reset clear mission progress', 'mobile layout', 'test driving preserved'], note: 'Headless Chrome; no production deployment and no traffic AI.' };
    await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
