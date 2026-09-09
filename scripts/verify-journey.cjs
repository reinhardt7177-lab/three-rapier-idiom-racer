const BASE_URL = (process.env.GARAGE_BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { recoverDrive, resetDrive, exitDrive, touchOn, openMenu, resume } = require('./drive-ui.cjs');
(async () => {
  const { tourWaypoints, COAST_PADS } = await import('../src/driving/coastRoute.js');
  const { JOURNEY_HOME } = await import('../src/driving/journey.js');
  const { steeringLimit } = await import('../src/driving/steering.js');
  const blockedStorage = process.env.JOURNEY_BLOCK_STORAGE === '1';
  const output = path.resolve(process.env.GARAGE_ARTIFACT_ROOT || 'artifacts',blockedStorage ? 'signal-journey-storage-blocked' : 'signal-journey'); await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.GARAGE_BROWSER_PATH, args: ['--enable-unsafe-swiftshader'] });
  const errors = [], failures = [], external = [], shots = new Set();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    if (blockedStorage) await page.addInitScript(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) { if (key === 'mumu.coast.journey.v1') throw new DOMException('Test: storage denied', 'SecurityError'); return original.call(this, key, value); };
    });
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('requestfailed', r => failures.push(r.url()));
    page.on('request', r => { if (/^https?:/.test(r.url()) && !r.url().startsWith(BASE_URL)) external.push(r.url()); });
    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '돌아오는 불빛 시작 →' }).click();
    await page.locator('[data-journey-phase="briefing"]').waitFor({ timeout: 60000 });
    await page.screenshot({ path: path.join(output, 'briefing.jpg') });
    await page.keyboard.down('KeyW'); await page.waitForTimeout(400); await page.keyboard.up('KeyW');
    assert.equal(+await page.locator('[data-time]').getAttribute('data-time'), 0);
    await page.getByRole('button', { name: '신호소로 출발 →' }).click();
    await page.waitForFunction(() => +document.querySelector('[data-time]')?.dataset.time > 1, null, { timeout: 60000 });
    async function shot(name) { if (shots.has(name)) return; await page.screenshot({ path: path.join(output, name + '.jpg'), type: 'jpeg', quality: 70 }); shots.add(name); }
    await shot('harbor');
    const held = new Set(), waypoints = tourWaypoints('lookout'); let index = 0, sigma = 0, stoppedAtLookout = false, returned = false;
    const began = Date.now(); let maxCalls = 0;
    const read = () => page.locator('[data-time]').evaluate(e => ({ x: +e.dataset.x, z: +e.dataset.z, speed: +e.dataset.speed, yaw: +e.dataset.heading, contacts: +e.dataset.contacts, time: +e.dataset.time, calls: +e.dataset.drawCalls, lookout: document.querySelector('[data-coast-lookout]')?.dataset.coastLookout === 'true', phase: document.querySelector('[data-journey-phase]')?.dataset.journeyPhase, gate: +document.querySelector('[data-journey-gate]')?.dataset.journeyGate, journeyTime: +document.querySelector('[data-journey-time]')?.dataset.journeyTime, returned: document.querySelector('[data-journey-phase]')?.dataset.journeyPhase === 'complete' }));
    async function input(codes) { for (const c of held) if (!codes.includes(c)) { await page.keyboard.up(c); held.delete(c); } for (const c of codes) if (!held.has(c)) { await page.keyboard.down(c); held.add(c); } }
    // Normal keyboard inputs, no runtime API, no transform or save-state writes.
    for (let step = 0; step < 4200; step++) {
      const s = await read(); maxCalls = Math.max(maxCalls, s.calls);
      if (s.returned) { returned = true; break; }
      // A browser/IPC stall can skip a 4 m proximity window. Follow the nearest
      // point in a bounded forward window, not a stale point behind the car.
      let nearestIndex = index, nearestDistance = Infinity;
      for (let j = index; j <= Math.min(index + 40, waypoints.length - 1); j++) {
        const distance = Math.hypot(waypoints[j].x - s.x, waypoints[j].z - s.z);
        if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = j; }
      }
      assert.ok(nearestDistance < 20, `test driver lost path: ${index}, ${nearestDistance.toFixed(1)} m`);
      index = nearestIndex;
      while (index < waypoints.length - 1 && Math.hypot(waypoints[index].x - s.x, waypoints[index].z - s.z) < 4) index++;
      if (s.z > -260 && s.z < -140 && s.x < -20) await shot('first-corner');
      if (s.z > 65 && s.z < 125) await shot('fork-approach');
      const padDistance = Math.hypot(COAST_PADS[0].x - s.x, COAST_PADS[0].z - s.z);
      if (!stoppedAtLookout && padDistance < 18) {
        await input(['KeyB']);
        if (s.phase === 'signal') {
          await input([]); await shot('signal');
          const time = s.journeyTime;
          await openMenu(page); await page.waitForTimeout(350); assert.equal((await read()).journeyTime, time); await resume(page);
          await page.setViewportSize({ width: 800, height: 1280 }); await page.waitForTimeout(450); await resume(page); await shot('signal-portrait');
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(450); await resume(page);
          await page.getByRole('button', { name: '신호를 기록하고 항구로 →' }).click();
          stoppedAtLookout = true;
        }
        await page.waitForTimeout(100); continue;
      }
      if (stoppedAtLookout && Math.hypot(s.x - JOURNEY_HOME.x, s.z - JOURNEY_HOME.z) < 15) { await input(['KeyB']); await page.waitForTimeout(100); continue; }
      let targetIndex = index, travel = 0;
      while (targetIndex < waypoints.length - 1 && travel < 6 + s.speed / 3.6 * .3) { travel += Math.hypot(waypoints[targetIndex + 1].x - waypoints[targetIndex].x, waypoints[targetIndex + 1].z - waypoints[targetIndex].z); targetIndex++; }
      const t = waypoints[targetIndex], heading = Math.atan2(t.x - s.x, t.z - s.z), error = Math.atan2(Math.sin(heading - s.yaw), Math.cos(heading - s.yaw));
      const limit = steeringLimit(s.speed / 3.6);
      const desired = Math.max(-1, Math.min(1, -Math.atan(2 * 2.84 * Math.sin(error) / Math.max(3, Math.hypot(t.x - s.x, t.z - s.z))) / limit));
      sigma = Math.max(-1.5, Math.min(1.5, sigma + desired));
      const steer = sigma > .5 ? 'KeyD' : sigma < -.5 ? 'KeyA' : null;
      if (steer) sigma -= steer === 'KeyD' ? 1 : -1;
      const targetSpeed = Math.min(waypoints[index].speed, t.speed, stoppedAtLookout ? 48 : 55);
      const power = s.speed < targetSpeed - 1 ? 'KeyW' : s.speed > targetSpeed + 2 ? 'KeyB' : null;
      await input([steer, power].filter(Boolean));
      if (step % 300 === 0) console.log(JSON.stringify({ step, index, x: s.x, z: s.z, speed: s.speed, contacts: s.contacts }));
      assert.ok(s.time > .5, 'no fall/reset while driving');
      await page.waitForTimeout(65);
    }
    await input([]); assert.equal(stoppedAtLookout, true); assert.equal(returned, true, 'actual browser round trip');
    await shot('returned');
    const final = await read(); assert.equal(final.gate, 3); assert.ok(final.journeyTime > 150 && final.journeyTime < 320);
    assert.match(await page.locator('.journey-scene').innerText(), blockedStorage ? /저장이 차단/ : /저장했습니다/);
    if (blockedStorage) await exitDrive(page);
    else await page.getByRole('button', { name: '차고로 돌아가 운행 기록 보기' }).click();
    await page.getByRole('heading', { name: '첫 해안 운행을 마쳤습니다' }).waitFor(); await shot('garage-record');
    await page.reload({ waitUntil: 'networkidle' });
    if (blockedStorage) assert.equal(await page.getByRole('heading', { name: '첫 해안 운행을 마쳤습니다' }).count(), 0);
    else await page.getByRole('heading', { name: '첫 해안 운행을 마쳤습니다' }).waitFor();
    await page.getByRole('button', { name: blockedStorage ? '돌아오는 불빛 시작 →' : '해안 운행 다시 시작 →' }).click();
    await page.getByRole('button', { name: '신호소로 출발 →' }).click();
    await page.waitForTimeout(600); assert.equal((await read()).gate, 0); assert.equal((await read()).phase, 'outbound');
    await recoverDrive(page); await page.waitForTimeout(600); assert.equal((await read()).gate, 0); assert.equal((await read()).contacts, 4);
    await resetDrive(page); assert.equal((await read()).phase, 'briefing');
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(500); await touchOn(page); await shot('mobile-briefing');
    await page.getByRole('button', { name: '신호소로 출발 →' }).click(); await page.waitForTimeout(600); await shot('mobile-drive');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); assert.equal(await page.locator('canvas').count(), 1);
    await exitDrive(page); await page.getByRole('heading', { name: '항구 정비소' }).waitFor();
    assert.deepEqual(errors, []); assert.deepEqual(failures, []); assert.deepEqual(external, []);
    const report = { checkedAt: new Date().toISOString(), blockedStorage, wallSeconds: (Date.now() - began) / 1000, journeySeconds: final.journeyTime, errors, failures, external, maxDrawCalls: maxCalls, shots: [...shots], checks: ['briefing locks input', 'real keyboard outbound gates and 2-second stop', 'signal scene pause and portrait', 'return gates and grounded stop', blockedStorage ? 'denied storage: completion remains in current visit, reload does not falsely restore' : 'completion saves, garage record and reload', 'replay/reset/recovery do not grant progress', 'mobile briefing and drive layout', 'one canvas and garage return'], note: 'Headless Chrome software GPU; no player autopilot, no traffic AI, no performance guarantee for other devices.' };
    await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
