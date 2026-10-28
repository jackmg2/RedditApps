/**
 * Thin wrapper over the vendored binjgb core (public/core/, see
 * CORE_VERSION.md). Only the exports listed in BinjgbModule are used.
 */

export const screenWidth = 160
export const screenHeight = 144
export const cpuTicksPerSecond = 4194304
export const ticksPerFrame = 70224

const eventNewFrame = 1
const eventAudioBufferFull = 2
const eventUntilTicks = 4
/** binjgb CgbColorCurve: 2 = Gambatte/Gameboy Online style. */
const cgbColorCurve = 2

export type Button =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'a'
  | 'b'
  | 'start'
  | 'select'
export const buttons: readonly Button[] = [
  'up',
  'down',
  'left',
  'right',
  'a',
  'b',
  'start',
  'select',
]

type Ptr = number

type BinjgbModule = {
  HEAP8: Int8Array
  _malloc(size: number): Ptr
  _free(ptr: Ptr): void
  _emulator_new_simple(
    rom: Ptr,
    size: number,
    sampleRate: number,
    audioFrames: number,
    cgbColorCurve: number,
  ): Ptr
  _emulator_delete(e: Ptr): void
  _emulator_get_ticks_f64(e: Ptr): number
  _emulator_run_until_f64(e: Ptr, ticks: number): number
  _emulator_set_default_joypad_callback(e: Ptr, joypad: Ptr): void
  _emulator_set_bw_palette_simple(
    e: Ptr,
    type: number,
    white: number,
    lightGray: number,
    darkGray: number,
    black: number,
  ): void
  _emulator_was_ext_ram_updated(e: Ptr): number
  _emulator_read_ext_ram(e: Ptr, fileData: Ptr): number
  _emulator_write_ext_ram(e: Ptr, fileData: Ptr): number
  _emulator_read_state(e: Ptr, fileData: Ptr): number
  _emulator_write_state(e: Ptr, fileData: Ptr): number
  _ext_ram_file_data_new(e: Ptr): Ptr
  _state_file_data_new(e: Ptr): Ptr
  _file_data_delete(fileData: Ptr): void
  _get_file_data_ptr(fileData: Ptr): Ptr
  _get_file_data_size(fileData: Ptr): number
  _get_frame_buffer_ptr(e: Ptr): Ptr
  _get_frame_buffer_size(e: Ptr): number
  _get_audio_buffer_ptr(e: Ptr): Ptr
  _get_audio_buffer_capacity(e: Ptr): number
  _joypad_new(): Ptr
  _joypad_delete(joypad: Ptr): void
  _set_joyp_up(e: Ptr, set: boolean): void
  _set_joyp_down(e: Ptr, set: boolean): void
  _set_joyp_left(e: Ptr, set: boolean): void
  _set_joyp_right(e: Ptr, set: boolean): void
  _set_joyp_A(e: Ptr, set: boolean): void
  _set_joyp_B(e: Ptr, set: boolean): void
  _set_joyp_start(e: Ptr, set: boolean): void
  _set_joyp_select(e: Ptr, set: boolean): void
}

declare global {
  interface Window {
    Binjgb?: (opts: {
      locateFile: (path: string) => string
    }) => Promise<BinjgbModule>
  }
}

let corePromise: Promise<BinjgbModule> | undefined

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`failed to load ${src}`))
    document.head.append(script)
  })
}

/** Loads the WASM core once, lazily (spec §7.2). */
export function loadCore(): Promise<BinjgbModule> {
  corePromise ??= (async () => {
    if (typeof WebAssembly !== 'object')
      throw new Error('WebAssembly unavailable')
    await loadScript('core/binjgb.js')
    if (!window.Binjgb) throw new Error('core script did not register')
    return window.Binjgb({locateFile: path => `core/${path}`})
  })()
  corePromise.catch(() => {
    corePromise = undefined
  })
  return corePromise
}

/** 0xRRGGBB → binjgb's little-endian RGBA u32. */
function rgba(rgb: number): number {
  const r = (rgb >> 16) & 0xff
  const g = (rgb >> 8) & 0xff
  const b = rgb & 0xff
  return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0
}

export class Emulator {
  readonly #mod: BinjgbModule
  readonly #e: Ptr
  readonly #joypad: Ptr
  #destroyed = false

  /** Throws if the core rejects the ROM. */
  constructor(
    mod: BinjgbModule,
    rom: Uint8Array,
    sampleRate: number,
    audioFrames: number,
  ) {
    this.#mod = mod
    // The core expects the ROM buffer size aligned up to 32 KB.
    const size = (rom.length + 0x7fff) & ~0x7fff
    // The core takes ownership: emulator_delete frees this buffer.
    const romPtr = mod._malloc(size)
    const heap = this.#heap(romPtr, size)
    heap.fill(0)
    heap.set(rom)
    this.#e = mod._emulator_new_simple(
      romPtr,
      size,
      sampleRate,
      audioFrames,
      cgbColorCurve,
    )
    if (!this.#e) {
      mod._free(romPtr)
      throw new Error('The emulator could not load this ROM.')
    }
    // set_joyp_* only reach the game through the default joypad callback.
    this.#joypad = mod._joypad_new()
    mod._emulator_set_default_joypad_callback(this.#e, this.#joypad)
  }

  /** Fresh view each call: memory growth detaches old ArrayBuffers. */
  #heap(ptr: Ptr, size: number): Uint8Array {
    return new Uint8Array(this.#mod.HEAP8.buffer, ptr, size)
  }

  get ticks(): number {
    return this.#mod._emulator_get_ticks_f64(this.#e)
  }

  /**
   * Runs until `ticks`, calling back on each new frame and full audio
   * buffer.
   */
  runUntil(ticks: number, onFrame?: () => void, onAudio?: () => void): void {
    for (;;) {
      const ev = this.#mod._emulator_run_until_f64(this.#e, ticks)
      if (ev & eventNewFrame) onFrame?.()
      if (ev & eventAudioBufferFull) onAudio?.()
      if (ev & eventUntilTicks) break
    }
  }

  /** RGBA, 160×144×4. */
  frameBuffer(): Uint8Array {
    return this.#heap(
      this.#mod._get_frame_buffer_ptr(this.#e),
      this.#mod._get_frame_buffer_size(this.#e),
    )
  }

  /** Interleaved unsigned 8-bit stereo samples. */
  audioBuffer(): Uint8Array {
    return this.#heap(
      this.#mod._get_audio_buffer_ptr(this.#e),
      this.#mod._get_audio_buffer_capacity(this.#e),
    )
  }

  setButton(button: Button, down: boolean): void {
    const m = this.#mod
    const setters: {[B in Button]: (e: Ptr, set: boolean) => void} = {
      up: m._set_joyp_up,
      down: m._set_joyp_down,
      left: m._set_joyp_left,
      right: m._set_joyp_right,
      a: m._set_joyp_A,
      b: m._set_joyp_B,
      start: m._set_joyp_start,
      select: m._set_joyp_select,
    }
    setters[button](this.#e, down)
  }

  /** DMG shades, lightest first, as 0xRRGGBB. No effect in CGB mode. */
  setDmgPalette(shades: readonly [number, number, number, number]): void {
    const [w, l, d, b] = shades.map(rgba) as [number, number, number, number]
    for (let type = 0; type < 3; type++)
      this.#mod._emulator_set_bw_palette_simple(this.#e, type, w, l, d, b)
  }

  #withFileData<T>(
    fileData: Ptr,
    fn: (fileData: Ptr, buf: Uint8Array) => T,
  ): T {
    try {
      const buf = this.#heap(
        this.#mod._get_file_data_ptr(fileData),
        this.#mod._get_file_data_size(fileData),
      )
      return fn(fileData, buf)
    } finally {
      this.#mod._file_data_delete(fileData)
    }
  }

  wasSramUpdated(): boolean {
    return !!this.#mod._emulator_was_ext_ram_updated(this.#e)
  }

  /** Battery RAM, or an empty array for carts without external RAM. */
  getSram(): Uint8Array {
    return this.#withFileData(
      this.#mod._ext_ram_file_data_new(this.#e),
      (fd, buf) => {
        if (!buf.length) return new Uint8Array()
        this.#mod._emulator_write_ext_ram(this.#e, fd)
        return buf.slice()
      },
    )
  }

  /** Returns false when the size does not match this cartridge. */
  setSram(bytes: Uint8Array): boolean {
    return this.#withFileData(
      this.#mod._ext_ram_file_data_new(this.#e),
      (fd, buf) => {
        if (!buf.length || buf.length !== bytes.length) return false
        buf.set(bytes)
        this.#mod._emulator_read_ext_ram(this.#e, fd)
        return true
      },
    )
  }

  saveState(): Uint8Array {
    return this.#withFileData(
      this.#mod._state_file_data_new(this.#e),
      (fd, buf) => {
        this.#mod._emulator_write_state(this.#e, fd)
        return buf.slice()
      },
    )
  }

  loadState(bytes: Uint8Array): boolean {
    return this.#withFileData(
      this.#mod._state_file_data_new(this.#e),
      (fd, buf) => {
        if (buf.length !== bytes.length) return false
        buf.set(bytes)
        return this.#mod._emulator_read_state(this.#e, fd) === 0
      },
    )
  }

  destroy(): void {
    if (this.#destroyed) return
    this.#destroyed = true
    this.#mod._emulator_delete(this.#e)
    this.#mod._joypad_delete(this.#joypad)
  }
}
