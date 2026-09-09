const { chromium } = require('playwright');
const fs = require('node:fs/promises');
(async () => {
  const output = `artifacts/gt-audit/${process.env.AUDIT_STAGE || 'before'}`;
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.GARAGE_BROWSER_PATH, args: ['--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.env.GARAGE_BASE_URL || 'http://127.0.0.1:5175/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '차량 가까이', exact: true }).click();
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: '포토 모드', exact: true }).click();
    await page.screenshot({ path: `${output}/front.jpg`, type: 'jpeg', quality: 80 });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '측면', exact: true }).click(); await page.waitForTimeout(1800);
    await page.getByRole('button', { name: '포토 모드', exact: true }).click();
    await page.screenshot({ path: `${output}/side.jpg`, type: 'jpeg', quality: 80 });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '해안도로 드라이브 →' }).click();
    await page.waitForFunction(() => +document.querySelector('[data-time]')?.dataset.time > 1, null, { timeout: 60000 });
    await page.screenshot({ path: `${output}/rear.jpg`, type: 'jpeg', quality: 80 });
    console.log(JSON.stringify({ output, errors, calls: await page.locator('[data-time]').getAttribute('data-draw-calls') }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
