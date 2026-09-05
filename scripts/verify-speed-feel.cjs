const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
  const output = path.resolve('artifacts/speed-feel'); await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.GARAGE_BROWSER_PATH, args: ['--enable-unsafe-swiftshader'] });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    // Observe actual Web Audio output without replacing the sound implementation.
    await page.addInitScript(() => {
      const Native = window.AudioContext; window.__audioProbes = [];
      window.AudioContext = class extends Native {
        constructor(...args) { super(...args); window.__audioProbes.push({ context: this }); }
        createGain() { const gain = super.createGain(), probe = window.__audioProbes.find(p => p.context === this); if (probe && !probe.master) { probe.master = gain; probe.analyser = this.createAnalyser(); gain.connect(probe.analyser); } return gain; }
      };
    });
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'GT 테스트 주행 →' }).click();
    await page.waitForFunction(() => +document.querySelector('[data-time]')?.dataset.time > .5);
    assert.equal(await page.evaluate(() => window.__audioProbes.length), 0, 'silent until gesture');
    const rms = () => page.evaluate(() => { const p = window.__audioProbes[0], data = new Float32Array(p.analyser.fftSize); p.analyser.getFloatTimeDomainData(data); return Math.sqrt(data.reduce((sum, x) => sum + x * x, 0) / data.length); });
    await page.getByRole('button', { name: '소리 켜기', exact: true }).click();
    await page.getByRole('button', { name: '소리 끄기', exact: true }).waitFor(); await page.waitForTimeout(500);
    const idleRms = await rms(); assert.ok(idleRms > .00001);
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => +document.querySelector('[data-speed]')?.dataset.speed > 225, null, { timeout: 60000 });
    const highSpeed = await page.locator('[data-testid=telemetry]').evaluate(e => ({ speed: +e.dataset.speed, distance: +e.dataset.cameraDistance, fov: +e.dataset.cameraFov }));
    assert.ok(highSpeed.distance < 10.5 && highSpeed.distance > 9);
    const fastRms = await rms(); assert.ok(fastRms > idleRms);
    await page.screenshot({ path: path.join(output, 'high-speed.jpg'), type: 'jpeg', quality: 65 });
    await page.screenshot({ path: path.join(output, 'high-speed.png') });
    await page.keyboard.up('KeyW'); await page.getByRole('button', { name: '일시정지', exact: true }).click(); await page.waitForTimeout(500);
    const pausedRms = await rms(); assert.ok(pausedRms < .000001);
    await page.getByRole('button', { name: '주행 재개', exact: true }).click();
    await page.keyboard.press('KeyR'); await page.waitForTimeout(300);
    await page.getByRole('slider', { name: '주행 소리 볼륨' }).fill('0'); await page.waitForTimeout(500);
    const zeroRms = await rms(); assert.ok(zeroRms < .000001);
    await page.getByRole('slider', { name: '주행 소리 볼륨' }).fill('60'); await page.waitForTimeout(500); assert.ok(await rms() > .00001);
    await page.getByRole('button', { name: '소리 끄기', exact: true }).click(); await page.waitForTimeout(500);
    const mutedRms = await rms(); assert.ok(mutedRms < .000001);
    await page.getByRole('button', { name: '소리 켜기', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__audioProbes.length), 1, 'toggle reuses the audio graph');
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(output, 'mobile.jpg'), type: 'jpeg', quality: 65 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole('button', { name: '차고로 돌아가기', exact: true }).click();
    await page.getByRole('heading', { name: '항구 정비소' }).waitFor();
    await page.waitForFunction(() => window.__audioProbes.every(p => p.context.state === 'closed'));
    await page.getByRole('button', { name: 'GT 테스트 주행 →' }).click(); await page.waitForFunction(() => +document.querySelector('[data-time]')?.dataset.time > .5);
    assert.equal(await page.getByRole('button', { name: '소리 켜기', exact: true }).getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('canvas').count(), 1);
    assert.deepEqual(errors, []);
    const report = { checkedAt: new Date().toISOString(), highSpeed, idleRms, fastRms, pausedRms, zeroRms, mutedRms, errors, checks: ['no audio before gesture', 'real audio signal grows with speed', 'pause/zero volume/mute silence', 'sound toggle reuses graph', 'garage exit closes audio', 'reentry silent', 'desktop/mobile screenshots', 'high speed camera distance bounded'], note: 'Audio waveform validated, not subjective listening or real-device loudness/FPS certification.' };
    await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
