/** Samples per audio buffer the core fills before signalling. */
export const audioFrames = 2048
/** Scheduling lead time; keeps playback ~4 frames behind (spec §11). */
const latencySec = 0.07

/**
 * Plays the core's audio by scheduling one AudioBufferSourceNode per filled
 * buffer, the approach binjgb's own web frontend uses. Browsers keep the
 * context suspended until a user gesture, so `unlock()` is wired to the Play
 * tap and the first touch / key press in the player.
 */
export class AudioOut {
  readonly ctx: AudioContext | undefined
  #startSec = 0
  muted = false
  volume = 0.6

  constructor(ctx?: AudioContext) {
    try {
      this.ctx = ctx ?? new AudioContext()
    } catch {
      this.ctx = undefined
    }
  }

  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 44100
  }

  get locked(): boolean {
    return this.ctx?.state === 'suspended'
  }

  unlock(): Promise<void> {
    return this.ctx?.state === 'suspended'
      ? this.ctx.resume().catch(() => {})
      : Promise.resolve()
  }

  suspend(): void {
    this.ctx?.suspend().catch(() => {})
  }

  /** Queues one buffer of interleaved u8 stereo samples. */
  push(samples: Uint8Array): void {
    const ctx = this.ctx
    if (ctx?.state !== 'running' || this.muted) {
      this.#startSec = 0
      return
    }
    const now = ctx.currentTime
    if (!this.#startSec || this.#startSec < now)
      this.#startSec = now + latencySec
    const buffer = ctx.createBuffer(2, audioFrames, ctx.sampleRate)
    const left = buffer.getChannelData(0)
    const right = buffer.getChannelData(1)
    const scale = this.volume / 255
    for (let i = 0; i < audioFrames; i++) {
      left[i] = (samples[2 * i] ?? 0) * scale
      right[i] = (samples[2 * i + 1] ?? 0) * scale
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(ctx.destination)
    src.start(this.#startSec)
    this.#startSec += audioFrames / ctx.sampleRate
  }

  /** Drops queued timing, e.g. after a pause or speed change. */
  resync(): void {
    this.#startSec = 0
  }
}
