// Original Web Audio synthesis; no samples, microphone or network requests.
// The graph is created/resumed ONLY by an explicit sound-button gesture.
const clamp = (value, max = 1) => Math.max(0, Math.min(max, Number(value) || 0));
export function audioMix(state, signals = {}) {
  const speed = Math.abs(Number(state.kmh) || 0), ratio = clamp(speed / 240);
  const gear = /^[1-6]$/.test(state.gear) ? Number(state.gear) : 0;
  const load = clamp(Math.abs(state.drive || 0));
  const phase = clamp((speed - Math.max(0, gear - 1) * 42) / 42);
  const rpm = speed < 1 ? 850 + load * 350 : gear ? 1500 + phase * 3600 : 1100 + clamp(speed / 30) * 2600;
  return { gear, hz: rpm / 30, load, engine: .1 + load * .1 + ratio * .045,
    wind: ratio * ratio * .32, brake: clamp(signals.braking) * .18,
    tire: clamp(signals.scrub) * .24, squeal: clamp(signals.scrub) ** 2 * .023 };
}

export function createDrivingAudio() {
  let context, master, engineGain, windGain, brakeGain, tireGain, squealGain, filter, tireFilter, engine, harmonic, wind, squeal;
  let enabled = false, paused = false, volume = .35, disposed = false, failed = false, request = 0;
  let mix = audioMix({}), previousGear = 0, shiftUntil = 0;
  function silenceTarget() {
    if (master && context?.state !== 'closed') master.gain.setTargetAtTime(enabled && !paused && !disposed ? volume * .32 : 0, context.currentTime, .035);
  }
  function build() {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) throw new Error('Web Audio unavailable');
    context = new Audio();
    master = context.createGain(); master.gain.value = 0; master.connect(context.destination);
    engineGain = context.createGain(); engineGain.gain.value = .1;
    filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 600; filter.Q.value = .45;
    engine = context.createOscillator(); harmonic = context.createOscillator();
    engine.type = 'triangle'; harmonic.type = 'sawtooth'; engine.frequency.value = 28; harmonic.frequency.value = 56;
    const harmonicGain = context.createGain(); harmonicGain.gain.value = .28;
    engine.connect(filter); harmonic.connect(harmonicGain); harmonicGain.connect(filter); filter.connect(engineGain); engineGain.connect(master);
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate), data = buffer.getChannelData(0);
    let seed = 5743;
    for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = seed / 2147483648 - 1; }
    wind = context.createBufferSource(); wind.buffer = buffer; wind.loop = true;
    function noiseBand(frequency, q) {
      const band = context.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = frequency; band.Q.value = q;
      const gain = context.createGain(); gain.gain.value = 0; wind.connect(band); band.connect(gain); gain.connect(master);
      return { band, gain };
    }
    windGain = noiseBand(850, .45).gain;
    brakeGain = noiseBand(480, .85).gain;
    const tire = noiseBand(1450, .9); tireGain = tire.gain; tireFilter = tire.band;
    squeal = context.createOscillator(); squeal.type = 'sine'; squeal.frequency.value = 1050;
    squealGain = context.createGain(); squealGain.gain.value = 0; squeal.connect(squealGain); squealGain.connect(master);
    engine.start(); harmonic.start(); wind.start(); squeal.start();
  }
  return {
    async setEnabled(value) {
      if (disposed) return false;
      const ticket = ++request;
      try {
        if (value && (!context || context.state === 'closed')) build();
        enabled = !!value; silenceTarget();
        if (value) await context.resume();
        if (disposed || ticket !== request) return enabled;
        failed = !!value && context.state !== 'running'; if (failed) enabled = false;
        silenceTarget(); return enabled;
      } catch {
        if (ticket !== request || disposed) return false;
        enabled = false; failed = true; silenceTarget();
        if (context) { try { await context.close(); } catch {} } context = undefined; master = undefined;
        return false;
      }
    },
    setVolume(value) { volume = clamp(value); silenceTarget(); },
    setPaused(value) { paused = !!value; silenceTarget(); },
    update(state, signals = {}) {
      mix = audioMix(state, signals);
      const time = Number(state.elapsed) || 0;
      if (mix.gear > previousGear && previousGear > 0) shiftUntil = time + .13;
      if (time < shiftUntil - .2 || !mix.gear) shiftUntil = 0;
      previousGear = mix.gear;
      if (!context || disposed || context.state !== 'running') return;
      const now = context.currentTime, duck = time < shiftUntil ? .73 : 1;
      engine.frequency.setTargetAtTime(mix.hz, now, .07); harmonic.frequency.setTargetAtTime(mix.hz * 2.003, now, .07);
      filter.frequency.setTargetAtTime(480 + clamp(state.kmh / 240) * 1100 + mix.load * 650, now, .085);
      engineGain.gain.setTargetAtTime(mix.engine * duck, now, .04);
      windGain.gain.setTargetAtTime(mix.wind, now, .16);
      brakeGain.gain.setTargetAtTime(mix.brake, now, .05);
      tireGain.gain.setTargetAtTime(mix.tire, now, .045); squealGain.gain.setTargetAtTime(mix.squeal, now, .05);
      tireFilter.frequency.setTargetAtTime(1050 + clamp(signals.scrub) * 850, now, .08);
      squeal.frequency.setTargetAtTime(1020 + clamp(signals.scrub) * 310, now, .09);
      return mix.gear;
    },
    status() { return { enabled, paused, volume, failed, state: context?.state || 'uninitialized', mix }; },
    dispose() {
      disposed = true; enabled = false; request++;
      if (!context) return;
      master?.gain.cancelScheduledValues(context.currentTime); if (master) master.gain.value = 0;
      [engine, harmonic, wind, squeal].forEach(source => { try { source?.stop(); } catch {} });
      master?.disconnect(); context.close().catch(() => {});
    },
  };
}
