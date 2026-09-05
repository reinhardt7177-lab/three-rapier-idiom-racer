const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const output = path.resolve('artifacts/garage-evolution');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.GARAGE_BROWSER_PATH || undefined,
    args: ['--enable-unsafe-swiftshader'],
  });
  const errors = [], requests = [], failures = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => requests.push(request.url()));
    page.on('requestfailed', request => failures.push({ url: request.url(), failure: request.failure()?.errorText }));
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: '항구 정비소' }).waitFor();
    await page.waitForFunction(() => document.querySelector('footer')?.textContent.includes('FPS'));
    assert.equal(await page.locator('canvas').count(), 1);
    assert.equal(await page.locator('vite-error-overlay,[role=alert]').count(), 0);
    await page.screenshot({ path: path.join(output, 'garage-overview.png') });
    await page.screenshot({ path: path.join(output, 'garage-overview.jpg'), type: 'jpeg', quality: 40 });
    await page.getByRole('button', { name: '셔터 닫기', exact: true }).click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(output, 'shutter-closed.png') });
    await page.getByRole('button', { name: '셔터 열기', exact: true }).click();
    await page.getByRole('button', { name: '항구 풍경', exact: true }).click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(output, 'harbor-view.jpg'), type: 'jpeg', quality: 40 });
    await page.getByRole('button', { name: '차량 가까이', exact: true }).click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(output, 'car-closeup.png') });
    await page.screenshot({ path: path.join(output, 'car-closeup.jpg'), type: 'jpeg', quality: 40 });
    await page.getByRole('button', { name: '테라코타', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: '테라코타', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: '환경 설정', exact: true }).click();
    await page.getByRole('button', { name: '정비등 켜짐', exact: true }).click();
    await page.getByRole('button', { name: '바닥 반사 켜짐', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: '중립 조명', exact: true }).getAttribute('aria-pressed'), 'false');
    await page.getByRole('button', { name: '움직임 줄이기 꺼짐', exact: true }).click();
    await page.getByRole('button', { name: '환경 설정 닫기', exact: true }).click();
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(output, 'material-comparison.png') });
    await page.getByRole('button', { name: '포토 모드', exact: true }).click();
    assert.equal(await page.locator('.toolbar').isVisible(), false);
    assert.equal(await page.locator('.masthead').isVisible(), false);
    await page.screenshot({ path: path.join(output, 'photo-mode.png') });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.toolbar').isVisible(), true);
    await page.getByRole('button', { name: '포토 모드', exact: true }).click();
    await page.getByRole('button', { name: '차고로 돌아가기 · Esc', exact: true }).click();
    assert.equal(await page.locator('.toolbar').isVisible(), true);
    await page.getByRole('button', { name: '차고 전체', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(output, 'mobile-layout.png') });
    await page.screenshot({ path: path.join(output, 'mobile-layout.jpg'), type: 'jpeg', quality: 40 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    for (const label of ['차고 전체', '차량 가까이', '측면', '항구 풍경', '환경 설정']) {
      const bounds = await page.getByRole('button', { name: label, exact: true }).boundingBox();
      assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390 && bounds.y + bounds.height <= 844);
    }
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('footer')?.textContent.includes('FPS'));
    assert.equal(await page.locator('canvas').count(), 1);
    assert.equal(await page.getByRole('button', { name: '테라코타', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: '환경 설정', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: '중립 조명', exact: true }).getAttribute('aria-pressed'), 'false');
    assert.equal(await page.getByRole('button', { name: '움직임 줄이기 켜짐', exact: true }).getAttribute('aria-pressed'), 'true');
    const savedSettings = await page.evaluate(() => JSON.parse(localStorage.getItem('mumu.garage.preferences.v1')));
    assert.equal(savedSettings.wet, false); assert.equal(savedSettings.color, '#b34d31');
    await page.close();
    const blocked = await browser.newPage({ viewport: { width: 1000, height: 760 } });
    blocked.on('pageerror', error => errors.push(error.message));
    await blocked.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage denied by test'); } }); });
    await blocked.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
    await blocked.waitForFunction(() => document.querySelector('footer')?.textContent.includes('FPS'));
    assert.equal(await blocked.locator('canvas').count(), 1);
    assert.match(await blocked.locator('footer').textContent(), /설정 저장 불가/);
    await blocked.close();
    const externalRequests = requests.filter(url => !url.startsWith('http://127.0.0.1:5173') && !url.startsWith('data:'));
    const importedAssets = requests.filter(url => /\.(glb|gltf|fbx|png|jpg|hdr|exr)(\?|$)/i.test(url));
    const report = { checkedAt: new Date().toISOString(), errors, failures, externalRequests, importedAssets, canvasCount: 1, savedSettings, uiChecks: 'color, 4 cameras, shutter, light, reflection, reduced motion, photo mode + Escape/button exit, mobile layout, saved reload, denied storage startup', rendererNote: 'Headless browser; not a user-device 60 FPS benchmark.' };
    await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2));
    assert.deepEqual(errors, []); assert.deepEqual(failures, []);
    assert.deepEqual(externalRequests, []); assert.deepEqual(importedAssets, []);
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
