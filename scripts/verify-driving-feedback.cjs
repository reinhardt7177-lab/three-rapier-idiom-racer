const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { openMenu, resume, exitDrive } = require('./drive-ui.cjs');

(async () => {
  const output = path.resolve('artifacts/driving-feedback'); await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.GARAGE_BROWSER_PATH, args: ['--enable-unsafe-swiftshader'] });
  const errors = [], phases = {};
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(() => {
      const Native = window.AudioContext; window.__audioProbes = [];
      window.AudioContext = class extends Native {
        constructor(...args) { super(...args); window.__audioProbes.push({ context: this }); }
        createGain() {
          const gain = super.createGain(), p = window.__audioProbes.find(p => p.context === this);
          if (p && !p.master) { p.master = gain; p.analyser = this.createAnalyser(); gain.connect(p.analyser); }
          return gain;
        }
      };
    });
    const read = () => page.locator('[data-feedback-push]').evaluate(e => {
      const t = document.querySelector('[data-speed]'); return { speed: +t.dataset.speed, time: +t.dataset.time, fov: +t.dataset.cameraFov, contacts: +t.dataset.contacts,
        push: +e.dataset.feedbackPush, brake: +e.dataset.feedbackBraking, scrub: +e.dataset.feedbackScrub, sliding: e.dataset.feedbackSliding, marks: +e.dataset.feedbackMarks, tireGain: +e.dataset.audioTire, brakeGain: +e.dataset.audioBrake, load: +e.dataset.audioLoad };
    });
    const rms = () => page.evaluate(() => { const p = window.__audioProbes[0], data = new Float32Array(p.analyser.fftSize); p.analyser.getFloatTimeDomainData(data); return Math.sqrt(data.reduce((s, n) => s + n * n, 0) / data.length); });
    await page.goto(process.env.GARAGE_BASE_URL || 'http://127.0.0.1:5175/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'GT 테스트 주행 →' }).click();
    await page.waitForFunction(() => +document.querySelector('[data-time]')?.dataset.time > .5, null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => window.__audioProbes.length), 0);
    await page.getByRole('button', { name: '주행 사운드 켜기', exact: true }).click();
    await page.getByRole('button', { name: '주행 사운드 끄기', exact: true }).waitFor();
    await page.waitForTimeout(400); phases.idle = { ...await read(), rms: await rms() }; assert.ok(phases.idle.rms > .00001);
    assert.equal(await page.evaluate(() => document.activeElement.tagName), 'CANVAS', 'sound toggle returns keyboard focus to driving');
    // Record only the game's generated bus. No microphone or device capture.
    await page.evaluate(() => {
      const p = window.__audioProbes[0]; p.tap = p.context.createMediaStreamDestination(); p.master.connect(p.tap); p.chunks = [];
      p.recorder = new MediaRecorder(p.tap.stream, { mimeType: 'audio/webm;codecs=opus' }); p.recorder.ondataavailable = e => p.chunks.push(e.data); p.recorder.start();
    });
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => +document.querySelector('[data-feedback-push]')?.dataset.feedbackPush > .4 && +document.querySelector('[data-speed]')?.dataset.speed > 20);
    phases.acceleration = { ...await read(), rms: await rms() }; assert.ok(phases.acceleration.load > .5);
    await page.waitForFunction(() => +document.querySelector('[data-speed]')?.dataset.speed > 100, null, { timeout: 30000 });
    await page.keyboard.up('KeyW'); await page.keyboard.down('KeyB'); await page.waitForTimeout(600);
    phases.braking = { ...await read(), rms: await rms() }; assert.ok(phases.braking.brake > .4 && phases.braking.brakeGain > .04); assert.equal(phases.braking.marks, 0);
    await page.screenshot({ path: path.join(output, 'braking.jpg'), type: 'jpeg', quality: 78 });
    await page.keyboard.up('KeyB'); await page.keyboard.down('KeyD'); await page.keyboard.down('Space');
    let best = { scrub: 0 };
    for (let i = 0; i < 22; i++) { await page.waitForTimeout(50); const s = await read(); if (s.scrub > best.scrub) best = s; }
    phases.slip = { ...best, rms: await rms() }; assert.ok(best.scrub > .1 && best.tireGain > .02 && best.marks > 0, JSON.stringify(best));
    await page.screenshot({ path: path.join(output, 'tire-contact.jpg'), type: 'jpeg', quality: 85 });
    await page.keyboard.up('KeyD'); await page.keyboard.up('Space'); await page.keyboard.down('KeyB');
    await page.waitForFunction(() => +document.querySelector('[data-speed]')?.dataset.speed < .5, null, { timeout: 15000 });
    await page.keyboard.up('KeyB'); await page.waitForTimeout(400); phases.stopped = await read();
    assert.equal(phases.stopped.scrub, 0); assert.equal(phases.stopped.brake, 0);
    await openMenu(page); await page.waitForTimeout(500); phases.pause = { ...await read(), rms: await rms() }; assert.ok(phases.pause.rms < .000001);
    const pcm = await page.evaluate(async () => {
      const p = window.__audioProbes[0]; await new Promise(resolve => { p.recorder.onstop = resolve; p.recorder.stop(); });
      const blob = new Blob(p.chunks, { type: 'audio/webm' }), decoded = await p.context.decodeAudioData(await blob.arrayBuffer());
      return { rate: decoded.sampleRate, samples: Array.from(decoded.getChannelData(0)) };
    });
    let peak = 0, sum = 0; const wav = Buffer.alloc(44 + pcm.samples.length * 2);
    wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(pcm.rate, 24); wav.writeUInt32LE(pcm.rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(pcm.samples.length * 2, 40);
    pcm.samples.forEach((v, i) => { assert.ok(Number.isFinite(v)); peak = Math.max(peak, Math.abs(v)); sum += v * v; wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2); });
    const recording = { peak, rms: Math.sqrt(sum / pcm.samples.length), seconds: pcm.samples.length / pcm.rate }; assert.ok(peak < .95 && recording.rms > .0001);
    await fs.writeFile(path.join(output, 'drive-preview.wav'), wav);
    await resume(page); await page.getByRole('button', { name: '주행 사운드 끄기', exact: true }).click(); await page.waitForTimeout(500); assert.ok(await rms() < .000001);
    await page.getByRole('button', { name: '주행 사운드 켜기', exact: true }).click(); assert.equal(await page.evaluate(() => window.__audioProbes.length), 1);
    await page.keyboard.press('KeyR'); await page.waitForTimeout(350); assert.equal((await read()).marks, 0);
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.keyboard.down('KeyW'); await page.waitForTimeout(1600); phases.reducedMotion = await read(); await page.keyboard.up('KeyW'); assert.equal(phases.reducedMotion.fov, 57);
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300); await resume(page);
    await page.screenshot({ path: path.join(output, 'mobile-sound.jpg'), type: 'jpeg', quality: 78 });
    const button = await page.getByRole('button', { name: '주행 사운드 끄기', exact: true }).boundingBox(); assert.ok(button.width >= 48 && button.height >= 48);
    await exitDrive(page); await page.waitForFunction(() => window.__audioProbes.every(p => p.context.state === 'closed'));
    assert.deepEqual(errors, []);
    const report = { checkedAt: new Date().toISOString(), phases, recording, errors, checks: ['actual keyboard acceleration/braking/slip', 'no braking marks without lateral slip', 'contact trails and stopped decay', 'native audio output and unclipped captured WAV', 'pause/mute/graph reuse/disposal', 'reduced motion and mobile sound target'], note: 'Headless Chrome/software GPU. Synthesized sound, not sampled vehicle audio. No physical-device listening/loudness certification.' };
    await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
