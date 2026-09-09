const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { openMenu, resume, exitDrive, recoverDrive } = require('./drive-ui.cjs');

const BASE = (process.env.GARAGE_BASE_URL || 'http://127.0.0.1:5175').replace(/\/$/, '');
const KEY = 'mumu.coast.campaign.v1';
const BLOCKED = process.argv.includes('--blocked-storage');
const CAPTURE = !process.argv.includes('--no-screenshots');
const SIZES = [[1280, 800], [800, 1280], [1024, 600], [600, 960], [390, 844], [640, 400]];

(async () => {
  const { COAST_ROADS, offsetPoint } = await import('../src/driving/coastRoute.js');
  const { steeringLimit } = await import('../src/driving/steering.js');
  const output = path.resolve(process.env.GARAGE_ARTIFACT_ROOT || 'artifacts', (BLOCKED ? 'campaign-blocked-storage' : 'campaign') + (CAPTURE ? '' : '-no-capture'));
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.GARAGE_BROWSER_PATH, args: ['--enable-unsafe-swiftshader'] });
  const errors = [], failures = [], checks = [], modalLayouts = [], roadLayouts = [];
  let page, stage = 'initialization';
  const shot = name => CAPTURE ? page.screenshot({ path: path.join(output, `${name}.jpg`), type: 'jpeg', quality: 72, scale: 'css' }) : Promise.resolve();
  const entry = () => page.getByRole('button', { name: '챕터 선택 →', exact: true });
  const dialog = () => page.getByRole('dialog', { name: '해안 클럽 챕터', exact: true });
  const phase = value => page.locator(`[data-chapter-id="first-light"][data-sprint-phase="${value}"]`);
  const profile = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  const read = () => page.locator('[data-time]').evaluate(e => {
    const chapter = document.querySelector('[data-chapter-id="first-light"]');
    return {
      x: +e.dataset.x, z: +e.dataset.z, speed: +e.dataset.speed, yaw: +e.dataset.heading,
      contacts: +e.dataset.contacts, calls: +e.dataset.drawCalls,
      phase: chapter.dataset.sprintPhase, valid: chapter.dataset.sprintValid,
      gate: +chapter.dataset.sprintGate, time: +chapter.dataset.sprintTime,
    };
  });
  async function openChapters() {
    await entry().waitFor({ timeout: 60000 });
    await entry().click();
    await dialog().waitFor();
  }
  async function enterChapter(difficulty = 'standard') {
    await openChapters();
    await page.getByLabel('챕터 난이도', { exact: true }).selectOption(difficulty);
    await dialog().getByRole('button', { name: '1장 시작 →', exact: true }).click();
    await phase('briefing').waitFor({ timeout: 60000 });
    const briefing = await page.locator('.sprint-result').innerText();
    assert.match(briefing, difficulty === 'standard' ? /45\s*초/ : /60\s*초/, 'selected difficulty is explained before driving');
  }
  async function beginChapter(checkCountdown = false) {
    await page.getByRole('button', { name: '클럽 테스트 출발 →', exact: true }).click();
    if (checkCountdown) {
      const before = await read();
      await page.keyboard.down('KeyW'); await page.waitForTimeout(300); await page.keyboard.up('KeyW');
      const after = await read();
      assert.equal(after.speed, before.speed, 'throttle is locked before the start');
      assert.equal(after.z, before.z, 'countdown does not move the car');
      assert.equal(after.time, 0);
      await openMenu(page); const frozen = await read(); await page.waitForTimeout(350);
      assert.equal((await read()).time, frozen.time, 'pause does not spend chapter time');
      await resume(page);
    }
    await phase('running').waitFor({ timeout: 15000 });
    await page.locator('canvas').focus();
  }
  async function driveThreeGates() {
    // Same lane-following keyboard driver as verify-sprint.cjs. No transform,
    // elapsed-time, checkpoint, saved-profile or physics-runtime writes.
    const points = COAST_ROADS.harbor.filter(p => p.z >= -725).map(p => ({ ...p, ...offsetPoint(p, 3.5) }));
    const held = new Set();
    let index = 0, sigma = 0, peakKmh = 0, maxDrawCalls = 0, lastGate = 0, final;
    const input = async codes => {
      for (const code of held) if (!codes.includes(code)) { await page.keyboard.up(code); held.delete(code); }
      for (const code of codes) if (!held.has(code)) { await page.keyboard.down(code); held.add(code); }
    };
    try {
      for (let k = 0; k < 2500; k++) {
        const s = await read(); peakKmh = Math.max(peakKmh, s.speed); maxDrawCalls = Math.max(maxDrawCalls, s.calls);
        if (k % 200 === 0) console.log(JSON.stringify({ stage: 'keyboard-drive', ...s }));
        if (s.gate !== lastGate) { lastGate = s.gate; await shot(`gate-${lastGate}`); }
        if (s.phase === 'complete') { final = s; break; }
        if (s.phase === 'cooldown') { await input([]); await page.waitForTimeout(80); continue; }
        assert.equal(s.valid, 'true', `chapter run became invalid: ${JSON.stringify(s)}`);
        let nearest = index, distance = Infinity;
        for (let j = index; j <= Math.min(index + 45, points.length - 1); j++) {
          const d = Math.hypot(points[j].x - s.x, points[j].z - s.z);
          if (d < distance) { distance = d; nearest = j; }
        }
        assert.ok(distance < 9, `keyboard driver left the lane: ${distance}`); index = nearest;
        let target = index, travel = 0;
        while (target < points.length - 1 && travel < 7 + s.speed / 3.6 * .35) {
          travel += Math.hypot(points[target + 1].x - points[target].x, points[target + 1].z - points[target].z); target++;
        }
        const t = points[target], angle = Math.atan2(t.x - s.x, t.z - s.z);
        const err = Math.atan2(Math.sin(angle - s.yaw), Math.cos(angle - s.yaw));
        const desire = Math.max(-1, Math.min(1, -Math.atan(2 * 2.84 * Math.sin(err) / Math.max(3, Math.hypot(t.x - s.x, t.z - s.z))) / steeringLimit(s.speed / 3.6)));
        sigma = Math.max(-1.5, Math.min(1.5, sigma + desire));
        const steer = sigma > .5 ? 'KeyD' : sigma < -.5 ? 'KeyA' : null;
        if (steer) sigma -= steer === 'KeyD' ? 1 : -1;
        const targetSpeed = points[index].s < 345 ? 145 : points[index].s < 405 ? 85 : points[index].s < 690 ? 63 : 105;
        const power = s.speed < targetSpeed - 1 ? 'KeyW' : s.speed > targetSpeed + 2 ? 'KeyB' : null;
        await input([steer, power].filter(Boolean)); await page.waitForTimeout(55);
      }
    } finally { await input([]); }
    assert.ok(final, 'chapter must finish through keyboard input');
    assert.equal(final.gate, 3); assert.equal(final.valid, 'true');
    assert.ok(final.time > 5 && final.time <= 45, 'standard license is genuinely earned within 45 seconds');
    return { final, peakKmh, maxDrawCalls };
  }

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
    if (BLOCKED) await context.addInitScript(() => {
      // Fault injection only: private-session/quota-like failure. Reading stays
      // available so the test can prove no persistent award was fabricated.
      Storage.prototype.setItem = function () { throw new DOMException('Campaign test blocks persistence', 'QuotaExceededError'); };
    });
    page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('requestfailed', r => failures.push(r.url()));
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('footer')?.textContent.includes('FPS'), null, { timeout: 60000 });

    if (!BLOCKED) {
      stage = 'chapter selection layouts';
      for (const [width, height] of SIZES) {
        await page.setViewportSize({ width, height }); await openChapters();
        assert.equal(await dialog().evaluate(el => el.scrollTop), 0, 'opening chapter board begins at its title, not scrolled to the launch button');
        const layout = await dialog().evaluate(el => {
          const b = el.getBoundingClientRect();
          const targets = [...el.querySelectorAll('button,select')].map(e => {
            const r = e.getBoundingClientRect();
            return { text: e.getAttribute('aria-label') || e.textContent.trim(), width: r.width, height: r.height, left: r.left, right: r.right, disabled: !!e.disabled };
          });
          return { width: innerWidth, height: innerHeight, left: b.left, right: b.right, top: b.top, bottom: b.bottom, overflow: document.documentElement.scrollWidth > innerWidth || el.scrollWidth > el.clientWidth + 1, targets };
        });
        assert.ok(layout.left >= 0 && layout.right <= width && layout.top >= 0 && layout.bottom <= height, 'chapter dialog contained in viewport');
        assert.equal(layout.overflow, false, 'chapter dialog has no horizontal overflow');
        assert.ok(layout.targets.every(t => t.width >= 48 && t.height >= 48), 'chapter controls have at least 48px touch targets');
        assert.ok(layout.targets.every(t => t.left >= layout.left && t.right <= layout.right), 'chapter controls do not escape modal horizontally');
        const cards = dialog().locator('[data-chapter-card]');
        assert.equal(await cards.count(), 6, 'six chapter cards, not six implemented modes');
        assert.equal(await dialog().locator('[data-chapter-card][data-playable="false"]').count(), 5);
        for (let number = 2; number <= 6; number++) {
          const card = dialog().locator(`[data-chapter-card][data-chapter-number="${number}"]`);
          assert.equal(await card.getAttribute('data-playable'), 'false');
          assert.match(await card.innerText(), /제작\s*예정/);
          assert.equal(await card.locator('button:not(:disabled),a[href],[role="button"]').count(), 0);
        }
        assert.equal(await dialog().locator('[data-chapter-card][data-chapter-number="1"]').getAttribute('data-playable'), 'true');
        await shot(`chapters-${width}x${height}`);
        for (let i = 0; i < 12; i++) {
          await page.keyboard.press('Tab');
          assert.ok(await dialog().evaluate(el => el.contains(document.activeElement)), 'keyboard focus is trapped inside chapter dialog');
        }
        await page.keyboard.press('Escape'); await dialog().waitFor({ state: 'hidden' });
        assert.ok(await entry().evaluate(el => document.activeElement === el), 'Escape returns keyboard focus to the opener');
        modalLayouts.push(layout);
      }
      checks.push('six chapter-dialog viewports, 48px controls, five non-playable future chapter cards, focus trap/Escape return');

      // Keep layout sampling out of the timed winning run. Abandon this trial
      // after a genuine recovery so no unfinished/invalid run earns a license.
      await page.setViewportSize({ width: 1280, height: 800 });
      await enterChapter(); await beginChapter();
      stage = 'chapter driving HUD layouts';
      for (const [width, height] of SIZES) {
        await page.setViewportSize({ width, height }); await page.waitForTimeout(350); await resume(page); await page.waitForTimeout(150);
        const layout = await page.evaluate(() => {
          const zone = { left: innerWidth * .25, right: innerWidth * .75, top: innerHeight * .24, bottom: innerHeight * .8 };
          const overlaps = [...document.querySelectorAll('[data-driving-overlay]')].filter(e => {
            const b = e.getBoundingClientRect();
            return b.width && b.height && getComputedStyle(e).display !== 'none' && b.left < zone.right && b.right > zone.left && b.top < zone.bottom && b.bottom > zone.top;
          }).map(e => e.className);
          const buttons = [...document.querySelectorAll('.driving-controls button,.pause-trigger,.sound-trigger')].map(e => {
            const b = e.getBoundingClientRect();
            return { label: e.getAttribute('aria-label') || e.textContent, w: b.width, h: b.height, left: b.left, right: b.right, top: b.top, bottom: b.bottom };
          }).filter(b => b.w > 0);
          return { width: innerWidth, height: innerHeight, overlaps, buttons, overflow: document.documentElement.scrollWidth > innerWidth };
        });
        assert.deepEqual(layout.overlaps, [], 'chapter HUD must leave the central road corridor unobstructed');
        assert.equal(layout.overflow, false);
        assert.ok(layout.buttons.every(b => b.w >= 48 && b.h >= 48 && b.left >= 0 && b.right <= width && b.top >= 0 && b.bottom <= height), 'chapter touch controls fit the screen');
        for (const name of ['왼쪽 조향', '오른쪽 조향', '가속']) assert.ok(layout.buttons.some(b => b.label === name), `${name} remains available`);
        for (let i = 0; i < layout.buttons.length; i++) for (let j = i + 1; j < layout.buttons.length; j++) {
          const a = layout.buttons[i], b = layout.buttons[j];
          assert.ok(!(a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top), `chapter controls overlap: ${a.label} / ${b.label}`);
        }
        roadLayouts.push(layout); await shot(`road-${width}x${height}`);
      }
      await recoverDrive(page); assert.equal((await read()).valid, 'false');
      await exitDrive(page); await entry().waitFor({ timeout: 60000 });
      assert.notEqual((await profile())?.license, true, 'abandoned and recovered run does not grant a license');
      checks.push('six chapter-road HUD viewports; recovery invalidates chapter; abandonment does not award');

      stage = 'relaxed briefing';
      await page.setViewportSize({ width: 1280, height: 800 });
      await enterChapter('relaxed'); await shot('relaxed-briefing'); await exitDrive(page);
      checks.push('relaxed difficulty explicitly presents 60 seconds before launch');
    }

    stage = 'standard chapter winning run';
    await enterChapter('standard'); await shot('standard-briefing'); await beginChapter(true);
    const result = await driveThreeGates();
    await page.locator('.sprint-result').getByRole('heading', { name: /클럽 라이선스 획득|챕터 클리어/ }).waitFor();
    await page.locator('[data-chapter-passed="true"]').waitFor();
    await shot('license-result');
    let saved = await profile();
    if (BLOCKED) assert.equal(saved, null, 'blocked storage contains no persisted award');
    else {
      assert.equal(saved.license, true, 'winning run grants the club license');
      assert.ok(saved.chapterOne.time > 5 && saved.chapterOne.time <= 45);
      assert.ok(Math.abs(saved.chapterOne.time - result.final.time) < .01, 'saved chapter record equals measured driving time');
    }
    await page.locator('.sprint-result').getByRole('button', { name: '차고로 돌아가기', exact: true }).click();
    await page.getByRole('heading', { name: '항구 정비소', exact: true }).waitFor();
    const legacy = page.getByRole('button', { name: 'GT 테스트 주행 →', exact: true });
    await legacy.scrollIntoViewIfNeeded();
    assert.ok(await legacy.evaluate(el => { const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return hit === el || el.contains(hit); }), 'license must not bury previous drive entry beneath garage toolbar');
    await legacy.click(); await page.waitForFunction(() => +document.querySelector('[data-time]')?.dataset.time > .5, null, { timeout: 60000 });
    await exitDrive(page);
    await openChapters(); assert.match(await dialog().innerText(), /라이선스\s*01/, 'award visible after returning to the garage and previous test mode');
    await shot('garage-award');
    checks.push('real keyboard three-gate 45-second chapter clear; automatic stopping; earned license; garage award visible');

    if (BLOCKED) {
      assert.equal(await profile(), null);
      checks.push('Storage.setItem failure preserves award in memory across drive → garage without pretending persistence');
    } else {
      stage = 'reload persistence';
      const before = saved; await page.reload({ waitUntil: 'networkidle' }); await openChapters();
      assert.match(await dialog().innerText(), /라이선스\s*01/);
      saved = await profile(); assert.deepEqual(saved, before, 'reload preserves profile without replacing the winning time');
      await shot('reload-award');
      checks.push('garage reload preserves the actual license and chapter time');
    }
    assert.deepEqual(errors, [], 'no browser runtime or WebGL errors');
    assert.deepEqual(failures, [], 'no failed requests');
    const report = { checkedAt: new Date().toISOString(), screenshotsCaptured: CAPTURE, blockedStorage: BLOCKED, modalLayouts, roadLayouts, ...result, profile: saved, checks, errors, failures, note: 'Headless Chrome, software GPU and touch viewport emulation. This is not real Samsung-device or human game-feel certification. Physics state and player progress are never injected. The no-screenshots option verifies behavior only, not visual capture.' };
    await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    if (page) await shot('failure').catch(() => {});
    await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({ checkedAt: new Date().toISOString(), stage, error: error.stack, errors, failures }, null, 2));
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
