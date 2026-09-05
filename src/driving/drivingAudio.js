// Original synthesized engine and filtered wind. No samples or network requests.
// The graph is created/resumed ONLY by the explicit sound button gesture.
export function createDrivingAudio() {
  let context, master, engineGain, windGain, filter, engine, harmonic, wind;
  let enabled = false, paused = false, volume = .35, disposed = false, failed = false;
  function silenceTarget() { if (master) master.gain.setTargetAtTime(enabled && !paused ? volume * .32 : 0, context.currentTime, .035); }
  function build() {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) throw new Error('Web Audio unavailable');
    context = new Audio();
    master = context.createGain(); master.gain.value = 0; master.connect(context.destination);
    engineGain = context.createGain(); engineGain.gain.value = .12;
    filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 700; filter.Q.value = .5;
    engine = context.createOscillator(); harmonic = context.createOscillator();
    engine.type = 'sawtooth'; harmonic.type = 'triangle'; engine.frequency.value = 38; harmonic.frequency.value = 76;
    engine.connect(filter); harmonic.connect(filter); filter.connect(engineGain); engineGain.connect(master);
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate), data = buffer.getChannelData(0);
    let seed = 5743;
    for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = seed / 2147483648 - 1; }
    wind = context.createBufferSource(); wind.buffer = buffer; wind.loop = true;
    const windFilter = context.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 950; windFilter.Q.value = .5;
    windGain = context.createGain(); windGain.gain.value = 0; wind.connect(windFilter); windFilter.connect(windGain); windGain.connect(master);
    engine.start(); harmonic.start(); wind.start();
  }
  return {
    async setEnabled(value) {
      if (disposed) return false;
      try {
        if (value && !context) build();
        enabled = value;
        if (value) await context.resume();
        if (disposed) return false;
        failed = value && context.state !== 'running'; if (failed) enabled = false;
        silenceTarget(); return enabled;
      } catch { enabled = false; failed = true; silenceTarget(); return false; }
    },
    setVolume(value) { volume = Math.max(0, Math.min(1, Number(value) || 0)); silenceTarget(); },
    setPaused(value) { paused = value; silenceTarget(); },
    update(state, throttle) {
      if (!context || disposed || context.state !== 'running') return;
      const speed = Math.abs(state.kmh), ratio = Math.min(1, speed / 240), gear = Math.min(6, 1 + Math.floor(speed / 42));
      const rpm = speed < 1 ? 850 : 1800 + ((speed % 42) / 42) * 3900;
      const hz = rpm / 30, now = context.currentTime;
      engine.frequency.setTargetAtTime(hz, now, .08); harmonic.frequency.setTargetAtTime(hz * 2.003, now, .08);
      filter.frequency.setTargetAtTime(550 + ratio * 1200 + throttle * 550, now, .1);
      engineGain.gain.setTargetAtTime(.1 + throttle * .12 + ratio * .055, now, .08);
      windGain.gain.setTargetAtTime(ratio * ratio * .35, now, .16);
      return gear;
    },
    status() { return { enabled, paused, volume, failed, state: context?.state || 'uninitialized' }; },
    dispose() { disposed = true; enabled = false; if (!context) return; master?.gain.cancelScheduledValues(context.currentTime); if (master) master.gain.value = 0; [engine, harmonic, wind].forEach(source => { try { source?.stop(); } catch {} }); master?.disconnect(); context.close().catch(() => {}); },
  };
}
