// Lookahead step sequencer ("two clocks"): a coarse setInterval tick
// schedules every step falling in the next LOOKAHEAD seconds at exact
// AudioContext times. Step times advance from the previous *scheduled* time,
// so drift never accumulates. The visual cursor is driven separately by
// requestAnimationFrame draining the queue of scheduled steps.
import type { Beat, InstrumentId } from '../shared/beat';
import type { DrumSynth } from './drumSynth';

const TICK_MS = 25;
const LOOKAHEAD = 0.1; // seconds
const START_DELAY = 0.05; // seconds between pressing Play and step 1

export type SequencedTrack = {
  id: number;
  instrument: InstrumentId;
  steps: boolean[];
  muted: boolean;
};

export type SequencedBeat = Omit<Beat, 'tracks'> & { tracks: SequencedTrack[] };

type StepEvent = { step: number; time: number };

export const stepDuration = (bpm: number): number => 60 / bpm / 4;

export class Sequencer {
  isPlaying = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  private nextStep = 0;
  private nextTime = 0;
  private startTime = 0;
  private queue: StepEvent[] = [];
  private current = -1;

  constructor(
    private readonly synth: DrumSynth,
    private readonly getBeat: () => SequencedBeat
  ) {}

  /** Returns false when there is no running AudioContext. */
  start(): boolean {
    const ctx = this.synth.ctx;
    if (!ctx || this.isPlaying) return Boolean(ctx);
    this.isPlaying = true;
    this.nextStep = 0;
    this.nextTime = ctx.currentTime + START_DELAY;
    this.startTime = this.nextTime;
    this.queue = [];
    this.current = -1;
    this.tick();
    this.timer = setInterval(() => this.tick(), TICK_MS);
    return true;
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
    this.isPlaying = false;
    this.queue = [];
    this.current = -1;
  }

  private tick(): void {
    const ctx = this.synth.ctx;
    if (!ctx || !this.isPlaying) return;

    // After a long main-thread stall, skip the missed steps instead of
    // firing them all at once.
    if (this.nextTime < ctx.currentTime - LOOKAHEAD) {
      this.nextTime = ctx.currentTime + 0.01;
    }

    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      // Read the beat per step: cell toggles, BPM and length changes all
      // apply from the next scheduled step without restarting.
      const beat = this.getBeat();
      const step = this.nextStep % beat.steps;
      for (const track of beat.tracks) {
        if (!track.muted && track.steps[step]) {
          this.synth.play(track.instrument, track.id, this.nextTime);
        }
      }
      this.queue.push({ step, time: this.nextTime });
      this.nextTime += stepDuration(beat.bpm);
      this.nextStep = (step + 1) % beat.steps;
    }
  }

  /** The step currently sounding (-1 before the first one), for the UI. */
  currentStep(): number {
    const now = this.synth.currentTime;
    while (this.queue.length > 0 && (this.queue[0]?.time ?? Infinity) <= now) {
      this.current = this.queue.shift()?.step ?? this.current;
    }
    return this.current;
  }

  /** Seconds since step 1 first sounded. */
  elapsed(): number {
    return this.isPlaying
      ? Math.max(0, this.synth.currentTime - this.startTime)
      : 0;
  }
}
