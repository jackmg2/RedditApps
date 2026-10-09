import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DrumSynth } from '../src/client/drumSynth';
import {
  type SequencedBeat,
  Sequencer,
  stepDuration,
} from '../src/client/sequencer';

type Hit = { instrument: string; trackId: number; time: number };

// A stand-in for DrumSynth whose audio clock the test advances by hand.
const fakeSynth = () => {
  const ctx = { currentTime: 0 };
  const hits: Hit[] = [];
  const synth = {
    ctx,
    get currentTime() {
      return ctx.currentTime;
    },
    play: (instrument: string, trackId: number, time: number) => {
      hits.push({ instrument, trackId, time });
    },
  };
  return { synth: synth as unknown as DrumSynth, ctx, hits };
};

const beatOf = (
  bpm: number,
  kick: number[],
  steps: 16 | 32 = 16
): SequencedBeat => ({
  version: 1,
  bpm,
  steps,
  tracks: [
    {
      id: 1,
      instrument: 'kick',
      muted: false,
      steps: Array.from({ length: steps }, (_, i) => kick.includes(i)),
    },
  ],
});

/** Advance the audio clock and the 25 ms scheduler tick together. */
const run = (ctx: { currentTime: number }, seconds: number) => {
  for (let t = 0; t < seconds; t += 0.025) {
    ctx.currentTime += 0.025;
    vi.advanceTimersByTime(25);
  }
};

describe('Sequencer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('schedules hits on an exact grid with no drift', () => {
    const { synth, ctx, hits } = fakeSynth();
    const beat = beatOf(120, [0, 4, 8, 12]);
    const seq = new Sequencer(synth, () => beat);
    seq.start();
    run(ctx, 4); // two bars at 120 BPM

    const step = stepDuration(120);
    expect(step).toBeCloseTo(0.125);
    const first = hits[0]?.time ?? NaN;
    hits.forEach((h, i) => {
      expect(h.time).toBeCloseTo(first + i * 4 * step, 9);
    });
    expect(hits.length).toBeGreaterThanOrEqual(8);
  });

  it('never schedules further ahead than the lookahead window', () => {
    const { synth, ctx, hits } = fakeSynth();
    const beat = beatOf(240, [...Array(16).keys()]);
    const seq = new Sequencer(synth, () => beat);
    seq.start();
    run(ctx, 1);
    for (const h of hits)
      expect(h.time).toBeLessThan(ctx.currentTime + 0.1 + 1e-9);
  });

  it('applies a BPM change from the next step without restarting', () => {
    const { synth, ctx, hits } = fakeSynth();
    const beat = beatOf(120, [...Array(16).keys()]);
    const seq = new Sequencer(synth, () => beat);
    seq.start();
    run(ctx, 0.5);
    const before = hits.length;
    beat.bpm = 60;
    run(ctx, 1);
    const gaps = hits
      .slice(before)
      .map((h, i, arr) => (i === 0 ? null : h.time - (arr[i - 1]?.time ?? 0)));
    for (const gap of gaps.slice(1))
      expect(gap).toBeCloseTo(stepDuration(60), 9);
  });

  it('skips muted tracks and hears cell toggles on the next pass', () => {
    const { synth, ctx, hits } = fakeSynth();
    const beat = beatOf(120, []);
    const seq = new Sequencer(synth, () => beat);
    seq.start();
    run(ctx, 2.1);
    expect(hits).toHaveLength(0);

    const track = beat.tracks[0];
    if (!track) throw new Error('missing track');
    track.steps[0] = true;
    run(ctx, 2.1);
    expect(hits.length).toBeGreaterThan(0);

    const count = hits.length;
    track.muted = true;
    run(ctx, 2.1);
    expect(hits).toHaveLength(count);
  });

  it('reports the sounding step and resets on stop', () => {
    const { synth, ctx } = fakeSynth();
    const beat = beatOf(120, []);
    const seq = new Sequencer(synth, () => beat);
    seq.start();
    expect(seq.currentStep()).toBe(-1);
    run(ctx, 0.05 + 0.125 * 3 + 0.01); // start delay + three steps
    expect(seq.currentStep()).toBe(3);
    expect(seq.elapsed()).toBeGreaterThan(0.3);
    seq.stop();
    expect(seq.currentStep()).toBe(-1);
    expect(seq.elapsed()).toBe(0);
  });

  it('wraps cleanly when the pattern shrinks from 32 to 16 steps mid-play', () => {
    const { synth, ctx } = fakeSynth();
    let beat = beatOf(240, [], 32);
    const seq = new Sequencer(synth, () => beat);
    seq.start();
    run(ctx, 0.05 + 0.0625 * 20);
    beat = beatOf(240, [], 16);
    run(ctx, 1);
    const step = seq.currentStep();
    expect(step).toBeGreaterThanOrEqual(0);
    expect(step).toBeLessThan(16);
  });
});
