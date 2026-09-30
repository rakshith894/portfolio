import type { IslandMode } from './island-mode.ts';
export function createAmbience() {
  const ctx = new AudioContext();
  const gain = ctx.createGain();
  gain.gain.value = 0.18;
  gain.connect(ctx.destination);
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last = (last + (Math.random() * 2 - 1) * 0.02) / 1.02;
    data[i] = last * 3;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  const filter = ctx.createBiquadFilter();
  let closed = false;
  filter.type = 'lowpass';
  filter.frequency.value = 380;
  noise.connect(filter);
  filter.connect(gain);
  noise.start();
  const droneGains: GainNode[] = [];
  const drones = [55, 82.6].map((hz) => {
    const o = ctx.createOscillator();
    o.frequency.value = hz;
    const g = ctx.createGain();
    g.gain.value = 0.075;
    droneGains.push(g);
    o.connect(g);
    g.connect(gain);
    o.start();
    return o;
  });
  const active = new Set<AudioScheduledSourceNode>();
  function tone(from: number, to: number, duration: number, volume: number, pan: number, type: OscillatorType = 'sine') {
    if (closed || ctx.state !== 'running') return;
    const oscillator=ctx.createOscillator(), envelope=ctx.createGain(), stereo=ctx.createStereoPanner();
    const now=ctx.currentTime;
    oscillator.type=type;
    oscillator.frequency.setValueAtTime(from,now);
    oscillator.frequency.exponentialRampToValueAtTime(to,now+duration);
    envelope.gain.setValueAtTime(0,now);
    envelope.gain.linearRampToValueAtTime(volume,now+Math.min(.12,duration/4));
    envelope.gain.exponentialRampToValueAtTime(.0001,now+duration);
    stereo.pan.value=Math.max(-1,Math.min(1,pan));
    oscillator.connect(envelope); envelope.connect(stereo); stereo.connect(gain);
    active.add(oscillator);
    oscillator.onended=()=>{active.delete(oscillator);oscillator.disconnect();envelope.disconnect();stereo.disconnect();};
    oscillator.start();oscillator.stop(now+duration);
  }
  function rustle(duration: number, frequency: number, volume: number, pan: number) {
    if (closed || ctx.state !== 'running') return;
    const source=ctx.createBufferSource(), band=ctx.createBiquadFilter(), envelope=ctx.createGain(), stereo=ctx.createStereoPanner();
    const now=ctx.currentTime;
    source.buffer=buffer; source.loop=true;
    band.type='bandpass';band.frequency.value=frequency;band.Q.value=1.5;
    envelope.gain.setValueAtTime(0,now);envelope.gain.linearRampToValueAtTime(volume,now+.025);envelope.gain.exponentialRampToValueAtTime(.0001,now+duration);
    stereo.pan.value=Math.max(-1,Math.min(1,pan));
    source.connect(band);band.connect(envelope);envelope.connect(stereo);stereo.connect(gain);
    active.add(source);source.onended=()=>{active.delete(source);source.disconnect();band.disconnect();envelope.disconnect();stereo.disconnect();};
    source.start();source.stop(now+duration);
  }
  return {
    get running() { return !closed && ctx.state === 'running'; },
    setMode(mode: IslandMode) {
      if (closed) return;
      filter.frequency.setTargetAtTime(mode === 'winter' ? 850 : mode === 'day' ? 550 : 380, ctx.currentTime, .6);
      for (const g of droneGains) g.gain.setTargetAtTime(mode === 'night' ? .075 : mode === 'winter' ? .016 : 0, ctx.currentTime, .6);
    },
    step: (running = false, wooden = false, side = 0) => {
      tone(wooden?150:95,wooden?65:42,.14,running?.48:.3,side);
      rustle(.13,wooden?650:1400,running?1.5:1,side);
    },
    gate: (pan = 0) => {
      tone(190,53,1.7,.18,pan,'sawtooth');
      tone(315,120,1.1,.1,pan,'triangle');
      rustle(1.5,700,.9,pan);
    },
    ghost: (pan = 0, strength = 1) => {
      tone(155,68,3.6,.28*strength,pan);
      tone(162,74,4,.19*strength,-pan);
      rustle(2.8,950,1.4*strength,pan);
    },
    row: () => {
      rustle(.65,420,1.2,-.45);rustle(.8,680,.85,.45);
      tone(125,70,.3,.13,0,'triangle');
    },
    bell: (pan = 0) => {
      // Distant, inharmonic bronze toll with a slow decaying tail.
      for(const [frequency,volume] of [[110,.34],[231,.14],[307,.09],[467,.045]])
        tone(frequency,frequency*.997,6,volume,pan);
    },
    thunder: () => {
      rustle(4.5,95,1.5,-.3);rustle(3.2,180,.7,.4);
      tone(47,28,3.5,.35,0);
    },
    resume: () => ctx.resume(),
    suspend: () => ctx.suspend(),
    close: () => {
      if (closed) return;
      closed = true;
      noise.stop();
      drones.forEach((o) => o.stop());
      active.forEach(source => { source.onended=null; source.stop(); source.disconnect(); });
      active.clear();
      void ctx.close();
    },
  };
}
