// Original Web Audio synthesis; no samples, microphone or network requests.
// The graph is created/resumed only from a start/sound-button gesture.
import {engineVoice,engineWave} from './engineVoices.js';
const clamp = (value, max = 1) => Math.max(0, Math.min(max, Number(value) || 0));
export function audioMix(state, signals = {},vehicle='legacy') {
  const voice=engineVoice(vehicle);
  const speed = Math.abs(Number(state.kmh) || 0), ratio = clamp(speed / 240);
  const gear = /^[1-6]$/.test(state.gear) ? Number(state.gear) : 0;
  const load = state.brake>0?0:clamp(state.powertrain?.load??Math.abs(state.drive || 0));
  const ratioPerGear = [110, 65, 46, 35, 28, 23];
  const rpm = speed < 1 ? 850 + load * 350 : gear ? 1100 + speed * ratioPerGear[gear - 1] : 1100 + clamp(speed / 30) * 2600;
  const boost = state.action?.active ? load : 0;
  const targetRpm = state.powertrain?.rpm??Math.min(6800, Math.max(rpm + load * 480 + boost * 220, state.launch?.spin > 0 ? 1200 + clamp(state.launch.spin) * 4500 : 0));
  return { gear, rpm: targetRpm, hz: targetRpm * voice.pulses / 60, load, boost, engine: .075 + load * .19 + ratio * .045,
    intake:voice.intake*load,bass:voice.bass,brightness:voice.brightness,shifting:state.powertrain?.shifting,
    wind: ratio * ratio * .32, brake: clamp(signals.braking) * .18,
    tire: clamp(signals.scrub) * .24, scrape:clamp(state.surface?.scrape)*clamp((speed-8)/65)*.18, squeal: clamp(signals.scrub) ** 2 * .023 };
}

export function impactMix(value,{kind='impact',otherVehicle=false}={}){
 const strength=clamp(value);return kind==='scrape'?{body:strength*.025,metal:strength*.20,decay:.045}:{body:strength*(otherVehicle?.32:.27),metal:strength*(otherVehicle?.11:.21),decay:otherVehicle?.11:.075};
}

// Shared tachometer/audio response runs even when sound is disabled.
export function createEngineResponse(vehicle='legacy') {
  let rpm = 850, previousTime = null;
  return {reset(id=vehicle){vehicle=id;rpm=850;previousTime=null;},update(state, signals) {
    const target = audioMix(state, signals,vehicle), time = Number(state.elapsed) || 0;
    if (previousTime === null || time < previousTime) rpm = 850;
    const dt = previousTime === null || time < previousTime ? 0 : Math.min(.1, time - previousTime);
    previousTime = time;
    // Follow the real gearbox cut quickly; the old 180 ms fall smeared most
    // of a short shift into the next gear. Normal revs retain their smoothing.
    const response=target.shifting?.065:target.rpm>rpm?.24:.18;
    rpm += (target.rpm - rpm) * (1 - Math.exp(-dt / response));
    return { ...target, rpm, hz: rpm * engineVoice(vehicle).pulses / 60 };
  } };
}

export function createDrivingAudio() {
  let context, master, engineGain, windGain, brakeGain, tireGain, squealGain, filter, tireFilter, engine, harmonic, wind, squeal, sub, subGain, harmonicGain, boostGain, shiftGain,intakeGain,compressor;
  let enabled = false, paused = false, volume = .35, disposed = false, failed = false, request = 0,impactGain,impactMetalGain,scrapeGain;
  let mix = audioMix({}), previousGear = 0, shiftUntil = 0;
  let vehicle='legacy',shiftCount=0;
  const engineResponse = createEngineResponse();
  function applyVoice(){
    if(context?.createPeriodicWave&&engine?.setPeriodicWave){const w=engineWave(vehicle);engine.setPeriodicWave(context.createPeriodicWave(w.real,w.imag));}
  }
  function silenceTarget() {
    if (master && context?.state !== 'closed') master.gain.setTargetAtTime(enabled && !paused && !disposed ? volume * .32 : 0, context.currentTime, .035);
  }
  function build() {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) throw new Error('Web Audio unavailable');
    context = new Audio();
    master = context.createGain(); master.gain.value = 0;
    // Soft limiter prevents a load/tyre/impact combination from clipping.
    if(context.createDynamicsCompressor){compressor=context.createDynamicsCompressor();compressor.threshold.value=-12;compressor.knee.value=12;compressor.ratio.value=4;compressor.attack.value=.006;compressor.release.value=.15;master.connect(compressor);compressor.connect(context.destination);}
    else master.connect(context.destination);
    engineGain = context.createGain(); engineGain.gain.value = .1;
    filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 600; filter.Q.value = .45;
    engine = context.createOscillator(); harmonic = context.createOscillator();
    engine.type = 'triangle'; harmonic.type = 'sawtooth'; engine.frequency.value = 28; harmonic.frequency.value = 56;
    applyVoice();
    harmonicGain = context.createGain(); harmonicGain.gain.value = .28;
    engine.connect(filter); harmonic.connect(harmonicGain); harmonicGain.connect(filter); filter.connect(engineGain); engineGain.connect(master);
    sub = context.createOscillator(); sub.type = 'sine'; sub.frequency.value = 28;
    subGain = context.createGain(); subGain.gain.value = 0; sub.connect(subGain); subGain.connect(master);
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
    boostGain = noiseBand(2200, .65).gain;
    intakeGain = noiseBand(3400, .75).gain;
    shiftGain = noiseBand(180, 1.1).gain;
    impactGain = noiseBand(320,.6).gain;
    impactMetalGain = noiseBand(2350,.8).gain;
    scrapeGain = noiseBand(1150,.65).gain;
    brakeGain = noiseBand(480, .85).gain;
    const tire = noiseBand(1450, .9); tireGain = tire.gain; tireFilter = tire.band;
    squeal = context.createOscillator(); squeal.type = 'sine'; squeal.frequency.value = 1050;
    squealGain = context.createGain(); squealGain.gain.value = 0; squeal.connect(squealGain); squealGain.connect(master);
    engine.start(); harmonic.start(); sub.start(); wind.start(); squeal.start();
  }
  return {
    setVehicle(id){if(disposed)return;vehicle=engineVoice(id)===engineVoice('legacy')?'legacy':id;engineResponse.reset(vehicle);previousGear=shiftUntil=shiftCount=0;mix=audioMix({}, {},vehicle);applyVoice();},
    reset(){if(disposed)return;engineResponse.reset(vehicle);previousGear=shiftUntil=shiftCount=0;mix=audioMix({}, {},vehicle);},
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
    impact(value,hit){if(!context||paused||!enabled||disposed||context.state!=='running')return;const now=context.currentTime,cue=impactMix(value,hit);for(const [node,level] of [[impactGain,cue.body],[impactMetalGain,cue.metal]]){node.gain.cancelScheduledValues(now);node.gain.setValueAtTime(level,now);node.gain.setTargetAtTime(0,now,cue.decay);}},
    update(state, signals = {}) {
      mix = engineResponse.update(state, signals);
      const time = Number(state.elapsed) || 0;
      if (mix.gear !== previousGear && mix.gear>0 && previousGear > 0){shiftUntil = time + .13;shiftCount++;}
      if (time < shiftUntil - .2 || !mix.gear) shiftUntil = 0;
      previousGear = mix.gear;
      if (!context || disposed || context.state !== 'running') return;
      const now = context.currentTime, shifting = mix.shifting??(time < shiftUntil), duck = shifting ? .52 : 1;
      const pitch = mix.hz;
      engine.frequency.setTargetAtTime(pitch, now, .035); harmonic.frequency.setTargetAtTime(pitch * 2.003, now, .035);
      harmonicGain.gain.setTargetAtTime((.12 + mix.load * .20)*mix.brightness, now, .045);
      sub.frequency.setTargetAtTime(pitch * .5, now, .04);
      subGain.gain.setTargetAtTime((.01 + mix.load * mix.bass) * duck, now, .04);
      boostGain.gain.setTargetAtTime(mix.boost * .10, now, .08);
      intakeGain.gain.setTargetAtTime(mix.intake,now,.06);
      shiftGain.gain.setTargetAtTime(shifting ? .065 * mix.load : 0, now, .012);
      filter.frequency.setTargetAtTime((480 + clamp(state.kmh / 240) * 1100 + mix.load * 650)*mix.brightness, now, .085);
      engineGain.gain.setTargetAtTime(mix.engine * duck, now, .04);
      windGain.gain.setTargetAtTime(mix.wind, now, .16);
      brakeGain.gain.setTargetAtTime(mix.brake, now, .05);
      tireGain.gain.setTargetAtTime(mix.tire, now, .045); squealGain.gain.setTargetAtTime(mix.squeal, now, .05);
      scrapeGain.gain.setTargetAtTime(mix.scrape,now,.045);
      tireFilter.frequency.setTargetAtTime(1050 + clamp(signals.scrub) * 850, now, .08);
      squeal.frequency.setTargetAtTime(1020 + clamp(signals.scrub) * 310, now, .09);
      return mix.gear;
    },
    status() { return { enabled, paused, volume, failed, state: context?.state || 'uninitialized',vehicle,voice:engineVoice(vehicle).label,shiftCount,audible:enabled&&!paused&&context?.state==='running'&&!disposed,mix }; },
    dispose() {
      disposed = true; enabled = false; request++;
      if (!context) return;
      master?.gain.cancelScheduledValues(context.currentTime); if (master) master.gain.value = 0;
      [engine, harmonic, sub, wind, squeal].forEach(source => { try { source?.stop(); } catch {} });
      master?.disconnect();compressor?.disconnect(); context.close().catch(() => {});
    },
  };
}
