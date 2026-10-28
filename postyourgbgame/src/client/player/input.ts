import {safeStorage} from '../lib/base64.ts'
import {type Button, buttons} from './emulator.ts'

export type KeyBindings = {[B in Button]: string[]}

export const defaultBindings: KeyBindings = {
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  a: ['KeyX'],
  b: ['KeyZ'],
  start: ['Enter'],
  select: ['ShiftLeft', 'ShiftRight'],
}

const bindingsKey = 'hb:keybindings'

export function loadBindings(): KeyBindings {
  const raw = safeStorage.get(bindingsKey)
  if (!raw) return structuredClone(defaultBindings)
  try {
    const parsed = JSON.parse(raw) as Partial<KeyBindings>
    const out = structuredClone(defaultBindings)
    for (const b of buttons) {
      const codes = parsed[b]
      if (Array.isArray(codes) && codes.every(c => typeof c === 'string'))
        out[b] = codes
    }
    return out
  } catch {
    return structuredClone(defaultBindings)
  }
}

export function saveBindings(bindings: KeyBindings): void {
  safeStorage.set(bindingsKey, JSON.stringify(bindings))
}

/** "KeyZ" → "Z", "ArrowUp" → "↑". */
export function keyLabel(code: string): string {
  const arrows: {[code: string]: string} = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
  }
  return arrows[code] ?? code.replace(/^Key|^Digit/, '')
}

/**
 * Merges keyboard, touch and gamepad into one button state; `onChange` fires
 * only when the combined state of a button flips.
 */
export class InputState {
  readonly #sources = new Map<string, Set<Button>>()
  readonly #pressed = new Set<Button>()
  readonly #onChange: (button: Button, down: boolean) => void

  constructor(onChange: (button: Button, down: boolean) => void) {
    this.#onChange = onChange
  }

  set(source: string, button: Button, down: boolean): void {
    let set = this.#sources.get(source)
    if (!set) {
      set = new Set()
      this.#sources.set(source, set)
    }
    if (down) set.add(button)
    else set.delete(button)
    this.#update(button)
  }

  /** Replaces a source's whole pressed set (gamepad / d-pad polling). */
  replace(source: string, pressed: ReadonlySet<Button>): void {
    const prev = this.#sources.get(source) ?? new Set<Button>()
    this.#sources.set(source, new Set(pressed))
    for (const b of buttons) if (prev.has(b) !== pressed.has(b)) this.#update(b)
  }

  releaseAll(): void {
    this.#sources.clear()
    for (const b of buttons) this.#update(b)
  }

  #update(button: Button): void {
    let down = false
    for (const set of this.#sources.values()) if (set.has(button)) down = true
    if (down === this.#pressed.has(button)) return
    if (down) this.#pressed.add(button)
    else this.#pressed.delete(button)
    this.#onChange(button, down)
  }
}

/** Standard-mapping gamepad → GB buttons (right face = A, bottom = B). */
export function pollGamepad(): Set<Button> {
  const out = new Set<Button>()
  const pads = navigator.getGamepads?.() ?? []
  for (const pad of pads) {
    if (!pad?.connected) continue
    const pressed = (i: number): boolean => !!pad.buttons[i]?.pressed
    const x = pad.axes[0] ?? 0
    const y = pad.axes[1] ?? 0
    if (pressed(1)) out.add('a')
    if (pressed(0) || pressed(2)) out.add('b')
    if (pressed(8)) out.add('select')
    if (pressed(9)) out.add('start')
    if (pressed(12) || y < -0.5) out.add('up')
    if (pressed(13) || y > 0.5) out.add('down')
    if (pressed(14) || x < -0.5) out.add('left')
    if (pressed(15) || x > 0.5) out.add('right')
  }
  return out
}

/**
 * D-pad direction(s) for a point relative to the pad centre, in units of the
 * pad radius. Eight 45° sectors give diagonals; a small dead zone in the
 * middle releases everything.
 */
export function dpadDirections(x: number, y: number): Set<Button> {
  const out = new Set<Button>()
  if (Math.hypot(x, y) < 0.25) return out
  const angle = (Math.atan2(y, x) * 180) / Math.PI // 0 = right, 90 = down
  const sector = Math.round(angle / 45) & 7
  // sectors: 0 right, 1 down-right, 2 down, 3 down-left, 4 left, 5 up-left, 6 up, 7 up-right
  if (sector === 7 || sector === 0 || sector === 1) out.add('right')
  if (sector >= 1 && sector <= 3) out.add('down')
  if (sector >= 3 && sector <= 5) out.add('left')
  if (sector >= 5 && sector <= 7) out.add('up')
  return out
}
