const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
  const { tourWaypoints, COAST_PADS } = await import('../src/driving/coastRoute.js');
  const { steeringLimit } = await import('../src/driving/steering.js');
  const output = path.resolve('artifacts/coastal-road'); await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.GARAGE_BROWSER_PATH, args: ['--enable-unsafe-swiftshader'] });
  const errors = [], failures = [], external = [], shots = new Set();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('requestfailed', r => failures.push(r.url()));
    page.on('request', r => { if (/^https?:/.test(r.url()) && !r.url().startsWith('http://127.0.0.1:5173')) external.push(r.url()); });
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '해안도로 드라이브 →' }).click();
    await page.waitForFunction(() => +document.querySelector('[data-time]')?.dataset.time > 1, null, { timeout: 60000 });
    async function shot(name) { if (shots.has(name)) return; await page.screenshot({ path: path.join(output, name + '.jpg'), type: 'jpeg', quality: 70 }); shots.add(name); }
    await shot('harbor');
    const held = new Set(), waypoints = tourWaypoints('lookout'); let index = 0, sigma = 0, stoppedAtLookout = false, returned = false;
    const began = Date.now(); let maxCalls = 0;
    const read = () => page.locator('[data-time]').evaluate(e => ({ x: +e.dataset.x, z: +e.dataset.z, speed: +e.dataset.speed, yaw: +e.dataset.heading, contacts: +e.dataset.contacts, time: +e.dataset.time, calls: +e.dataset.drawCalls, lookout: document.querySelector('[data-coast-lookout]')?.dataset.coastLookout === 'true', returned: document.querySelector('[data-coast-returned]')?.dataset.coastReturned === 'true' }));
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
        if (s.lookout) { stoppedAtLookout = true; await shot('lookout'); }
        await page.waitForTimeout(100); continue;
      }
      if (stoppedAtLookout && Math.hypot(s.x + 3.5, s.z + 720) < 22) { await input(['KeyB']); await page.waitForTimeout(100); continue; }
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
    await page.getByRole('button', { name: '도로 복귀 · C' }).click(); await page.waitForTimeout(1200); assert.equal((await read()).contacts, 4);
    await page.getByRole('button', { name: '시작점 복귀 · R' }).click(); await page.waitForTimeout(600); assert.equal((await read()).lookout, false);
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(500); await shot('mobile');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); assert.equal(await page.locator('canvas').count(), 1);
    await page.getByRole('button', { name: '차고로 돌아가기', exact: true }).click(); await page.getByRole('heading', { name: '항구 정비소' }).waitFor();
    assert.deepEqual(errors, []); assert.deepEqual(failures, []); assert.deepEqual(external, []);
    const report = { checkedAt: new Date().toISOString(), wallSeconds: (Date.now() - began) / 1000, errors, failures, external, maxDrawCalls: maxCalls, shots: [...shots], checks: ['actual keyboard harbor-corners-fork-lookout-turnaround-return', 'stopped visit and return recognition', 'road recovery contacts', 'reset clears trip', 'mobile controls/layout', 'one canvas and garage return'], note: 'Headless Chrome software GPU; no player autopilot, no traffic AI, no performance guarantee for other devices.' };
    await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
