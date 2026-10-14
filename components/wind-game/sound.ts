// Cozy pond ambience and little effects, all synthesised with WebAudio so
// there's nothing to download. Browsers only allow audio after a user
// gesture, so nothing plays until start() is called from one.

const MUTE_KEY = "frogtech-wind-muted";

export class PondAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private timers: number[] = [];
  private noise: AudioBuffer | null = null;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === "1";
    } catch {}
  }

  // call from a click/tap/keypress
  start() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();

      return;
    }
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;

    if (!Ctx) return;
    const ctx = new Ctx();

    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(ctx.destination);

    // two seconds of white noise, looped for wind and water
    const len = ctx.sampleRate * 2;

    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);

    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    // wind: band-passed noise, volume and brightness follow the air speed
    const wind = this.loopNoise();

    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = "bandpass";
    this.windFilter.frequency.value = 400;
    this.windFilter.Q.value = 0.7;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.015;
    wind.connect(this.windFilter).connect(this.windGain).connect(this.master);

    // water: very soft low noise with a slow swell
    const water = this.loopNoise();
    const waterFilter = ctx.createBiquadFilter();
    const waterGain = ctx.createGain();
    const swell = ctx.createOscillator();
    const swellDepth = ctx.createGain();

    waterFilter.type = "lowpass";
    waterFilter.frequency.value = 280;
    waterGain.gain.value = 0.025;
    swell.frequency.value = 0.13;
    swellDepth.gain.value = 0.012;
    swell.connect(swellDepth).connect(waterGain.gain);
    swell.start();
    water.connect(waterFilter).connect(waterGain).connect(this.master);

    this.schedule(() => this.cricket(), 1500, 4500);
    this.schedule(() => this.croak(), 7000, 16000);
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem(MUTE_KEY, m ? "1" : "0");
    } catch {}
    if (this.ctx && this.master)
      this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  // air speed near the frog in cells/s
  wind(speed: number) {
    if (!this.ctx || !this.windGain || !this.windFilter) return;
    const k = Math.min(1, speed / 14);
    const t = this.ctx.currentTime;

    this.windGain.gain.setTargetAtTime(0.012 + k * 0.09, t, 0.25);
    this.windFilter.frequency.setTargetAtTime(300 + k * 900, t, 0.25);
  }

  // ---------- effects ----------
  place() {
    this.tone(190, 0.09, 0.22, "triangle", 120);
    this.click(0.04, 2500);
  }

  remove() {
    this.tone(320, 0.06, 0.12, "triangle", 260);
  }

  rotate() {
    this.click(0.05, 4000);
  }

  splash() {
    if (!this.ctx || !this.master || !this.noise) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    src.buffer = this.noise;
    f.type = "lowpass";
    f.frequency.setValueAtTime(2200, t);
    f.frequency.exponentialRampToValueAtTime(300, t + 0.45);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.55);
    this.tone(520, 0.12, 0.08, "sine", 260);
  }

  clear() {
    // soft pentatonic arpeggio
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.9, 0.12, "sine"), i * 110),
    );
  }

  dispose() {
    this.timers.forEach((t) => clearTimeout(t));
    void this.ctx?.close();
    this.ctx = null;
  }

  // ---------- helpers ----------
  private loopNoise() {
    const src = this.ctx!.createBufferSource();

    src.buffer = this.noise;
    src.loop = true;
    src.start();

    return src;
  }

  private tone(
    freq: number,
    dur: number,
    vol: number,
    type: OscillatorType,
    endFreq?: number,
  ) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private click(vol: number, freq: number) {
    if (!this.ctx || !this.master || !this.noise) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    src.buffer = this.noise;
    f.type = "highpass";
    f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.05);
  }

  // a cricket: a few fast high pulses
  private cricket() {
    const base = 4200 + Math.random() * 600;
    const n = 2 + Math.floor(Math.random() * 3);

    for (let i = 0; i < n; i++)
      setTimeout(() => this.tone(base, 0.04, 0.012, "sine"), i * 70);
  }

  // a distant frog: two low throaty bumps
  private croak() {
    const f = 140 + Math.random() * 40;

    this.tone(f, 0.16, 0.05, "sawtooth", f * 0.7);
    setTimeout(() => this.tone(f * 1.1, 0.2, 0.04, "sawtooth", f * 0.75), 190);
  }

  // repeat fn at a random interval between min and max ms
  private schedule(fn: () => void, min: number, max: number) {
    const next = () => {
      const id = window.setTimeout(
        () => {
          fn();
          next();
        },
        min + Math.random() * (max - min),
      );

      this.timers.push(id);
    };

    next();
  }
}
