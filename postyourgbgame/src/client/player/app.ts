import {
  apiPath,
  type GetRomRsp,
  type GetSaveRsp,
  type OkRsp,
  type RomPublicMeta,
} from '../../shared/api.ts'
import {applyColourMode, runsInCgbMode} from '../../shared/rom.ts'
import {api} from '../lib/api.ts'
import {base64ToBytes, bytesToBase64, safeStorage} from '../lib/base64.ts'
import {append, clear, el, isTouchDevice, modal} from '../lib/dom.ts'
import {AudioOut, audioFrames} from './audio.ts'
import {
  type Button,
  buttons,
  cpuTicksPerSecond,
  Emulator,
  loadCore,
  screenHeight,
  screenWidth,
} from './emulator.ts'
import {
  defaultBindings,
  dpadDirections,
  InputState,
  type KeyBindings,
  keyLabel,
  loadBindings,
  pollGamepad,
  saveBindings,
} from './input.ts'
import {paletteAt, palettes} from './palettes.ts'

/** Run at most this much emulated time per animation frame (5 frames). */
const maxUpdateSec = 5 / 60
/** SRAM uploads are debounced to once per 10 s, plus on pause / exit. */
const saveIntervalMs = 10_000
/** fetch keepalive bodies are capped at 64 KB by browsers. */
const keepaliveMax = 60 * 1024
/** Toolbar glyphs; U+FE0E asks for text (not emoji) presentation. */
const icons = {
  pause: '\u23F8\uFE0E',
  play: '\u25B6\uFE0E',
  sound: '\u{1F50A}',
  muted: '\u{1F507}',
}

export type PlayerOptions = {
  postId: string
  loggedIn: boolean
}

export function mountPlayer(root: HTMLElement, opts: PlayerOptions): void {
  const player = new Player(root, opts)
  void player.start()
}

class Player {
  readonly #root: HTMLElement
  readonly #opts: PlayerOptions
  readonly #audio: AudioOut
  readonly #input: InputState
  #bindings: KeyBindings = loadBindings()

  #meta: RomPublicMeta | undefined
  #emu: Emulator | undefined
  #cgb = false

  #raf = 0
  #lastSec = 0
  #leftoverTicks = 0
  #speed = 1
  #userPaused = false
  #running = false
  #frameDirty = false
  #paletteIdx = Number(safeStorage.get('hb:palette') ?? 0) % palettes.length
  #state: Uint8Array | undefined
  #sramDirty = false
  #rebinding: Button | undefined

  // DOM
  readonly #canvas = el('canvas', {
    class: 'screen',
    'aria-label': 'Game screen',
  })
  readonly #ctx2d: CanvasRenderingContext2D | null
  readonly #image: ImageData | undefined
  readonly #overlay = el('div', {class: 'screen-overlay'})
  readonly #screenWrap = el(
    'div',
    {class: 'screen-wrap'},
    this.#canvas,
    this.#overlay,
  )
  readonly #status = el('div', {class: 'player-status', role: 'status'})
  readonly #pauseBtn = el('button', {type: 'button', class: 'icon'})
  readonly #muteBtn = el('button', {type: 'button', class: 'icon'})
  readonly #speedBtn = el('button', {type: 'button'}, '1×')
  readonly #paletteBtn = el('button', {type: 'button'}, 'Palette')
  readonly #soundHint = el(
    'button',
    {type: 'button', class: 'sound-hint', hidden: true},
    'Tap for sound',
  )

  constructor(root: HTMLElement, opts: PlayerOptions) {
    this.#root = root
    this.#opts = opts
    this.#audio = new AudioOut()
    this.#input = new InputState((b, down) => this.#emu?.setButton(b, down))
    this.#canvas.width = screenWidth
    this.#canvas.height = screenHeight
    this.#ctx2d = this.#canvas.getContext('2d')
    this.#image = this.#ctx2d?.createImageData(screenWidth, screenHeight)
    this.#setIcon(this.#pauseBtn, icons.pause, 'Pause')
    this.#setIcon(this.#muteBtn, icons.sound, 'Mute')
  }

  async start(): Promise<void> {
    this.#renderShell()
    this.#showOverlay('Loading…')
    const [romRsp, core] = await Promise.all([
      api<GetRomRsp>('GET', apiPath.rom(this.#opts.postId)),
      loadCore().catch((err: unknown) => err as Error),
    ])

    if (!romRsp.ok) {
      this.#showOverlay(romRsp.error.message, {
        label: 'Retry',
        action: () => void this.start(),
      })
      return
    }
    this.#meta = romRsp.data.meta
    const rom = base64ToBytes(romRsp.data.romBase64)

    if (core instanceof Error) {
      console.error('core load failed;', core)
      this.#showOverlay("Your browser can't run the emulator.")
      return
    }

    const meta = this.#meta
    this.#cgb = runsInCgbMode(meta.cgbFlag, meta.colourMode)
    try {
      this.#emu = new Emulator(
        core,
        applyColourMode(rom, meta.colourMode),
        this.#audio.sampleRate,
        audioFrames,
      )
    } catch (err) {
      console.error(err)
      this.#showOverlay("Your browser can't run this ROM.")
      return
    }
    if (!this.#cgb) this.#emu.setDmgPalette(paletteAt(this.#paletteIdx).shades)
    this.#paletteBtn.hidden = this.#cgb

    await this.#loadSram()
    this.#hideOverlay()
    this.#bindEvents()
    this.#resume()
  }

  // --- Loop --------------------------------------------------------------------

  #resume(): void {
    if (this.#running || !this.#emu) return
    this.#running = true
    this.#lastSec = 0
    this.#leftoverTicks = 0
    this.#audio.resync()
    this.#raf = requestAnimationFrame(ms => this.#tick(ms))
    this.#setIcon(this.#pauseBtn, icons.pause, 'Pause')
    this.#updateSoundHint()
  }

  #pause(): void {
    if (!this.#running) return
    this.#running = false
    cancelAnimationFrame(this.#raf)
    this.#input.releaseAll()
    this.#setIcon(this.#pauseBtn, icons.play, 'Resume')
    void this.#flushSram()
  }

  #tick(ms: number): void {
    if (!this.#running || !this.#emu) return
    this.#raf = requestAnimationFrame(t => this.#tick(t))
    const emu = this.#emu
    const sec = ms / 1000
    const delta = Math.max(sec - (this.#lastSec || sec), 0)
    this.#lastSec = sec

    this.#input.replace('gamepad', pollGamepad())

    const deltaTicks =
      Math.min(delta, maxUpdateSec) * cpuTicksPerSecond * this.#speed
    const until = emu.ticks + deltaTicks - this.#leftoverTicks
    emu.runUntil(
      until,
      () => {
        this.#frameDirty = true
      },
      () => {
        // At 2× the audio would drift ahead of real time; drop it.
        if (this.#speed === 1) this.#audio.push(emu.audioBuffer())
      },
    )
    this.#leftoverTicks = (emu.ticks - until) | 0

    if (this.#frameDirty && this.#ctx2d && this.#image) {
      this.#image.data.set(emu.frameBuffer())
      this.#ctx2d.putImageData(this.#image, 0, 0)
      this.#frameDirty = false
    }
    if (emu.wasSramUpdated()) this.#sramDirty = true
  }

  // --- Battery saves -----------------------------------------------------------

  async #loadSram(): Promise<void> {
    if (!this.#opts.loggedIn || !this.#emu) return
    const rsp = await api<GetSaveRsp>('GET', apiPath.save(this.#opts.postId))
    if (rsp.ok && rsp.data.sramBase64) {
      if (!this.#emu.setSram(base64ToBytes(rsp.data.sramBase64)))
        this.#setStatus(
          'Your save does not match this ROM version and was ignored.',
        )
    }
    window.setInterval(() => void this.#flushSram(), saveIntervalMs)
  }

  async #flushSram(keepalive = false): Promise<void> {
    if (!this.#sramDirty || !this.#emu || !this.#opts.loggedIn) return
    const sram = this.#emu.getSram()
    if (!sram.length) return
    this.#sramDirty = false
    const body = {sramBase64: bytesToBase64(sram)}
    const rsp = await api<OkRsp>('PUT', apiPath.save(this.#opts.postId), body, {
      keepalive: keepalive && body.sramBase64.length < keepaliveMax,
    })
    if (!rsp.ok) {
      this.#sramDirty = true
      if (rsp.status !== 0) this.#setStatus(`Save failed: ${rsp.error.message}`)
    }
  }

  // --- Events ------------------------------------------------------------------

  #bindEvents(): void {
    const unlock = (): void => {
      void this.#audio.unlock().then(() => this.#updateSoundHint())
    }
    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('keydown', unlock, true)

    window.addEventListener('keydown', ev => this.#onKey(ev, true))
    window.addEventListener('keyup', ev => this.#onKey(ev, false))
    window.addEventListener('blur', () => this.#input.releaseAll())

    // Leaving expanded mode / backgrounding: pause and flush SRAM (spec §3.3).
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        void this.#flushSram(true)
        this.#pause()
        this.#audio.suspend()
      } else if (!this.#userPaused) {
        void this.#audio.unlock()
        this.#resume()
      }
    })
    window.addEventListener('pagehide', () => void this.#flushSram(true))
    window.addEventListener('resize', () => this.#layout())
    this.#layout()
  }

  #onKey(ev: KeyboardEvent, down: boolean): void {
    if (this.#rebinding) {
      if (down) {
        ev.preventDefault()
        this.#bindings[this.#rebinding] = [ev.code]
        saveBindings(this.#bindings)
        this.#rebinding = undefined
        this.#refreshKeysModal?.()
      }
      return
    }
    const target = ev.target as HTMLElement | null
    if (target?.closest('input, textarea, select, .modal')) return
    for (const b of buttons) {
      if (this.#bindings[b].includes(ev.code)) {
        ev.preventDefault()
        this.#input.set('keyboard', b, down)
      }
    }
  }

  // --- Rendering ---------------------------------------------------------------

  #refreshKeysModal: (() => void) | undefined

  #renderShell(): void {
    clear(this.#root)
    const touch = isTouchDevice()
    const toolbar = el(
      'div',
      {class: 'toolbar', role: 'toolbar'},
      this.#pauseBtn,
      this.#muteBtn,
      this.#speedBtn,
      this.#paletteBtn,
      el(
        'button',
        {type: 'button', on: {click: () => this.#saveState()}},
        'Save',
      ),
      el(
        'button',
        {type: 'button', on: {click: () => this.#loadState()}},
        'Load',
      ),
      touch
        ? null
        : el(
            'button',
            {type: 'button', on: {click: () => void this.#keysModal()}},
            'Keys',
          ),
    )
    this.#pauseBtn.addEventListener('click', () => {
      this.#userPaused = this.#running
      if (this.#running) this.#pause()
      else this.#resume()
    })
    this.#muteBtn.addEventListener('click', () => {
      this.#audio.muted = !this.#audio.muted
      if (this.#audio.muted) this.#setIcon(this.#muteBtn, icons.muted, 'Unmute')
      else this.#setIcon(this.#muteBtn, icons.sound, 'Mute')
    })
    this.#speedBtn.addEventListener('click', () => {
      this.#speed = this.#speed === 1 ? 2 : 1
      this.#speedBtn.textContent = `${this.#speed}×`
      this.#audio.resync()
    })
    this.#paletteBtn.addEventListener('click', () => this.#cyclePalette())
    this.#soundHint.addEventListener('click', () => {
      void this.#audio.unlock().then(() => this.#updateSoundHint())
    })

    const playerEl = el(
      'div',
      {class: `player${touch ? ' touch' : ''}`},
      el('header', {class: 'player-top'}, toolbar),
      this.#screenWrap,
      touch ? this.#touchLeft() : null,
      touch ? this.#touchRight() : null,
      el('footer', {class: 'player-foot'}, this.#status, this.#soundHint),
    )
    this.#root.append(playerEl)
  }

  /** Glyph-only button; the label goes to the tooltip and screen readers. */
  #setIcon(btn: HTMLButtonElement, glyph: string, label: string): void {
    btn.textContent = glyph
    btn.title = label
    btn.setAttribute('aria-label', label)
  }

  /** Integer nearest-neighbour scaling, letterboxed (spec §7.1). */
  #layout(): void {
    const box = this.#screenWrap.getBoundingClientRect()
    const scale = Math.max(
      1,
      Math.floor(Math.min(box.width / screenWidth, box.height / screenHeight)),
    )
    this.#canvas.style.width = `${screenWidth * scale}px`
    this.#canvas.style.height = `${screenHeight * scale}px`
  }

  #showOverlay(
    text: string,
    button?: {label: string; action: () => void},
  ): void {
    clear(this.#overlay)
    this.#overlay.hidden = false
    append(
      this.#overlay,
      el('p', {}, text),
      button
        ? el(
            'button',
            {type: 'button', class: 'primary', on: {click: button.action}},
            button.label,
          )
        : null,
    )
  }

  #hideOverlay(): void {
    this.#overlay.hidden = true
  }

  #setStatus(text: string): void {
    this.#status.textContent = text
    window.setTimeout(() => {
      if (this.#status.textContent === text) this.#status.textContent = ''
    }, 4000)
  }

  #updateSoundHint(): void {
    this.#soundHint.hidden = !this.#audio.locked || !this.#running
  }

  // --- Touch controls ------------------------------------------------------------

  #touchButton(label: string, button: Button, cls: string): HTMLElement {
    const node = el(
      'div',
      {class: `tbtn ${cls}`, role: 'button', 'aria-label': label},
      label,
    )
    const press =
      (down: boolean) =>
      (ev: Event): void => {
        ev.preventDefault()
        if (down && !node.classList.contains('pressed')) navigator.vibrate?.(8)
        node.classList.toggle('pressed', down)
        this.#input.set(`touch-${button}`, button, down)
      }
    node.addEventListener('pointerdown', press(true))
    node.addEventListener('pointerup', press(false))
    node.addEventListener('pointercancel', press(false))
    node.addEventListener('pointerleave', press(false))
    return node
  }

  #touchLeft(): HTMLElement {
    const pad = el(
      'div',
      {class: 'dpad', 'aria-label': 'D-pad'},
      el('div', {class: 'dpad-cross'}),
    )
    const update = (ev: PointerEvent): void => {
      ev.preventDefault()
      const r = pad.getBoundingClientRect()
      const x = (2 * (ev.clientX - r.left)) / r.width - 1
      const y = (2 * (ev.clientY - r.top)) / r.height - 1
      const dirs = dpadDirections(x, y)
      if (ev.type === 'pointerdown' && dirs.size) navigator.vibrate?.(8)
      this.#input.replace('dpad', dirs)
    }
    const release = (ev: PointerEvent): void => {
      ev.preventDefault()
      this.#input.replace('dpad', new Set())
    }
    pad.addEventListener('pointerdown', ev => {
      pad.setPointerCapture(ev.pointerId)
      update(ev)
    })
    pad.addEventListener('pointermove', ev => {
      if (pad.hasPointerCapture(ev.pointerId)) update(ev)
    })
    pad.addEventListener('pointerup', release)
    pad.addEventListener('pointercancel', release)
    return el(
      'div',
      {class: 'touch-left'},
      pad,
      this.#touchButton('Select', 'select', 'pill'),
    )
  }

  #touchRight(): HTMLElement {
    return el(
      'div',
      {class: 'touch-right'},
      el(
        'div',
        {class: 'ab'},
        this.#touchButton('B', 'b', 'round b'),
        this.#touchButton('A', 'a', 'round a'),
      ),
      this.#touchButton('Start', 'start', 'pill'),
    )
  }

  // --- Actions -------------------------------------------------------------------

  #cyclePalette(): void {
    if (this.#cgb || !this.#emu) return
    this.#paletteIdx = (this.#paletteIdx + 1) % palettes.length
    const palette = paletteAt(this.#paletteIdx)
    this.#emu.setDmgPalette(palette.shades)
    safeStorage.set('hb:palette', `${this.#paletteIdx}`)
    this.#setStatus(`Palette: ${palette.name}`)
  }

  #stateKey(): string {
    return `hb:state:${this.#meta?.romId ?? ''}`
  }

  #saveState(): void {
    if (!this.#emu) return
    this.#state = this.#emu.saveState()
    const stored = safeStorage.set(this.#stateKey(), bytesToBase64(this.#state))
    this.#setStatus(
      stored ? 'State saved.' : 'State saved for this session only.',
    )
  }

  #loadState(): void {
    if (!this.#emu) return
    let state = this.#state
    if (!state) {
      const raw = safeStorage.get(this.#stateKey())
      if (raw) state = base64ToBytes(raw)
    }
    if (!state) {
      this.#setStatus('No saved state yet.')
      return
    }
    this.#setStatus(
      this.#emu.loadState(state)
        ? 'State loaded.'
        : 'Could not load that state.',
    )
  }

  async #keysModal(): Promise<void> {
    const wasRunning = this.#running
    this.#pause()
    await modal(close => {
      const list = el('div', {class: 'keys'})
      const render = (): void => {
        clear(list)
        for (const b of buttons) {
          const waiting = this.#rebinding === b
          list.append(
            el(
              'div',
              {class: 'key-row'},
              el('span', {class: 'key-name'}, b.toUpperCase()),
              el(
                'span',
                {class: 'key-code'},
                waiting
                  ? 'Press a key…'
                  : this.#bindings[b].map(keyLabel).join(' / '),
              ),
              el(
                'button',
                {
                  type: 'button',
                  on: {
                    click: () => {
                      this.#rebinding = b
                      render()
                    },
                  },
                },
                'Change',
              ),
            ),
          )
        }
      }
      this.#refreshKeysModal = render
      render()
      return el(
        'div',
        {},
        el('h2', {}, 'Keyboard controls'),
        list,
        el(
          'div',
          {class: 'modal-actions'},
          el(
            'button',
            {
              type: 'button',
              on: {
                click: () => {
                  this.#bindings = structuredClone(defaultBindings)
                  saveBindings(this.#bindings)
                  this.#rebinding = undefined
                  render()
                },
              },
            },
            'Reset defaults',
          ),
          el(
            'button',
            {
              type: 'button',
              class: 'primary',
              on: {
                click: () => {
                  this.#rebinding = undefined
                  close()
                },
              },
            },
            'Done',
          ),
        ),
      )
    })
    this.#rebinding = undefined
    this.#refreshKeysModal = undefined
    if (wasRunning) this.#resume()
  }
}
