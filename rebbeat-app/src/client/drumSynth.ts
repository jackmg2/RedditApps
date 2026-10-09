// Every instrument is synthesized with Web Audio — no sample files.
// Each hit builds a short-lived node graph (sources → filters → envelope →
// track gain → compressor → master), started and stopped at an exact
// AudioContext time; the graph disconnects itself in `onended`.
import type { InstrumentId } from '../shared/beat';

const SILENT = 0.0001; // exponential ramps cannot reach 0
const TAIL = 0.03; // keep sources alive a little past the envelope end

// Classic 808 hi-hat partials: six square waves at inharmonic ratios.
const METAL_FUNDAMENTAL = 40;
const METAL_RATIOS = [2, 3, 4.16, 5.43, 6.79, 8.21];

class Hit {
  private readonly nodes: AudioNode[] = [];
  private readonly sources: {
    node: AudioScheduledSourceNode;
    offset?: number;
  }[] = [];

  constructor(
    readonly ctx: BaseAudioContext,
    readonly t: number,
    private readonly noiseBuffer: AudioBuffer
  ) {}

  add<T extends AudioNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }

  osc(type: OscillatorType, frequency: number): OscillatorNode {
    const node = this.add(new OscillatorNode(this.ctx, { type, frequency }));
    this.sources.push({ node });
    return node;
  }

  noise(): AudioBufferSourceNode {
    const node = this.add(
      new AudioBufferSourceNode(this.ctx, {
        buffer: this.noiseBuffer,
        loop: true,
      })
    );
    // Random start point so consecutive hits are not sample-identical.
    this.sources.push({
      node,
      offset: Math.random() * this.noiseBuffer.duration,
    });
    return node;
  }

  filter(type: BiquadFilterType, frequency: number, Q = 1): BiquadFilterNode {
    return this.add(new BiquadFilterNode(this.ctx, { type, frequency, Q }));
  }

  gain(value = 1): GainNode {
    return this.add(new GainNode(this.ctx, { gain: value }));
  }

  /** Percussive envelope on `g`; returns the time the hit is silent. */
  env(
    g: GainNode,
    peak: number,
    decay: number,
    attack = 0.001,
    start = this.t
  ): number {
    const p = g.gain;
    p.setValueAtTime(SILENT, start);
    p.exponentialRampToValueAtTime(peak, start + attack);
    p.exponentialRampToValueAtTime(SILENT, start + attack + decay);
    return start + attack + decay;
  }

  /** Start every source at `t`, stop at `end`, clean up when done. */
  finish(end: number): void {
    const stopAt = end + TAIL;
    for (const { node, offset } of this.sources) {
      if (offset === undefined) node.start(this.t);
      else (node as AudioBufferSourceNode).start(this.t, offset);
      node.stop(stopAt);
    }
    const last = this.sources[this.sources.length - 1];
    if (last) {
      last.node.onended = () => {
        for (const n of this.nodes) n.disconnect();
      };
    }
  }
}

type Recipe = (h: Hit, out: AudioNode, synth: DrumSynth) => number;

const metallic = (
  h: Hit,
  into: AudioNode,
  fundamental = METAL_FUNDAMENTAL
): void => {
  for (const ratio of METAL_RATIOS) {
    h.osc('square', fundamental * ratio).connect(into);
  }
};

const hat = (h: Hit, out: AudioNode, decay: number): GainNode => {
  const bandpass = h.filter('bandpass', 10000, 1);
  const highpass = h.filter('highpass', 7000, 0.7);
  const vca = h.gain(0);
  metallic(h, bandpass);
  bandpass.connect(highpass).connect(vca).connect(out);
  h.env(vca, 0.32, decay);
  return vca;
};

const sweep = (
  h: Hit,
  out: AudioNode,
  from: number,
  to: number,
  decay: number,
  peak = 0.9
): number => {
  const osc = h.osc('sine', from);
  osc.frequency.setValueAtTime(from, h.t);
  osc.frequency.exponentialRampToValueAtTime(to, h.t + decay * 0.6);
  const vca = h.gain(0);
  osc.connect(vca).connect(out);
  return h.env(vca, peak, decay);
};

const RECIPES: Record<InstrumentId, Recipe> = {
  kick: (h, out) => {
    const osc = h.osc('sine', 150);
    osc.frequency.setValueAtTime(150, h.t);
    osc.frequency.exponentialRampToValueAtTime(40, h.t + 0.12);
    const body = h.gain(0);
    osc.connect(body).connect(out);
    const end = h.env(body, 1, 0.3);
    // 1 ms click for the beater attack.
    const click = h.gain(0);
    h.noise()
      .connect(h.filter('highpass', 1500, 0.7))
      .connect(click)
      .connect(out);
    h.env(click, 0.5, 0.001, 0.0005);
    return end;
  },
  snare: (h, out) => {
    const rattle = h.gain(0);
    h.noise()
      .connect(h.filter('bandpass', 1800, 0.8))
      .connect(rattle)
      .connect(out);
    const end = h.env(rattle, 0.8, 0.18);
    const tone = h.gain(0);
    h.osc('triangle', 180).connect(tone).connect(out);
    h.env(tone, 0.55, 0.08);
    return end;
  },
  clap: (h, out) => {
    const vca = h.gain(0);
    h.noise()
      .connect(h.filter('bandpass', 1200, 1.2))
      .connect(vca)
      .connect(out);
    const p = vca.gain;
    p.setValueAtTime(SILENT, h.t);
    for (let i = 0; i < 3; i++) {
      const tb = h.t + i * 0.01;
      p.setValueAtTime(0.9, tb);
      p.exponentialRampToValueAtTime(0.08, tb + 0.009);
    }
    const tail = h.t + 0.03;
    p.setValueAtTime(0.75, tail);
    p.exponentialRampToValueAtTime(SILENT, tail + 0.15);
    return tail + 0.15;
  },
  rim: (h, out) => {
    const tone = h.gain(0);
    h.osc('square', 450)
      .connect(h.filter('bandpass', 900, 1.5))
      .connect(tone)
      .connect(out);
    const end = h.env(tone, 0.45, 0.015);
    const tick = h.gain(0);
    h.noise()
      .connect(h.filter('highpass', 4000, 0.7))
      .connect(tick)
      .connect(out);
    h.env(tick, 0.4, 0.01);
    return end;
  },
  hhc: (h, out, synth) => {
    synth.choke(h.t);
    hat(h, out, 0.05);
    return h.t + 0.051;
  },
  hho: (h, out, synth) => {
    synth.choke(h.t);
    // An extra gain stage that only the choke automates, so the envelope
    // above it never has to be cancelled mid-ramp.
    const chokeGain = h.gain(1);
    hat(h, chokeGain, 0.35);
    chokeGain.connect(out);
    synth.registerOpenHat(chokeGain, h.t, h.t + 0.351);
    return h.t + 0.351;
  },
  crash: (h, out) => {
    const highpass = h.filter('highpass', 3000, 0.7);
    const vca = h.gain(0);
    h.noise().connect(highpass);
    for (const f of [296, 418, 587, 811]) {
      const osc = h.osc('square', f);
      osc.detune.value = (Math.random() - 0.5) * 30;
      osc.connect(highpass);
    }
    highpass.connect(vca).connect(out);
    return h.env(vca, 0.28, 1.2, 0.002);
  },
  ride: (h, out) => {
    const bandpass = h.filter('bandpass', 6000, 1.2);
    const vca = h.gain(0);
    metallic(h, bandpass, 62);
    bandpass.connect(vca).connect(out);
    return h.env(vca, 0.18, 0.6, 0.002);
  },
  tomL: (h, out) => sweep(h, out, 110, 70, 0.35),
  tomM: (h, out) => sweep(h, out, 170, 110, 0.3),
  tomH: (h, out) => sweep(h, out, 260, 170, 0.25),
  cowb: (h, out) => {
    const bandpass = h.filter('bandpass', 1000, 1.1);
    const vca = h.gain(0);
    h.osc('square', 587).connect(bandpass);
    h.osc('square', 845).connect(bandpass);
    bandpass.connect(vca).connect(out);
    return h.env(vca, 0.4, 0.25);
  },
  shak: (h, out) => {
    const vca = h.gain(0);
    h.noise()
      .connect(h.filter('bandpass', 9000, 1.4))
      .connect(vca)
      .connect(out);
    return h.env(vca, 0.9, 0.09, 0.012);
  },
  clav: (h, out) => {
    const vca = h.gain(0);
    h.osc('sine', 2500).connect(vca).connect(out);
    return h.env(vca, 0.5, 0.04);
  },
  bass: (h, out) => {
    const lowpass = h.filter('lowpass', 800, 4);
    lowpass.frequency.setValueAtTime(800, h.t);
    lowpass.frequency.exponentialRampToValueAtTime(120, h.t + 0.25);
    const vca = h.gain(0);
    h.osc('sawtooth', 55).connect(lowpass).connect(vca).connect(out);
    return h.env(vca, 0.6, 0.25, 0.003);
  },
  blip: (h, out) => {
    const vca = h.gain(0);
    h.osc('sine', 880).connect(vca).connect(out);
    return h.env(vca, 0.3, 0.06, 0.002);
  },
};

type OpenHat = { gain: GainNode; start: number; end: number };

export class DrumSynth {
  ctx: AudioContext | null = null;
  private input: AudioNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private readonly trackGains = new Map<number, GainNode>();
  private openHats: OpenHat[] = [];

  /**
   * Create the AudioContext. Must run synchronously inside a user gesture
   * handler so the browser lets audio start. Returns false on failure.
   */
  init(): boolean {
    if (this.ctx) {
      void this.ctx.resume();
      return true;
    }
    try {
      const ctx = new AudioContext({ latencyHint: 'interactive' });
      const compressor = new DynamicsCompressorNode(ctx, {
        threshold: -18,
        ratio: 4,
      });
      const master = new GainNode(ctx, { gain: 0.8 });
      compressor.connect(master).connect(ctx.destination);

      const length = Math.floor(ctx.sampleRate * 2);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

      this.ctx = ctx;
      this.input = compressor;
      this.noiseBuffer = buffer;
      void ctx.resume();
      return true;
    } catch (error) {
      console.error('Audio initialization failed:', error);
      return false;
    }
  }

  get currentTime(): number {
    return this.ctx?.currentTime ?? 0;
  }

  suspend(): void {
    void this.ctx?.suspend();
  }

  resume(): void {
    void this.ctx?.resume();
  }

  private trackOutput(trackId: number): AudioNode | null {
    if (!this.ctx || !this.input) return null;
    let g = this.trackGains.get(trackId);
    if (!g) {
      g = new GainNode(this.ctx, { gain: 1 });
      g.connect(this.input);
      this.trackGains.set(trackId, g);
    }
    return g;
  }

  /** Mute applies immediately, including hits already in the lookahead window. */
  setTrackMuted(trackId: number, muted: boolean): void {
    const g = this.trackGains.get(trackId);
    if (g && this.ctx) {
      g.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.005);
    }
  }

  /** Drop track outputs that no longer have a track behind them. */
  pruneTracks(liveIds: ReadonlySet<number>): void {
    for (const [id, g] of this.trackGains) {
      if (!liveIds.has(id)) {
        g.disconnect();
        this.trackGains.delete(id);
      }
    }
  }

  /** Schedule one hit at AudioContext time `time` (defaults to now). */
  play(instrument: InstrumentId, trackId: number, time?: number): void {
    const out = this.trackOutput(trackId);
    if (!this.ctx || !this.noiseBuffer || !out) return;
    const t = Math.max(time ?? this.ctx.currentTime, this.ctx.currentTime);
    const hit = new Hit(this.ctx, t, this.noiseBuffer);
    const end = RECIPES[instrument](hit, out, this);
    hit.finish(end);
  }

  /** Hi-hat choke: a hat played at `t` silences open hats still ringing. */
  choke(t: number): void {
    this.openHats = this.openHats.filter((h) => h.end > t);
    for (const h of this.openHats) {
      if (h.start >= t) continue; // same-step open hat survives
      h.gain.gain.setValueAtTime(1, t);
      h.gain.gain.linearRampToValueAtTime(0, t + 0.012);
      h.end = t;
    }
  }

  registerOpenHat(gain: GainNode, start: number, end: number): void {
    this.openHats.push({ gain, start, end });
  }
}
